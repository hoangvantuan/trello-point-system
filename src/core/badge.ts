export type BadgeColor = 'default' | 'orange';

export interface BadgeData {
  text: string;
  color: BadgeColor;
}

// logged: tổng đã log (>=0). estimate: number | null.
// Trống cả hai -> null. Log vượt estimate -> cam.
export function formatBadge(
  logged: number,
  estimate: number | null
): BadgeData | null {
  const hasEstimate = estimate !== null;
  const hasLog = logged > 0;

  if (!hasEstimate && !hasLog) return null;

  if (hasEstimate) {
    const color: BadgeColor = logged > (estimate as number) ? 'orange' : 'default';
    return { text: `${logged}/${estimate}`, color };
  }

  // Có log, chưa estimate: ẩn mẫu số.
  return { text: `${logged}`, color: 'default' };
}
