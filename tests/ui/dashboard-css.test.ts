import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const css = readFileSync('src/ui/dashboard.css', 'utf8');

function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match?.[1]) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

describe('dashboard responsive CSS', () => {
  test('contains wide tables inside each sheet on narrow iframes', () => {
    expect(ruleFor('.sheet')).toMatch(/overflow-x:\s*auto/);
  });

  test('lets breakdown bars shrink between label and value columns', () => {
    const rowRule = ruleFor('.bk-row');

    expect(rowRule).toMatch(/display:\s*grid/);
    expect(rowRule).toMatch(/grid-template-columns:\s*44px\s+minmax\(0,\s*1fr\)\s+max-content/);
    expect(ruleFor('.bk-bar')).toMatch(/max-width:\s*100%/);
  });
});
