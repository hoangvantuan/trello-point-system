// tests/core/stats.test.ts
import { describe, expect, it } from 'vitest';
import {
  aggregateByList, aggregateByUser, breakdown, collectEntries,
  granularityFor, inRange, periodRange,
} from '../../src/core/stats';
import type { CardStat, LogEntry } from '../../src/core/stats-types';

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

const lists = [
  { id: 'L1', name: 'To Do' },
  { id: 'L2', name: 'Done' },
];

describe('aggregateByList', () => {
  it('chỉ tính card visible, gộp theo list, giữ thứ tự lists', () => {
    const agg = aggregateByList(cards, lists);
    expect(agg.rows).toEqual([
      { idList: 'L1', name: 'To Do', cards: 1, estimate: 5, logged: 4.5 },
    ]);
    expect(agg.totalCards).toBe(1);
    expect(agg.totalEstimate).toBe(5);
    expect(agg.totalLogged).toBe(4.5);
  });

  it('card không estimate vẫn được đếm nếu có entry', () => {
    const visibleNoEst: CardStat[] = [
      {
        id: 'cC', idShort: 3, name: 'C', idList: 'L2', closed: false, estimate: null,
        entries: [{ memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 2 }],
      },
    ];
    const agg = aggregateByList(visibleNoEst, lists);
    expect(agg.rows).toEqual([
      { idList: 'L2', name: 'Done', cards: 1, estimate: 0, logged: 2 },
    ]);
  });

  it('Log tích lũy MỌI thời điểm, không cắt theo kỳ (anti-regression bug 0/30)', () => {
    // Card có entry rải năm ngoái + hôm nay. Stock phải cộng hết để progress = Log/Est đúng,
    // bất kể đang chọn filter nào. aggregateByList KHÔNG còn nhận tham số thời gian.
    const spread: CardStat[] = [{
      id: 'cD', idShort: 4, name: 'D', idList: 'L1', closed: false, estimate: 10,
      entries: [
        { memberId: 'm1', fullName: 'Tuấn', date: '2025-01-15', point: 4 },
        { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 6 },
      ],
    }];
    const agg = aggregateByList(spread, lists);
    expect(agg.rows[0]!.estimate).toBe(10);
    expect(agg.rows[0]!.logged).toBe(10); // 4 + 6, không bị cắt
  });
});

describe('aggregateByUser', () => {
  it('gồm card archive, sắp theo logged giảm dần', () => {
    const agg = aggregateByUser(cards, null);
    expect(agg.rows).toEqual([
      { memberId: 'm1', fullName: 'Tuấn', entries: 2, logged: 5 },
      { memberId: 'm2', fullName: 'Mai', entries: 1, logged: 1.5 },
    ]);
    expect(agg.totalEntries).toBe(3);
    expect(agg.totalLogged).toBe(6.5);
  });

  it('range lọc entry theo ngày', () => {
    const agg = aggregateByUser(cards, { start: '2026-06-01', end: '2026-06-30' });
    expect(agg.rows).toEqual([
      { memberId: 'm1', fullName: 'Tuấn', entries: 1, logged: 3 },
      { memberId: 'm2', fullName: 'Mai', entries: 1, logged: 1.5 },
    ]);
  });

  it('không entry -> mảng rỗng, tổng 0', () => {
    const agg = aggregateByUser([], null);
    expect(agg).toEqual({ rows: [], totalEntries: 0, totalLogged: 0 });
  });
});

describe('granularityFor', () => {
  it('today -> none, year -> month, còn lại -> week', () => {
    expect(granularityFor('today')).toBe('none');
    expect(granularityFor('year')).toBe('month');
    expect(granularityFor('all')).toBe('week');
    expect(granularityFor('week')).toBe('week');
    expect(granularityFor('month')).toBe('week');
  });
});

describe('breakdown', () => {
  const entries: LogEntry[] = [
    { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 3 },
    { memberId: 'm1', fullName: 'Tuấn', date: '2026-06-05', point: 2 },
    { memberId: 'm2', fullName: 'Mai', date: '2026-05-25', point: 4 },
  ];

  it('none -> rỗng', () => {
    expect(breakdown(entries, 'none', 8)).toEqual([]);
  });

  it('week -> gộp theo tuần, sort tăng dần theo key', () => {
    const b = breakdown(entries, 'week', 8);
    expect(b.map((x) => x.label)).toEqual(['W22', 'W23']);
    expect(b.map((x) => x.total)).toEqual([4, 5]);
    expect(b[1]!.byUser).toEqual({ m1: 5 });
    expect(b[0]!.byUser).toEqual({ m2: 4 });
  });

  it('month -> gộp theo tháng', () => {
    const b = breakdown(entries, 'month', 8);
    expect(b.map((x) => x.label)).toEqual(['M5', 'M6']);
    expect(b.map((x) => x.total)).toEqual([4, 5]);
  });

  it('maxBuckets giữ N kỳ gần nhất (cuối mảng)', () => {
    const many: LogEntry[] = [
      { memberId: 'm1', fullName: 'A', date: '2026-05-04', point: 1 }, // W19
      { memberId: 'm1', fullName: 'A', date: '2026-05-11', point: 1 }, // W20
      { memberId: 'm1', fullName: 'A', date: '2026-05-18', point: 1 }, // W21
    ];
    const b = breakdown(many, 'week', 2);
    expect(b.map((x) => x.label)).toEqual(['W20', 'W21']);
  });
});
