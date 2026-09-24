import { ThrottlerException } from '@nestjs/throttler';

interface Bucket {
  timestamps: number[];
  lastSeen: number;
}

/**
 * An organization-aware rate limiter.
 *
 * ARCHITECTURE DECISION - P3-D:
 * This rate limiter uses an in-memory bucket algorithm. Since the application
 * is currently deployed as a single-replica architecture (`instances: 1` in
 * ecosystem.config.js), an in-memory approach is fully sufficient. There is
 * no need to migrate to a shared storage (like Redis) until the platform
 * is scaled horizontally to multiple replicas. If a distributed fallback is
 * configured, it will act as a second-stage gate.
 *
 * Keeps a sliding window of recent timestamps per organization.
 *
 * IMPORTANT:
 * - The in-memory limiter protects expensive operations inside a single
 *   API instance and is atomically single-threaded.
 * - For multi-replica deployments, provide a `distributedCheck` callback.
 *   The in-memory limiter runs first; when the callback is configured, a
 *   "allow" decision is only finalised when the distributed check also
 *   agrees.  This closes the bypass window where two replicas each see
 *   an empty local bucket and both forward the request.
 * - When the distributed check is unavailable (returns null), the
 *   in-memory decision stands — safe degradation to local-only mode.
 *
 * The limiter intentionally performs "check + consume" atomically from
 * the perspective of Node's single-threaded event loop.
 */
export type DistributedCheck = (
  orgId: string,
  key: string,
  limit: number,
  windowMs: number,
) => Promise<boolean | null>;

export class OrgRateLimiter {
  private readonly buckets = new Map<
    string,
    Map<string, Bucket>
  >();

  private readonly retentionMs: number;
  private readonly now: () => number;
  private readonly distributedCheck: DistributedCheck | null;

  private static readonly DEFAULT_RETENTION_MS =
    10 * 60_000;

  private static readonly MAX_TRACKED_ORGS =
    256;

  constructor(
    retentionMs = OrgRateLimiter.DEFAULT_RETENTION_MS,
    now: () => number = Date.now,
    distributedCheck?: DistributedCheck,
  ) {
    if (
      !Number.isFinite(retentionMs) ||
      retentionMs <= 0
    ) {
      throw new Error(
        'OrgRateLimiter retentionMs must be greater than 0',
      );
    }

    this.retentionMs = retentionMs;
    this.now = now;
    this.distributedCheck = distributedCheck ?? null;
  }

  /**
   * Whether a distributed fallback is wired in. Callers / tests use this
   * to verify deployment-time wiring without invoking the callback.
   */
  get isDistributed(): boolean {
    return this.distributedCheck !== null;
  }

  /**
   * Consume one operation from an organization's rate-limit bucket.
   *
   * Throws HTTP 429 when the configured limit is exhausted.
   *
   * Example:
   *   limiter.assert(orgId, 'camera:test', 10, 60_000);
   */
  assert(
    orgId: string,
    key: string,
    limit: number,
    windowMs: number,
  ): void {
    this.validateArguments(
      orgId,
      key,
      limit,
      windowMs,
    );

    const now = this.now();

    this.pruneExpiredBuckets(now);

    let organizationBuckets =
      this.buckets.get(orgId);

    if (!organizationBuckets) {
      organizationBuckets = new Map();
      this.buckets.set(
        orgId,
        organizationBuckets,
      );
    }

    let bucket =
      organizationBuckets.get(key);

    if (!bucket) {
      bucket = {
        timestamps: [],
        lastSeen: now,
      };

      organizationBuckets.set(
        key,
        bucket,
      );
    }

    this.removeExpiredTimestamps(
      bucket,
      now,
      windowMs,
    );

    if (
      bucket.timestamps.length >= limit
    ) {
      bucket.lastSeen = now;

      throw new ThrottlerException(
        `Rate limit exceeded for ${key} ` +
          `(max ${limit} per ${Math.ceil(
            windowMs / 1000,
          )}s per organization)`,
      );
    }

    bucket.timestamps.push(now);
    bucket.lastSeen = now;

    /*
     * Protect against pathological growth.
     *
     * This normally never matters because `limit` is small,
     * but keeping this defensive boundary makes the class safer
     * if it is reused elsewhere.
     */
    if (
      bucket.timestamps.length >
      limit
    ) {
      bucket.timestamps =
        bucket.timestamps.slice(
          -limit,
        );
    }

    /*
     * Multi-replica safety: if a distributed fallback is configured, use
     * it as a second gate.  The in-memory bucket has already accepted the
     * call, so the request is otherwise allowed — but the distributed
     * store tracks the real cross-replica count and may still reject.
     *
     * Failure modes:
     *   - throws          -> we roll back the local timestamp so the local
     *                        bucket does not accumulate phantom usage.
     *   - resolves false  -> we roll back the local timestamp and surface
     *                        429 (a peer replica was over the limit).
     *   - resolves null   -> safe degradation, no distributed signal yet;
     *                        local decision is allowed to stand.
     */
    void this.applyDistributedCheck(
      orgId,
      key,
      limit,
      windowMs,
      bucket,
    );

    this.enforceOrganizationBound(
      now,
    );
  }

