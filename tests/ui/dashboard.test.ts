import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest';
import { APP_KEY, APP_NAME } from '../../src/config';

interface FakeElement {
  className: string;
  dataset: Record<string, string>;
  textContent: string;
  onclick?: () => void;
  classList: { toggle: ReturnType<typeof vi.fn> };
  appendChild: ReturnType<typeof vi.fn>;
}

function fakeElement(dataset: Record<string, string> = {}): FakeElement {
  return {
    className: '',
    dataset,
    textContent: '',
    classList: { toggle: vi.fn() },
    appendChild: vi.fn(),
  };
}

describe('dashboard Trello iframe', () => {
  let iframe: Mock<[options?: unknown], unknown>;
  let getRestApi: Mock<[], unknown>;
  let getToken: Mock<[], Promise<null>>;
  let restApi: { getToken: Mock<[], Promise<null>> };

  beforeEach(() => {
    vi.resetModules();

    const elements = new Map<string, FakeElement>();
    for (const id of [
      'filters',
      'refresh',
      'authorize',
      'retry',
      'error-msg',
      'state-auth',
      'state-empty',
      'state-error',
      'state-loading',
      'content',
    ]) {
      elements.set(id, fakeElement());
    }

    const tabs = [fakeElement({ tab: 'list' }), fakeElement({ tab: 'user' })];
    getToken = vi.fn<[], Promise<null>>().mockResolvedValue(null);
    restApi = { getToken };
    getRestApi = vi.fn<[], unknown>(() => restApi);
    iframe = vi.fn<[options?: unknown], unknown>(() => ({ getRestApi }));

    vi.stubGlobal('window', { TrelloPowerUp: { iframe } });
    vi.stubGlobal('document', {
      createElement: () => fakeElement(),
      getElementById: (id: string) => elements.get(id) ?? null,
      querySelectorAll: (selector: string) => (selector === '#tabs .tab' ? tabs : []),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('passes app identity to TrelloPowerUp.iframe before using REST API', async () => {
    await import('../../src/ui/dashboard');

    expect(iframe).toHaveBeenCalledWith({
      appKey: APP_KEY,
      appName: APP_NAME,
    });
  });

  test('supports async getRestApi from Trello client', async () => {
    getRestApi.mockResolvedValue(restApi);

    await import('../../src/ui/dashboard');
    await Promise.resolve();
    await Promise.resolve();

    expect(getToken).toHaveBeenCalledOnce();
  });
});
