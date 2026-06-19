import { describe, expect, it } from 'vitest';
import { roundTotal, sumEntries } from '../../src/core/totals';
import type { Entry } from '../../src/core/types';

describe('roundTotal', () => {
  it('né rác số thực 1.1 + 2.2', () => {
    expect(roundTotal(1.1 + 2.2)).toBe(3.3);
  });

  it('làm tròn 3 chữ số', () => {
    expect(roundTotal(6.5555)).toBe(6.556);
  });

  it('giữ nguyên 3 chữ số thập phân (0.125)', () => {
    expect(roundTotal(0.125)).toBe(0.125);
    expect(roundTotal(0.125 + 0.125)).toBe(0.25);
  });

  it('giữ số nguyên', () => {
    expect(roundTotal(8)).toBe(8);
  });
});

describe('sumEntries', () => {
  const entries: Entry[] = [
    { date: '2026-06-06', point: 3, comment: '' },
    { date: '2026-06-06', point: 1.5, comment: '' },
    { date: '2026-06-05', point: 2, comment: '' },
  ];

  it('cộng tổng đã làm tròn', () => {
    expect(sumEntries(entries)).toBe(6.5);
  });

  it('mảng rỗng -> 0', () => {
    expect(sumEntries([])).toBe(0);
  });
});
