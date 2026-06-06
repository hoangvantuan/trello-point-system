import { describe, expect, it } from 'vitest';
import { buildHistory } from '../../src/core/history';
import type { DecodedMemberLog } from '../../src/core/types';

const logs: Record<string, DecodedMemberLog> = {
  m1: {
    version: 1,
    fullName: 'Tuấn',
    username: 'tuanhv',
    entries: [
      { date: '2026-06-06', point: 3, comment: 'fix login' },
      { date: '2026-06-05', point: 2, comment: '' },
    ],
  },
  m2: {
    version: 1,
    fullName: 'Mai',
    username: 'mai',
    entries: [{ date: '2026-06-06', point: 1.5, comment: 'review' }],
  },
};

describe('buildHistory', () => {
  it('nhóm theo ngày, ngày mới nhất trên cùng', () => {
    const groups = buildHistory(logs);
    expect(groups.map((g) => g.date)).toEqual(['2026-06-06', '2026-06-05']);
  });

  it('tính tổng phụ mỗi ngày', () => {
    const groups = buildHistory(logs);
    expect(groups[0]!.subtotal).toBe(4.5);
    expect(groups[1]!.subtotal).toBe(2);
  });

  it('mỗi row giữ memberId, fullName, entryIndex', () => {
    const groups = buildHistory(logs);
    const day0 = groups[0]!.rows;
    expect(day0).toContainEqual({
      memberId: 'm1',
      fullName: 'Tuấn',
      point: 3,
      comment: 'fix login',
      entryIndex: 0,
    });
    expect(day0).toContainEqual({
      memberId: 'm2',
      fullName: 'Mai',
      point: 1.5,
      comment: 'review',
      entryIndex: 0,
    });
  });

  it('entryIndex trỏ đúng vị trí trong entries của member', () => {
    const groups = buildHistory(logs);
    const day1 = groups[1]!.rows;
    expect(day1).toEqual([
      {
        memberId: 'm1',
        fullName: 'Tuấn',
        point: 2,
        comment: '',
        entryIndex: 1,
      },
    ]);
  });

  it('không member nào -> mảng rỗng', () => {
    expect(buildHistory({})).toEqual([]);
  });
});
