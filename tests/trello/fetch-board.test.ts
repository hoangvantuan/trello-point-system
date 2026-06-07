// tests/trello/fetch-board.test.ts
import { describe, expect, it } from 'vitest';
import { collectAllRawCards, PAGE_LIMIT } from '../../src/trello/fetch-board';
import type { RawCard } from '../../src/trello/parse-card';

function page(n: number, prefix: string): RawCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`, idShort: i, name: '', idList: '', closed: false,
  }));
}

describe('collectAllRawCards', () => {
  it('một trang < limit -> không phân trang, không truncated', async () => {
    const res = await collectAllRawCards(() => Promise.resolve(page(10, 'x')));
    expect(res.cards.length).toBe(10);
    expect(res.truncated).toBe(false);
  });

  it('trang đầy = limit -> fetch tiếp với before = id card cuối', async () => {
    const pages = [page(PAGE_LIMIT, 'a'), page(2, 'b')];
    const befores: (string | null)[] = [];
    let call = 0;
    const res = await collectAllRawCards((before) => {
      befores.push(before);
      return Promise.resolve(pages[call++] ?? []);
    });
    expect(res.cards.length).toBe(PAGE_LIMIT + 2);
    expect(res.truncated).toBe(false);
    expect(befores).toEqual([null, `a${PAGE_LIMIT - 1}`]);
  });

  it('trang đầu rỗng -> trả mảng rỗng, không truncated', async () => {
    const res = await collectAllRawCards(() => Promise.resolve([]));
    expect(res.cards).toEqual([]);
    expect(res.truncated).toBe(false);
  });
});
