import type { Entry } from './types';

// Làm tròn 2 chữ số, né rác dấu phẩy động (1.1 + 2.2 = 3.3000000000000003).
export function roundTotal(sum: number): number {
  return Math.round(sum * 100) / 100;
}

export function sumEntries(entries: Entry[]): number {
  const raw = entries.reduce((acc, e) => acc + e.point, 0);
  return roundTotal(raw);
}
