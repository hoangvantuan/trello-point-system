import { describe, expect, it } from 'vitest';
import { decodeMemberLog, encodeMemberLog } from '../../src/core/codec';
import type { DecodedMemberLog } from '../../src/core/types';

const decoded: DecodedMemberLog = {
  version: 1,
  fullName: 'Tuấn',
  username: 'tuanhv',
  entries: [
    { date: '2026-06-06', point: 3, comment: 'fix login' },
    { date: '2026-06-05', point: 2, comment: '' },
  ],
};

const compact = {
  v: 1,
  n: 'Tuấn',
  u: 'tuanhv',
  e: [
    ['2026-06-06', 3, 'fix login'],
    ['2026-06-05', 2, ''],
  ],
};

describe('encodeMemberLog', () => {
  it('đổi friendly -> compact', () => {
    expect(encodeMemberLog(decoded)).toEqual(compact);
  });
});

describe('decodeMemberLog', () => {
  it('đổi compact -> friendly', () => {
    expect(decodeMemberLog(compact)).toEqual(decoded);
  });

  it('roundtrip giữ nguyên', () => {
    expect(decodeMemberLog(encodeMemberLog(decoded))).toEqual(decoded);
  });

  it('dữ liệu null/undefined -> log rỗng version 1', () => {
    expect(decodeMemberLog(null)).toEqual({
      version: 1,
      fullName: '',
      username: '',
      entries: [],
    });
  });

  it('bỏ qua entry hỏng (thiếu field, point không phải số)', () => {
    const dirty = {
      v: 1,
      n: 'Mai',
      u: 'mai',
      e: [
        ['2026-06-06', 1.5, 'ok'],
        ['2026-06-06', 'x', 'point hỏng'],
        ['bad-row'],
      ],
    };
    expect(decodeMemberLog(dirty).entries).toEqual([
      { date: '2026-06-06', point: 1.5, comment: 'ok' },
    ]);
  });
});
