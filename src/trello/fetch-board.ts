// src/trello/fetch-board.ts
import type { CardStat } from '../core/stats-types';
import { parseCard, type RawCard } from './parse-card';
import type { TrelloRestApi } from './trello-types';

export const PAGE_LIMIT = 1000;
const FIELDS = 'id,idShort,name,idList,closed';
const API = 'https://api.trello.com/1';

// Lỗi khi token bị thu hồi (HTTP 401). UI bắt để mời authorize lại.
export class UnauthorizedError extends Error {
  constructor() {
    super('Token revoked, please re-authorize');
    this.name = 'UnauthorizedError';
  }
}

export interface BoardStats {
  cards: CardStat[];
  lists: { id: string; name: string }[];
  truncated: boolean; // true = nghi ngờ chưa lấy đủ card
}

// Gom mọi trang card. fetchPage nhận `before` (id card cuối trang trước, null cho trang đầu).
// THUẦN với fetchPage được tiêm vào -> test được không cần network.
export async function collectAllRawCards(
  fetchPage: (before: string | null) => Promise<RawCard[]>
): Promise<{ cards: RawCard[]; truncated: boolean }> {
  const all: RawCard[] = [];
  let before: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const pageCards = await fetchPage(before);
    all.push(...pageCards);
    if (pageCards.length < PAGE_LIMIT) return { cards: all, truncated: false };
    const last = pageCards[pageCards.length - 1];
    if (!last) return { cards: all, truncated: false };
    before = last.id;
  }
  return { cards: all, truncated: true }; // chạm guard 50 trang -> nghi thiếu
}

// IO: authorize lazy + bulk fetch cards (filter=all gồm archive) + lists (filter=open) -> CardStat[].
export async function fetchBoardStats(
  restApi: TrelloRestApi,
  boardId: string,
  pluginId: string,
  appKey: string
): Promise<BoardStats> {
  let token = await restApi.getToken();
  if (!token) {
    token = await restApi.authorize({ scope: 'read', expiration: 'never' });
  }
  const auth = `key=${appKey}&token=${token}`;

  const fetchPage = async (before: string | null): Promise<RawCard[]> => {
    const beforeParam = before ? `&before=${encodeURIComponent(before)}` : '';
    const url =
      `${API}/boards/${encodeURIComponent(boardId)}/cards?filter=all&pluginData=true` +
      `&fields=${FIELDS}&limit=${PAGE_LIMIT}${beforeParam}&${auth}`;
    const res = await fetch(url);
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(`Failed to load cards (HTTP ${res.status})`);
    return (await res.json()) as RawCard[];
  };

  const { cards: rawCards, truncated } = await collectAllRawCards(fetchPage);

  const listRes = await fetch(`${API}/boards/${encodeURIComponent(boardId)}/lists?filter=open&fields=id,name&${auth}`);
  if (listRes.status === 401) throw new UnauthorizedError();
  if (!listRes.ok) throw new Error(`Failed to load lists (HTTP ${listRes.status})`);
  const lists = (await listRes.json()) as { id: string; name: string }[];

  const cards = rawCards
    .map((c) => parseCard(c, pluginId))
    .filter((c): c is CardStat => c !== null);

  return { cards, lists, truncated };
}
