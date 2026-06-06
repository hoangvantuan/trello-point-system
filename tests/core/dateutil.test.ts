import { describe, expect, it } from 'vitest';
import { formatDayLabel, todayLocal } from '../../src/core/dateutil';

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
