export type ValidationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

const MAX_POINT = 100;

// Kiểm tra point: rỗng / NaN / <=0 / >100 / quá 1 chữ số thập phân đều bị chặn.
export function validatePoint(input: string): ValidationResult {
  const s = input.trim();
  if (s === '') return { ok: false, error: 'Nhập số point' };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Point phải là số' };
  if (value <= 0) return { ok: false, error: 'Point phải lớn hơn 0' };
  if (value > MAX_POINT) return { ok: false, error: `Point tối đa ${MAX_POINT}` };

  if (Math.round(value * 10) !== value * 10) {
    return { ok: false, error: 'Point tối đa 1 chữ số thập phân' };
  }

  return { ok: true, value };
}
