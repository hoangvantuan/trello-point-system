import { decodeMemberLog, encodeMemberLog } from '../core/codec';
import { measureLength, MAX_CHARS } from '../core/capacity';
import type { DecodedMemberLog, Entry } from '../core/types';
import { SCHEMA_VERSION } from '../core/types';
import type { TrelloMember, TrelloT } from './trello-types';

const LOG_PREFIX = 'log_';

export interface CardData {
  estimate: number | null;
  logs: Record<string, DecodedMemberLog>; // memberId -> log
  usedChars: number; // độ dài hiện tại của toàn bộ object card+shared
  raw: Record<string, unknown>; // bản gốc để đo dung lượng khi thử ghi
}

export async function loadCard(t: TrelloT): Promise<CardData> {
  const raw = await t.get('card', 'shared');
  const estimate = typeof raw.est === 'number' ? raw.est : null;

  const logs: Record<string, DecodedMemberLog> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(LOG_PREFIX)) {
      const memberId = key.slice(LOG_PREFIX.length);
      logs[memberId] = decodeMemberLog(value);
    }
  }

  return { estimate, logs, usedChars: measureLength(raw), raw };
}

// Lỗi ném ra khi ghi vượt trần 4096 — UI bắt để hiện banner đỏ.
export class CapacityExceededError extends Error {
  constructor() {
    super('Card is full, delete old logs to continue');
    this.name = 'CapacityExceededError';
  }
}

// Đo trước khi ghi: thay key trong bản raw rồi đo lại. Vượt -> ném lỗi.
function assertFits(raw: Record<string, unknown>, key: string, value: unknown): void {
  const next = { ...raw, [key]: value };
  if (measureLength(next) > MAX_CHARS) throw new CapacityExceededError();
}

export async function saveEstimate(
  t: TrelloT,
  card: CardData,
  estimate: number | null
): Promise<void> {
  if (estimate === null) {
    await t.remove('card', 'shared', 'est');
    return;
  }
  assertFits(card.raw, 'est', estimate);
  await t.set('card', 'shared', 'est', estimate);
}

// Lấy log của chính member hiện tại (tạo mới nếu chưa có), làm tươi tên.
function ownLog(card: CardData, me: TrelloMember): DecodedMemberLog {
  const existing = card.logs[me.id];
  return {
    version: existing?.version ?? SCHEMA_VERSION,
    fullName: me.fullName, // làm tươi mỗi lần ghi
    username: me.username,
    entries: existing ? [...existing.entries] : [],
  };
}

async function writeOwnLog(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  log: DecodedMemberLog
): Promise<void> {
  const key = LOG_PREFIX + me.id;
  const value = encodeMemberLog(log);
  assertFits(card.raw, key, value);
  await t.set('card', 'shared', key, value);
}

export async function saveEntry(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  entry: Entry
): Promise<void> {
  const log = ownLog(card, me);
  log.entries.push(entry);
  await writeOwnLog(t, card, me, log);
}

export async function updateEntry(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  entryIndex: number,
  entry: Entry
): Promise<void> {
  const log = ownLog(card, me);
  log.entries[entryIndex] = entry;
  await writeOwnLog(t, card, me, log);
}

export async function deleteEntry(
  t: TrelloT,
  card: CardData,
  me: TrelloMember,
  entryIndex: number
): Promise<void> {
  const log = ownLog(card, me);
  log.entries.splice(entryIndex, 1);
  const key = LOG_PREFIX + me.id;
  if (log.entries.length === 0) {
    await t.remove('card', 'shared', key);
  } else {
    await t.set('card', 'shared', key, encodeMemberLog(log));
  }
}
