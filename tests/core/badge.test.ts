import { describe, expect, it } from 'vitest';
import { formatBadge } from '../../src/core/badge';

describe('formatBadge', () => {
  it('có estimate + log -> log/est, màu mặc định', () => {
    expect(formatBadge(6.5, 8)).toEqual({ text: '6.5/8', color: 'default' });
  });

  it('có estimate, chưa log -> 0/est', () => {
    expect(formatBadge(0, 8)).toEqual({ text: '0/8', color: 'default' });
  });

  it('có log, chưa estimate -> chỉ log (ẩn mẫu số)', () => {
    expect(formatBadge(6.5, null)).toEqual({ text: '6.5', color: 'default' });
  });

  it('trống cả hai -> null (không badge)', () => {
    expect(formatBadge(0, null)).toBeNull();
  });

  it('log vượt estimate -> màu cam', () => {
    expect(formatBadge(9, 8)).toEqual({ text: '9/8', color: 'orange' });
  });

  it('log đúng bằng estimate -> không cam', () => {
    expect(formatBadge(8, 8)).toEqual({ text: '8/8', color: 'default' });
  });
});
