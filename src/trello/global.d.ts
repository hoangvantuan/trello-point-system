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

interface BoardButtonResult {
  text: string;
  icon?: { dark: string; light: string };
  condition?: string;
  callback?: (t: TrelloT) => void;
}

interface PowerUpOptions {
  appKey: string;
  appName: string;
}

interface PowerUp {
  initialize(
    capabilities: {
      'card-badges'?: (t: TrelloT) => Promise<BadgeResult[]>;
      'card-detail-badges'?: (t: TrelloT) => Promise<DetailBadgeResult[]>;
      'board-buttons'?: (t: TrelloT) => Promise<BoardButtonResult[]>;
    },
    options?: PowerUpOptions
  ): void;
}

declare global {
  interface Window {
    TrelloPowerUp: PowerUp;
  }
  const TrelloPowerUp: PowerUp;
}

export {};
