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
  icon: { dark: string; light: string };
  condition?: string;
  callback?: (t: TrelloT) => void;
}

interface CardBackSectionResult {
  title: string;
  icon: string;
  content: {
    type: 'iframe';
    url: string;
    height: number;
  };
}

interface PowerUpOptions {
  appKey: string;
  appName: string;
}

interface PowerUp {
  iframe(options?: PowerUpOptions): TrelloT;
  initialize(
    capabilities: {
      'card-badges'?: (t: TrelloT) => Promise<BadgeResult[]>;
      'card-detail-badges'?: (t: TrelloT) => Promise<DetailBadgeResult[]>;
      'card-back-section'?: (t: TrelloT) => CardBackSectionResult;
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
