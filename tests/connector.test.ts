import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { TrelloT } from '../src/trello/trello-types';

interface TestBoardButton {
  text: string;
  icon: { dark: string; light: string };
  condition?: string;
  callback?: (t: TrelloT) => void;
}

interface TestCardBackSection {
  title: string;
  icon: string;
  content: { type: string; url: string; height: number };
}

interface TestCapabilities {
  'card-back-section'?: (t: TrelloT) => TestCardBackSection;
  'board-buttons'?: (t: TrelloT) => Promise<TestBoardButton[]>;
}

describe('connector board button', () => {
  let capabilities: TestCapabilities | undefined;

  beforeEach(() => {
    vi.resetModules();
    capabilities = undefined;
    vi.stubGlobal('location', { origin: 'https://powerup.example' });
    vi.stubGlobal('TrelloPowerUp', {
      initialize: (registered: TestCapabilities) => {
        capabilities = registered;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('registers card-back-section with correct shape', async () => {
    await import('../src/connector');

    const section = capabilities?.['card-back-section']?.({} as TrelloT);

    expect(section).toMatchObject({
      title: '🎯 Point',
      icon: 'https://powerup.example/icons/target-dark.svg',
      content: {
        type: 'iframe',
        url: './card-section.html',
        height: 130,
      },
    });
  });

  test('registers dashboard board button with Trello icons', async () => {
    await import('../src/connector');

    const buttons = await capabilities?.['board-buttons']?.({} as TrelloT);

    expect(buttons).toHaveLength(1);
    const button = buttons?.[0];
    expect(button).toBeDefined();
    if (!button) return;

    expect(button).toMatchObject({
      text: 'Point Stats',
      icon: {
        dark: 'https://powerup.example/icons/dashboard-light.svg',
        light: 'https://powerup.example/icons/dashboard-dark.svg',
      },
      condition: 'edit',
    });

    const modal = vi.fn();
    button.callback?.({ modal } as unknown as TrelloT);

    expect(modal).toHaveBeenCalledWith({
      title: 'Point Stats Dashboard',
      url: './dashboard.html',
      fullscreen: false,
      height: 600,
    });
  });
});
