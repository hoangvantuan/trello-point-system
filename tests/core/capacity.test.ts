import { describe, expect, it } from 'vitest';
import { capacityInfo, measureLength } from '../../src/core/capacity';

describe('measureLength', () => {
  it('đo độ dài JSON.stringify của object', () => {
    expect(measureLength({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
  });
});

describe('capacityInfo', () => {
  it('tính % làm tròn và used/max', () => {
    const info = capacityInfo(2510);
    expect(info.used).toBe(2510);
    expect(info.max).toBe(4096);
    expect(info.percent).toBe(61);
  });

  it('mức ok khi dưới 80%', () => {
    expect(capacityInfo(3276).level).toBe('ok');
  });

  it('mức warn (vàng) từ 3277', () => {
    expect(capacityInfo(3277).level).toBe('warn');
    expect(capacityInfo(3767).level).toBe('warn');
  });

  it('mức danger (đỏ) từ 3768', () => {
    expect(capacityInfo(3768).level).toBe('danger');
    expect(capacityInfo(4096).level).toBe('danger');
  });
});
