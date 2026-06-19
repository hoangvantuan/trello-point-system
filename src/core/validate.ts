export type ValidationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

const MAX_POINT = 100;
const MAX_DECIMALS = 3;

// Số chữ số thập phân tối đa: nhân 10^N rồi so với số nguyên gần nhất.
// Né nhiễu float bằng epsilon nhỏ trước khi so sánh.
function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

// Kiểm tra point: rỗng / NaN / <=0 / >100 / quá 3 chữ số thập phân đều bị chặn.
export function validatePoint(input: string): ValidationResult {
  const s = input.trim();
  if (s === '') return { ok: false, error: 'Enter a point value' };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Point must be a number' };
  if (value <= 0) return { ok: false, error: 'Point must be greater than 0' };
  if (value > MAX_POINT) return { ok: false, error: `Point max is ${MAX_POINT}` };

  if (!hasAtMostDecimals(value, MAX_DECIMALS)) {
    return { ok: false, error: `Point allows at most ${MAX_DECIMALS} decimal places` };
  }

  return { ok: true, value };
}

export type DateValidationResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Kiểm tra ngày: đúng định dạng YYYY-MM-DD và không vượt quá hôm nay.
export function validateDate(input: string, today: string): DateValidationResult {
  if (!DATE_RE.test(input)) {
    return { ok: false, error: 'Date must be YYYY-MM-DD' };
  }
  if (input > today) {
    return { ok: false, error: 'Cannot log a future date' };
  }
  return { ok: true };
}

export type EstimateValidationResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

// Estimate tùy chọn: rỗng -> null (xóa). Có số: >0, <=100.
export function validateEstimate(input: string): EstimateValidationResult {
  const s = input.trim();
  if (s === '') return { ok: true, value: null };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: 'Estimate must be a number' };
  if (value <= 0) return { ok: false, error: 'Estimate must be greater than 0' };
  if (value > 100) return { ok: false, error: 'Estimate max is 100' };

  if (!hasAtMostDecimals(value, MAX_DECIMALS)) {
    return { ok: false, error: `Estimate allows at most ${MAX_DECIMALS} decimal places` };
  }

  return { ok: true, value };
}
