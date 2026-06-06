function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Lấy ngày local hôm nay dạng YYYY-MM-DD (KHÔNG dùng toISOString — nó là UTC).
export function todayLocal(now: Date): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

// YYYY-MM-DD -> DD/MM cho header lịch sử.
export function formatDayLabel(date: string): string {
  const parts = date.split('-');
  return `${parts[2]}/${parts[1]}`;
}
