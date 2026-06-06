import type { DecodedMemberLog, Entry, MemberLog } from './types';
import { SCHEMA_VERSION } from './types';

export function encodeMemberLog(log: DecodedMemberLog): MemberLog {
  return {
    v: log.version,
    n: log.fullName,
    u: log.username,
    e: log.entries.map((en) => [en.date, en.point, en.comment]),
  };
}

function decodeEntry(raw: unknown): Entry | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const [date, point, comment] = raw;
  if (typeof date !== 'string') return null;
  if (typeof point !== 'number' || !Number.isFinite(point)) return null;
  if (typeof comment !== 'string') return null;
  return { date, point, comment };
}

// Phòng thủ: dữ liệu pluginData có thể hỏng/thiếu. Không tin, điền mặc định.
export function decodeMemberLog(raw: unknown): DecodedMemberLog {
  const obj = (raw ?? {}) as Partial<MemberLog>;
  const rawEntries = Array.isArray(obj.e) ? obj.e : [];
  const entries: Entry[] = [];
  for (const r of rawEntries) {
    const e = decodeEntry(r);
    if (e) entries.push(e);
  }
  return {
    version: typeof obj.v === 'number' ? obj.v : SCHEMA_VERSION,
    fullName: typeof obj.n === 'string' ? obj.n : '',
    username: typeof obj.u === 'string' ? obj.u : '',
    entries,
  };
}
