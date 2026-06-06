import { formatBadge } from './core/badge';
import { sumEntries } from './core/totals';
import { loadCard } from './trello/storage';
import type { TrelloT } from './trello/trello-types';

const ICON = '🎯';

async function computeBadgeText(t: TrelloT): Promise<string | null> {
  const card = await loadCard(t);
  const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
  const badge = formatBadge(logged, card.estimate);
  return badge ? badge.text : null;
}

TrelloPowerUp.initialize({
  'card-badges': async (t) => {
    const card = await loadCard(t);
    const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
    const badge = formatBadge(logged, card.estimate);
    if (!badge) return [];
    return [{ text: `${ICON} ${badge.text}`, color: badge.color === 'orange' ? 'orange' : undefined }];
  },

  'card-detail-badges': async (t) => {
    const text = await computeBadgeText(t);
    return [
      {
        title: 'Point',
        text: text ? `Log point · ${text}` : 'Log point',
        callback: (t2: TrelloT) => {
          (t2 as unknown as { popup: (o: object) => void }).popup({
            title: 'Point System',
            url: './popup.html',
            height: 480,
          });
        },
      },
    ];
  },
});
