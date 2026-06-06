// tests/core/stats.test.ts
import { describe, expect, it } from 'vitest';
import { collectEntries, inRange, periodRange } from '../../src/core/stats';
import type { CardStat } from '../../src/core/stats-types';

const cards: CardStat[] = [
  {
    id: 'cA', idShort: 1, name: 'A', idList: 'L1', closed: false, estimate: 5,
    entries: [
      { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 3 },
      { memberId: 'm2', fullName: 'Mai', date: '2026-06-06', point: 1.5 },
    ],
  },
  {
    id: 'cB', idShort: 2, name: 'B', idList: 'L1', closed: true, estimate: null,
    entries: [{ memberId: 'm1', fullName: 'Tuấn', date: '2026-05-25', point: 2 }],
  },
];

describe('periodRange', () => {
  it('all -> null', () => {
    expect(periodRange('all', new Date(2026, 5, 6, 10))).toBeNull();
  });
  it('today -> ngày hôm nay', () => {
    expect(periodRange('today', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-06-06', end: '2026-06-06',
    });
  });
  it('week -> thứ 2 đến chủ nhật', () => {
    expect(periodRange('week', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-06-01', end: '2026-06-07',
    });
  });
  it('month -> ngày 1 đến cuối tháng', () => {
    expect(periodRange('month', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-06-01', end: '2026-06-30',
    });
  });
  it('year -> 1/1 đến 31/12', () => {
    expect(periodRange('year', new Date(2026, 5, 6, 10))).toEqual({
      start: '2026-01-01', end: '2026-12-31',
    });
  });
});

describe('inRange', () => {
  const r = { start: '2026-06-01', end: '2026-06-07' };
  it('trong khoảng -> true', () => expect(inRange('2026-06-03', r)).toBe(true));
  it('ngoài khoảng -> false', () => expect(inRange('2026-06-08', r)).toBe(false));
  it('range null -> luôn true', () => expect(inRange('1999-01-01', null)).toBe(true));
});

describe('collectEntries', () => {
  it('visibleOnly=true bỏ entry của card archive', () => {
    const out = collectEntries(cards, null, true);
    expect(out.map((e) => e.date).sort()).toEqual(['2026-06-06', '2026-06-06']);
  });
  it('visibleOnly=false gồm cả card archive', () => {
    const out = collectEntries(cards, null, false);
    expect(out.length).toBe(3);
  });
  it('áp range lọc theo ngày', () => {
    const out = collectEntries(cards, { start: '2026-05-01', end: '2026-05-31' }, false);
    expect(out.map((e) => e.point)).toEqual([2]);
  });
});
