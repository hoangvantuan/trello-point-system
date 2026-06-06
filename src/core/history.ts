import type { DayGroup, DecodedMemberLog, Row } from './types';
import { roundTotal } from './totals';

// Gộp entry từ mọi member, nhóm theo ngày, ngày mới nhất trước.
export function buildHistory(
  logs: Record<string, DecodedMemberLog>
): DayGroup[] {
  const byDate = new Map<string, Row[]>();

  for (const [memberId, log] of Object.entries(logs)) {
    log.entries.forEach((entry, entryIndex) => {
      const row: Row = {
        memberId,
        fullName: log.fullName,
        point: entry.point,
        comment: entry.comment,
        entryIndex,
      };
      const list = byDate.get(entry.date);
      if (list) list.push(row);
      else byDate.set(entry.date, [row]);
    });
  }

  const dates = [...byDate.keys()].sort().reverse();
  return dates.map((date) => {
    const rows = byDate.get(date) as Row[];
    const subtotal = roundTotal(rows.reduce((acc, r) => acc + r.point, 0));
    return { date, subtotal, rows };
  });
}
