// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { renderByDocument, renderSlotsSection } from '../src/phasingScripts/phase2To3/wordPageEntry';

type Instance = { ref: string; lit: string; trad: string; litTargetOccurrence?: number };

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

  it('highlights only the selected repeated literal occurrence', () => {
    const repeatedLiteral = 'THE THRESHOLD OF THE GATE AND THE THRESHOLD ONE';
    const html = renderByDocument({
      noun: {
        grammarFull: 'Noun',
        grammarFn: 'Noun',
        totalInstances: 2,
        totalTranslations: 2,
        translations: {
          'THRESHOLD OF': {
            totalInstances: 1,
            instances: [{ ref: 'Ezk40:6.23', lit: repeatedLiteral, trad: 'threshold of the gate' }],
          },
          THRESHOLD: {
            totalInstances: 1,
            instances: [{ ref: 'Ezk40:6.31', lit: repeatedLiteral, trad: 'threshold one', litTargetOccurrence: 2 }],
          },
        },
      },
    });

    const secondInstance = html.split('<div class="ws-instance">').slice(1)[1];
    const secondLiteral = secondInstance.match(/<p class="ws-lit">(.*?)<\/p>/)?.[1] ?? '';
    expect((secondLiteral.match(/class="ws-target"/g) ?? []).length).toBe(1);
    expect(secondLiteral).toContain('AND THE <mark class="ws-target">THRESHOLD</mark> ONE');
  });
});
