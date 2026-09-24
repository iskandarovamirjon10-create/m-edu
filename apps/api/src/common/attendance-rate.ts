export function computeAttendanceRate(
  stats: Array<{ status: string; count?: number; _count?: { status: number } }>,
  returnNullIfEmpty = false
): number | null {
  let attended = 0;
  let missed = 0;

  for (const s of stats) {
    const c = s.count ?? s._count?.status ?? 0;
    if (s.status === 'PRESENT' || s.status === 'LATE') {
      attended += c;
    } else if (s.status === 'ABSENT' || s.status === 'NO_SHOW') {
      missed += c;
    }
    // EXCUSED is intentionally ignored from the denominator (it doesn't hurt or help)
  }

  const total = attended + missed;
  if (total === 0) return returnNullIfEmpty ? null : 0;
  return Math.round((attended / total) * 100);
}
