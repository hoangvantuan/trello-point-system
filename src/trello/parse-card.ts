// src/trello/parse-card.ts
import { decodeMemberLog } from '../core/codec';
import type { CardStat, LogEntry } from '../core/stats-types';

const LOG_PREFIX = 'log_';

// Hình dạng tối thiểu của 1 card trong REST response (chỉ field ta yêu cầu + pluginData).
export interface RawCard {
  id: string;
  idShort: number;
  name: string;
  idList: string;
  closed: boolean;
  pluginData?: Array<{ idPlugin: string; value: string }>;
}

// Parse 1 card REST -> CardStat. Trả null nếu không có pluginData của Power-Up này (hoặc value hỏng).
export function parseCard(card: RawCard, pluginId: string): CardStat | null {
  const pd = (card.pluginData ?? []).find((p) => p.idPlugin === pluginId);
  if (!pd) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(pd.value) as Record<string, unknown>;
  } catch {
    return null; // value hỏng -> bỏ qua card, không làm sập dashboard
  }

  const estimate = typeof raw.est === 'number' ? raw.est : null;
  const entries: LogEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(LOG_PREFIX)) continue;
    const memberId = key.slice(LOG_PREFIX.length);
    const log = decodeMemberLog(value); // tái dùng codec phòng thủ
    for (const e of log.entries) {
      entries.push({ memberId, fullName: log.fullName, date: e.date, point: e.point });
    }
  }

  return {
    id: card.id,
    idShort: card.idShort,
    name: card.name,
    idList: card.idList,
    closed: card.closed,
    estimate,
    entries,
  };
}
