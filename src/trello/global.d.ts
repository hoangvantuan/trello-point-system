import type { TrelloT } from './trello-types';

interface BadgeResult {
  text: string;
  color?: string;
}

interface DetailBadgeResult {
  title: string;
  text: string;
  callback: (t: TrelloT) => void;
}

interface PowerUp {
  initialize(capabilities: {
    'card-badges'?: (t: TrelloT) => Promise<BadgeResult[]>;
    'card-detail-badges'?: (t: TrelloT) => Promise<DetailBadgeResult[]>;
  }): void;
}

declare global {
  interface Window {
    TrelloPowerUp: PowerUp;
  }
  const TrelloPowerUp: PowerUp;
}

export {};
