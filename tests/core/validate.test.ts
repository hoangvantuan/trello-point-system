import { describe, expect, it } from 'vitest';
import { validatePoint } from '../../src/core/validate';

describe('validatePoint', () => {
  it('nhận số hợp lệ nguyên', () => {
    expect(validatePoint('3')).toEqual({ ok: true, value: 3 });
  });

  it('nhận số 1 chữ số thập phân', () => {
    expect(validatePoint('1.5')).toEqual({ ok: true, value: 1.5 });
  });

  it('cắt khoảng trắng hai đầu', () => {
    expect(validatePoint('  2  ')).toEqual({ ok: true, value: 2 });
  });

  it('chặn rỗng', () => {
    const r = validatePoint('');
    expect(r.ok).toBe(false);
  });

  it('chặn không phải số', () => {
    expect(validatePoint('abc').ok).toBe(false);
  });

  it('chặn số 0', () => {
    expect(validatePoint('0').ok).toBe(false);
  });

  it('chặn số âm', () => {
    expect(validatePoint('-2').ok).toBe(false);
  });

  it('chặn > 100', () => {
    expect(validatePoint('100.5').ok).toBe(false);
  });

  it('nhận đúng 100', () => {
    expect(validatePoint('100')).toEqual({ ok: true, value: 100 });
  });

  it('chặn quá 1 chữ số thập phân', () => {
    expect(validatePoint('1.25').ok).toBe(false);
  });
});

import { validateDate } from '../../src/core/validate';

describe('validateDate', () => {
  const today = '2026-06-06';

  it('nhận ngày hôm nay', () => {
    expect(validateDate('2026-06-06', today)).toEqual({ ok: true });
  });

  it('nhận ngày quá khứ bất kỳ', () => {
    expect(validateDate('2020-01-01', today)).toEqual({ ok: true });
  });

  it('chặn ngày tương lai', () => {
    expect(validateDate('2026-06-07', today).ok).toBe(false);
  });

  it('chặn định dạng sai', () => {
    expect(validateDate('06/06/2026', today).ok).toBe(false);
    expect(validateDate('', today).ok).toBe(false);
    expect(validateDate('2026-6-6', today).ok).toBe(false);
  });
});

import { validateEstimate } from '../../src/core/validate';

describe('validateEstimate', () => {
  it('rỗng nghĩa là xóa estimate (value null)', () => {
    expect(validateEstimate('')).toEqual({ ok: true, value: null });
    expect(validateEstimate('   ')).toEqual({ ok: true, value: null });
  });

  it('nhận số hợp lệ', () => {
    expect(validateEstimate('8')).toEqual({ ok: true, value: 8 });
    expect(validateEstimate('2.5')).toEqual({ ok: true, value: 2.5 });
  });

  it('chặn âm', () => {
    expect(validateEstimate('-1').ok).toBe(false);
  });

  it('chặn 0', () => {
    expect(validateEstimate('0').ok).toBe(false);
  });

  it('chặn > 100', () => {
    expect(validateEstimate('101').ok).toBe(false);
  });

  it('chặn không phải số', () => {
    expect(validateEstimate('abc').ok).toBe(false);
  });
});
