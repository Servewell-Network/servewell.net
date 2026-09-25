// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { renderByDocument, renderSlotsSection } from '../src/phasingScripts/phase2To3/wordPageEntry';

type Instance = { ref: string; lit: string; trad: string };

type Slot = {
  grammarFull: string;
  grammarFn: string;
  totalInstances: number;
  totalTranslations: number;
  translations: Record<string, { totalInstances: number; instances: Instance[] }>;
};

const instance = (ref: string): Instance => ({ ref, lit: `literal ${ref}`, trad: `traditional ${ref}` });

const slots: Record<string, Slot> = {
  first: {
    grammarFull: 'Noun',
    grammarFn: 'Noun',
    totalInstances: 3,
    totalTranslations: 1,
    translations: {
      JUDGMENT: {
        totalInstances: 3,
        instances: [instance('Zep2:3.11'), instance('Zep3:5.13'), instance('Zep3:8.17')],
      },
    },
  },
  second: {
    grammarFull: 'Noun',
    grammarFn: 'Noun',
    totalInstances: 1,
    totalTranslations: 1,
    translations: {
      JUDGMENT: {
        totalInstances: 1,
        instances: [instance('Zep3:15.3')],
      },
    },
  },
};

describe('word study document rendering', () => {
  it('does not duplicate instances after grammar rendering merges slots', () => {
    renderSlotsSection(slots, 4);
    const html = renderByDocument(slots);
    expect((html.match(/class="ws-instance"/g) ?? []).length).toBe(4);
  });
});
