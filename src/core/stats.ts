// src/core/stats.ts
import { mondayOf, todayLocal } from './dateutil';
import type { CardStat, DateRange, LogEntry, TimeFilter } from './stats-types';

// Khoảng ngày tương ứng filter. 'all' -> null (không lọc).
export function periodRange(filter: TimeFilter, now: Date): DateRange | null {
  if (filter === 'all') return null;
  const today = todayLocal(now);
  if (filter === 'today') return { start: today, end: today };
  if (filter === 'week') {
    const monday = mondayOf(now);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: todayLocal(monday), end: todayLocal(sunday) };
  }
  if (filter === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0); // ngày 0 của tháng sau = ngày cuối tháng này
    return { start: todayLocal(first), end: todayLocal(last) };
  }
  // year
  const y = now.getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

// So sánh chuỗi YYYY-MM-DD đủ để kiểm tra trong khoảng (bao gồm 2 đầu).
export function inRange(date: string, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}

// Gom mọi entry (đã lọc thời gian) từ tập card. visibleOnly=true bỏ card archive.
export function collectEntries(
  cards: CardStat[],
  range: DateRange | null,
  visibleOnly: boolean
): LogEntry[] {
  const out: LogEntry[] = [];
  for (const card of cards) {
    if (visibleOnly && card.closed) continue;
    for (const e of card.entries) {
      if (inRange(e.date, range)) out.push(e);
    }
  }
  return out;
}
