export const MAX_CHARS = 4096;
const WARN_AT = 3277; // ceil(4096 * 0.80)
const DANGER_AT = 3768; // ceil(4096 * 0.92)

export type CapacityLevel = 'ok' | 'warn' | 'danger';

export interface CapacityInfo {
  used: number;
  max: number;
  percent: number; // làm tròn để hiển thị
  level: CapacityLevel;
}

export function measureLength(obj: unknown): number {
  return JSON.stringify(obj).length;
}

export function capacityInfo(used: number): CapacityInfo {
  let level: CapacityLevel = 'ok';
  if (used >= DANGER_AT) level = 'danger';
  else if (used >= WARN_AT) level = 'warn';

  return {
    used,
    max: MAX_CHARS,
    percent: Math.round((used / MAX_CHARS) * 100),
    level,
  };
}
