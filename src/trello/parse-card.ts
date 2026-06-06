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
    const parsed: unknown = JSON.parse(pd.value);
    // Chỉ chấp nhận object thuần. null/number/array -> bỏ qua, không làm sập dashboard.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    raw = parsed as Record<string, unknown>;
  } catch {
    return null; // value hỏng JSON -> bỏ qua card
  }

  const est = raw.est;
  const estimate = typeof est === 'number' && Number.isFinite(est) && est > 0 ? est : null;
  const entries: LogEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(LOG_PREFIX)) continue;
    const memberId = key.slice(LOG_PREFIX.length);
    if (!memberId) continue; // key 'log_' không có memberId -> bỏ qua
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
