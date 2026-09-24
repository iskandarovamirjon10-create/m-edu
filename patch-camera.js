const fs = require('fs');
const filePath = 'c:/Users/Amirjon/education web platform/apps/api/src/camera/camera-worker-manager.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  "import {",
  "import type Redis from 'ioredis';\nimport { randomUUID } from 'crypto';\nimport {"
);

// 2. Add properties
const propInjection = `
  private redis: Redis | null = null;
  private pubRedis: Redis | null = null;
  private subRedis: Redis | null = null;
  private readonly replicaId = randomUUID();
  private heartbeatInterval: NodeJS.Timeout | null = null;
`;
content = content.replace(
  "private readonly lifecycleLocks = new Set<string>();",
  "private readonly lifecycleLocks = new Set<string>();\n" + propInjection
);

// 3. Add initializeRedis & renewLocks
const redisMethods = `
  private async initializeRedis() {
    try {
      const mod = await import('ioredis');
      const RedisCtor = mod.default;
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new RedisCtor(url);
      this.pubRedis = new RedisCtor(url);
      this.subRedis = new RedisCtor(url);

      this.subRedis.subscribe('camera-commands');
      this.subRedis.on('message', async (channel, message) => {
        if (channel === 'camera-commands') {
          const { action, cameraId, sender } = JSON.parse(message);
          if (sender === this.replicaId) return;
          if (action === 'STOP') {
            const worker = this.workers.get(cameraId);
            if (worker) {
              this.logger.log(\`Received distributed STOP for camera \${cameraId}\`);
              await this.stopWorker(worker.organizationId, cameraId, true).catch(() => {});
            }
          }
        }
      });

      this.heartbeatInterval = setInterval(() => this.renewLocks(), 5000);
    } catch (err) {
      this.logger.warn('Redis unavailable, camera distributed coordination disabled');
    }
  }

  private async renewLocks() {
    if (!this.redis) return;
    for (const [cameraId, worker] of this.workers.entries()) {
      const key = \`camera:\${cameraId}:lock\`;
      const val = await this.redis.get(key);
      if (val === this.replicaId) {
        await this.redis.expire(key, 10);
      } else {
        this.logger.warn(\`Lost lock for camera \${cameraId}, stopping local worker\`);
        await this.stopWorker(worker.organizationId, cameraId, true).catch(() => {});
      }
    }
  }
`;

content = content.replace(
  "async onModuleInit(): Promise<void> {",
  redisMethods + "\n\n  async onModuleInit(): Promise<void> {\n    await this.initializeRedis();"
);

// 4. Cleanup in destroy
content = content.replace(
  "async onModuleDestroy(): Promise<void> {",
  "async onModuleDestroy(): Promise<void> {\n    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);\n    if (this.redis) this.redis.disconnect();\n    if (this.pubRedis) this.pubRedis.disconnect();\n    if (this.subRedis) this.subRedis.disconnect();"
);

// 5. Modify startWorker
const startWorkerSearch = `    if (this.workers.has(cameraId)) {
      this.logger.warn(
        'Camera worker already running',
        {
          cameraId,
          organizationId,
        },
      );
      return;
    }`;

const startWorkerReplace = startWorkerSearch + `\n
    if (this.redis) {
      const acquired = await this.redis.set(\`camera:\${cameraId}:lock\`, this.replicaId, 'NX', 'EX', 10);
      if (!acquired) {
        this.logger.log(\`Camera \${cameraId} is already running on another replica\`);
        return;
      }
    }
`;
content = content.replace(startWorkerSearch, startWorkerReplace);

// 6. Modify stopWorker
const stopWorkerSearch = `  async stopWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    await this.assertCameraOwnership(
      organizationId,
      cameraId,
    );

    await this.stopWorkerInternal(
      cameraId,
    );
  }`;

const stopWorkerReplace = `  async stopWorker(
    organizationId: string,
    cameraId: string,
    localOnly = false
  ): Promise<void> {
    await this.assertCameraOwnership(
      organizationId,
      cameraId,
    );

    if (!localOnly && this.pubRedis) {
      this.pubRedis.publish('camera-commands', JSON.stringify({ action: 'STOP', cameraId, sender: this.replicaId }));
    }

    await this.stopWorkerInternal(
      cameraId,
    );

    if (this.redis) {
      await this.redis.del(\`camera:\${cameraId}:lock\`);
    }
  }`;
content = content.replace(stopWorkerSearch, stopWorkerReplace);

fs.writeFileSync(filePath, content);
console.log('Patched');
