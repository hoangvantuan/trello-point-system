import { describe, expect, it } from 'vitest';
import {
  formatDayLabel,
  isoWeek,
  mondayOf,
  monthBucket,
  parseLocalDate,
  todayLocal,
  weekBucket,
} from '../../src/core/dateutil';

describe('todayLocal', () => {
  it('trả YYYY-MM-DD theo giờ local, zero-pad tháng và ngày', () => {
    const d = new Date(2026, 5, 6, 9, 30, 0);
    expect(todayLocal(d)).toBe('2026-06-06');
  });

  it('zero-pad tháng/ngày một chữ số', () => {
    const d = new Date(2026, 0, 3, 0, 0, 0);
    expect(todayLocal(d)).toBe('2026-01-03');
  });
});

describe('formatDayLabel', () => {
  it('đổi YYYY-MM-DD thành DD/MM', () => {
    expect(formatDayLabel('2026-06-06')).toBe('06/06');
    expect(formatDayLabel('2026-01-03')).toBe('03/01');
  });
});

describe('parseLocalDate', () => {
  it('parse YYYY-MM-DD thành Date local (không lệch UTC)', () => {
    const d = parseLocalDate('2026-06-06');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // tháng 6, 0-index
    expect(d.getDate()).toBe(6);
  });
});

describe('mondayOf', () => {
  it('trả thứ 2 của tuần chứa ngày (thứ 7 -> thứ 2 cùng tuần)', () => {
    const monday = mondayOf(parseLocalDate('2026-06-06')); // 06/06 là thứ 7
    expect(todayLocal(monday)).toBe('2026-06-01');
  });

  it('chính ngày thứ 2 -> giữ nguyên', () => {
    const monday = mondayOf(parseLocalDate('2026-06-01'));
    expect(todayLocal(monday)).toBe('2026-06-01');
  });
});

describe('isoWeek', () => {
  it('01/01/2026 (thứ 5) là tuần 1', () => {
    expect(isoWeek(parseLocalDate('2026-01-01'))).toBe(1);
  });

  it('06/06/2026 là tuần 23', () => {
    expect(isoWeek(parseLocalDate('2026-06-06'))).toBe(23);
  });
});

describe('weekBucket', () => {
  it('key là thứ 2 của tuần, label là W<isoWeek>', () => {
    expect(weekBucket('2026-06-06')).toEqual({ key: '2026-06-01', label: 'W23' });
    expect(weekBucket('2026-06-05')).toEqual({ key: '2026-06-01', label: 'W23' });
  });
});

describe('monthBucket', () => {
  it('key YYYY-MM, label T<tháng>', () => {
    expect(monthBucket('2026-06-06')).toEqual({ key: '2026-06', label: 'T6' });
    expect(monthBucket('2026-01-15')).toEqual({ key: '2026-01', label: 'T1' });
  });
});