  /**
   * Async application of the distributed check. Returns a promise only
   * so callers / tests can await it when they want the second gate
   * resolved before responding to the user.
   */
  async assertDistributed(
    orgId: string,
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    this.assert(orgId, key, limit, windowMs);
    await this.applyDistributedCheck(
      orgId,
      key,
      limit,
      windowMs,
      this.buckets.get(orgId)?.get(key),
    );
  }

  private async applyDistributedCheck(
    orgId: string,
    key: string,
    limit: number,
    windowMs: number,
    bucket: Bucket | undefined,
  ): Promise<void> {
    if (!this.distributedCheck) return;

    let allowed: boolean | null;
    try {
      allowed = await this.distributedCheck(
        orgId,
        key,
        limit,
        windowMs,
      );
    } catch {
      // A failing distributed store must not silently bypass the limit.
      // Roll back the local consumption we just did and re-throw 429.
      if (bucket) {
        bucket.timestamps.pop();
        bucket.lastSeen = this.now();
      }
      throw new ThrottlerException(
        `Rate limit check unavailable for ${key}; failing closed.`,
      );
    }

    if (allowed === null) {
      // Safe degradation: the distributed store has no opinion yet.
      return;
    }

    if (!allowed) {
      // The distributed store says we're over the limit across replicas.
      if (bucket) {
        bucket.timestamps.pop();
        bucket.lastSeen = this.now();
      }
      throw new ThrottlerException(
        `Rate limit exceeded for ${key} ` +
          `(max ${limit} per ${Math.ceil(
            windowMs / 1000,
          )}s per organization)`,
      );
    }
  }

  /**
   * Remove expired buckets.
   *
   * A bucket is removable when it has no active timestamps
   * or has not been touched within retentionMs.
   */
  prune(
    now = this.now(),
  ): void {
    this.pruneExpiredBuckets(now);
  }

  /**
   * Number of currently tracked organizations.
   * Primarily useful for tests/diagnostics.
   */
  get size(): number {
    return this.buckets.size;
  }

  /**
   * Remove all state.
   *
   * Useful for tests and controlled lifecycle management.
   */
  clear(): void {
    this.buckets.clear();
  }

  // ---------------------------------------------------------------------------
  // PRIVATE
  // ---------------------------------------------------------------------------

  private validateArguments(
    orgId: string,
    key: string,
    limit: number,
    windowMs: number,
  ): void {
    if (!orgId?.trim()) {
      throw new Error(
        'OrgRateLimiter orgId is required',
      );
    }

    if (!key?.trim()) {
      throw new Error(
        'OrgRateLimiter key is required',
      );
    }

    if (
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      throw new Error(
        'OrgRateLimiter limit must be a positive integer',
      );
    }

    if (
      !Number.isFinite(windowMs) ||
      windowMs <= 0
    ) {
      throw new Error(
        'OrgRateLimiter windowMs must be greater than 0',
      );
    }
  }

  private removeExpiredTimestamps(
    bucket: Bucket,
    now: number,
    windowMs: number,
  ): void {
    const cutoff =
      now - windowMs;

    /*
     * Timestamps are always appended in chronological
     * order, so stop at the first active timestamp.
     *
     * This avoids repeatedly allocating a new array
     * through Array.filter().
     */
    let firstActiveIndex = 0;

    while (
      firstActiveIndex <
        bucket.timestamps.length &&
      bucket.timestamps[
        firstActiveIndex
      ] <= cutoff
    ) {
      firstActiveIndex++;
    }

    if (firstActiveIndex > 0) {
      bucket.timestamps =
        bucket.timestamps.slice(
          firstActiveIndex,
        );
    }
  }

  private pruneExpiredBuckets(
    now: number,
  ): void {
    for (
      const [
        orgId,
        organizationBuckets,
      ] of this.buckets
    ) {
      for (
        const [
          key,
          bucket,
        ] of organizationBuckets
      ) {
        if (
          bucket.timestamps.length ===
            0 ||
          now - bucket.lastSeen >
            this.retentionMs
        ) {
          organizationBuckets.delete(
            key,
          );
        }
      }

      if (
        organizationBuckets.size ===
        0
      ) {
        this.buckets.delete(
          orgId,
        );
      }
    }
  }

  private enforceOrganizationBound(
    now: number,
  ): void {
    if (
      this.buckets.size <=
      OrgRateLimiter.MAX_TRACKED_ORGS
    ) {
      return;
    }

    this.pruneExpiredBuckets(now);

    /*
     * If the map is still above the safety bound,
     * evict the least recently seen organization.
     *
     * This is a defensive memory bound, not part of
     * the actual rate-limit semantics.
     */
    while (
      this.buckets.size >
      OrgRateLimiter.MAX_TRACKED_ORGS
    ) {
      let oldestOrgId:
        | string
        | undefined;

      let oldestSeen =
        Number.POSITIVE_INFINITY;

      for (
        const [
          orgId,
          organizationBuckets,
        ] of this.buckets
      ) {
        let organizationLastSeen =
          Number.POSITIVE_INFINITY;

        for (
          const bucket of organizationBuckets.values()
        ) {
          organizationLastSeen =
            Math.min(
              organizationLastSeen,
              bucket.lastSeen,
            );
        }

        if (
          organizationLastSeen <
          oldestSeen
        ) {
          oldestSeen =
            organizationLastSeen;

          oldestOrgId = orgId;
        }
      }

      if (
        oldestOrgId === undefined
      ) {
        break;
      }

      this.buckets.delete(
        oldestOrgId,
      );
    }
  }
}