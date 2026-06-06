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
