import { APP_KEY, APP_NAME } from './config';
import { formatBadge } from './core/badge';
import { sumEntries } from './core/totals';
import { loadCard } from './trello/storage';
import type { TrelloT } from './trello/trello-types';

const ICON = '🎯';
const DASHBOARD_BUTTON_ICON = {
  dark: new URL('/icons/dashboard-light.svg', globalThis.location.origin).toString(),
  light: new URL('/icons/dashboard-dark.svg', globalThis.location.origin).toString(),
};

async function computeBadgeText(t: TrelloT): Promise<string | null> {
  const card = await loadCard(t);
  const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
  const badge = formatBadge(logged, card.estimate);
  return badge ? badge.text : null;
}

TrelloPowerUp.initialize(
  {
    'card-badges': async (t) => {
      const card = await loadCard(t);
      const logged = sumEntries(Object.values(card.logs).flatMap((l) => l.entries));
      const badge = formatBadge(logged, card.estimate);
      if (!badge) return [];
      return [
        {
          text: `${ICON} ${badge.text}`,
          color: badge.color === 'orange' ? 'orange' : undefined,
        },
      ];
    },

    'card-detail-badges': async (t) => {
      const text = await computeBadgeText(t);
      return [
        {
          title: 'Point',
          text: text ? `Log point · ${text}` : 'Log point',
          callback: (t2: TrelloT) => {
            t2.modal?.({
              title: 'Point System',
              url: './popup.html',
              fullscreen: false,
              height: 560,
            });
          },
        },
      ];
    },

    'board-buttons': async () => [
      {
        text: 'Point Stats',
        icon: DASHBOARD_BUTTON_ICON,
        condition: 'edit', // chỉ member có quyền edit board mới thấy
        callback: (t: TrelloT) => {
          t.modal?.({
            title: 'Point Stats Dashboard',
            url: './dashboard.html',
            fullscreen: false,
            height: 600,
          });
        },
      },
    ],
  },
  { appKey: APP_KEY, appName: APP_NAME }
);
