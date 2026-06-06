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

// Parse 'YYYY-MM-DD' thành Date local. Tránh new Date(string) vì nó hiểu UTC -> lệch ngày.
export function parseLocalDate(date: string): Date {
  const parts = date.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d);
}

// Thứ 2 của tuần chứa ngày (ISO: tuần bắt đầu thứ 2).
export function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (copy.getDay() + 6) % 7; // 0 = thứ 2 ... 6 = chủ nhật
  copy.setDate(copy.getDate() - offset);
  return copy;
}

// Số tuần ISO-8601 (tuần 1 là tuần chứa thứ 5 đầu tiên của năm). Dùng UTC để né DST.
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // thứ 2 = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // tới thứ 5 cùng tuần
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

// Định danh + nhãn kỳ tuần cho breakdown.
export function weekBucket(date: string): { key: string; label: string } {
  const d = parseLocalDate(date);
  return { key: todayLocal(mondayOf(d)), label: `W${isoWeek(d)}` };
}

// Định danh + nhãn kỳ tháng cho breakdown.
export function monthBucket(date: string): { key: string; label: string } {
  const parts = date.split('-');
  return { key: `${parts[0]}-${parts[1]}`, label: `T${Number(parts[1])}` };
}
