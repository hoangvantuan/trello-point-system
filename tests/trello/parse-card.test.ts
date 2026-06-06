// tests/trello/parse-card.test.ts
import { describe, expect, it } from 'vitest';
import { parseCard, type RawCard } from '../../src/trello/parse-card';

const PID = 'plugin-123';

function cardWith(value: string, overrides: Partial<RawCard> = {}): RawCard {
  return {
    id: 'c1', idShort: 7, name: 'Card', idList: 'L1', closed: false,
    pluginData: [{ idPlugin: PID, value }],
    ...overrides,
  };
}

describe('parseCard', () => {
  it('parse value JSON, phẳng hoá entries kèm member', () => {
    const value = JSON.stringify({
      est: 5,
      log_m1: { v: 1, n: 'Tuấn', u: 'tuanhv', e: [['2026-06-06', 3, 'fix']] },
    });
    expect(parseCard(cardWith(value), PID)).toEqual({
      id: 'c1', idShort: 7, name: 'Card', idList: 'L1', closed: false, estimate: 5,
      entries: [{ memberId: 'm1', fullName: 'Tuấn', date: '2026-06-06', point: 3 }],
    });
  });

  it('nhiều member -> gộp mọi entry', () => {
    const value = JSON.stringify({
      log_m1: { v: 1, n: 'Tuấn', u: 'tuanhv', e: [['2026-06-06', 3, '']] },
      log_m2: { v: 1, n: 'Mai', u: 'mai', e: [['2026-06-06', 1.5, '']] },
    });
    const out = parseCard(cardWith(value), PID);
    expect(out?.estimate).toBeNull();
    expect(out?.entries.length).toBe(2);
  });

  it('không có pluginData của plugin này -> null', () => {
    const c = cardWith('{}', { pluginData: [{ idPlugin: 'other', value: '{}' }] });
    expect(parseCard(c, PID)).toBeNull();
  });

  it('không có mảng pluginData -> null', () => {
    const c: RawCard = { id: 'c2', idShort: 8, name: 'x', idList: 'L1', closed: false };
    expect(parseCard(c, PID)).toBeNull();
  });

  it('value hỏng JSON -> null (không ném)', () => {
    expect(parseCard(cardWith('{not json'), PID)).toBeNull();
  });

  it('giữ closed/idList/idShort của card archive', () => {
    const value = JSON.stringify({ est: 2 });
    const out = parseCard(cardWith(value, { closed: true, idList: 'L9', idShort: 99 }), PID);
    expect(out).toMatchObject({ closed: true, idList: 'L9', idShort: 99, estimate: 2, entries: [] });
  });
});
