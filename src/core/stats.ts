// src/core/stats.ts
import { mondayOf, todayLocal } from './dateutil';
import { roundTotal } from './totals';
import type {
  CardStat, DateRange, ListAggregate, ListStat, LogEntry, TimeFilter, UserAggregate, UserStat,
} from './stats-types';

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

// Tab "Theo List": CHỈ card visible (closed === false). Card "có point data" = có estimate hoặc có entry.
export function aggregateByList(
  cards: CardStat[],
  lists: { id: string; name: string }[],
  range: DateRange | null
): ListAggregate {
  const nameById = new Map(lists.map((l) => [l.id, l.name]));
  const acc = new Map<string, { name: string; cards: number; estimate: number; logged: number }>();

  for (const card of cards) {
    if (card.closed) continue;
    const hasData = card.estimate !== null || card.entries.length > 0;
    if (!hasData) continue;
    const logged = roundTotal(
      card.entries.filter((e) => inRange(e.date, range)).reduce((s, e) => s + e.point, 0)
    );
    const name = nameById.get(card.idList) ?? '(list ẩn)';
    const row = acc.get(card.idList) ?? { name, cards: 0, estimate: 0, logged: 0 };
    row.cards += 1;
    row.estimate = roundTotal(row.estimate + (card.estimate ?? 0));
    row.logged = roundTotal(row.logged + logged);
    acc.set(card.idList, row);
  }

  // Giữ thứ tự list như board trả về.
  const rows: ListStat[] = [];
  for (const l of lists) {
    const r = acc.get(l.id);
    if (r) rows.push({ idList: l.id, name: r.name, cards: r.cards, estimate: r.estimate, logged: r.logged });
  }

  return {
    rows,
    totalCards: rows.reduce((s, r) => s + r.cards, 0),
    totalEstimate: roundTotal(rows.reduce((s, r) => s + r.estimate, 0)),
    totalLogged: roundTotal(rows.reduce((s, r) => s + r.logged, 0)),
  };
}

// Tab "Theo User": TẤT CẢ card (gồm archive). Đóng góp tích lũy phải đủ.
export function aggregateByUser(cards: CardStat[], range: DateRange | null): UserAggregate {
  const acc = new Map<string, { fullName: string; entries: number; logged: number }>();
  for (const card of cards) {
    for (const e of card.entries) {
      if (!inRange(e.date, range)) continue;
      const row = acc.get(e.memberId) ?? { fullName: e.fullName, entries: 0, logged: 0 };
      if (e.fullName) row.fullName = e.fullName; // giữ tên mới nhất không rỗng
      row.entries += 1;
      row.logged = roundTotal(row.logged + e.point);
      acc.set(e.memberId, row);
    }
  }
  const rows: UserStat[] = [...acc.entries()]
    .map(([memberId, r]) => ({ memberId, fullName: r.fullName, entries: r.entries, logged: r.logged }))
    .sort((a, b) => b.logged - a.logged);
  return {
    rows,
    totalEntries: rows.reduce((s, r) => s + r.entries, 0),
    totalLogged: roundTotal(rows.reduce((s, r) => s + r.logged, 0)),
  };
}
