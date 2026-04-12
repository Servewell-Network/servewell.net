import type { AppModule } from './createModuleRegistry';

// 10 perceptually-distinct semi-transparent colors.
// Same morpheme ID in both panes → same color, so cross-pane matching is visual.
const TRANSLIT_COLORS = [
  'rgba(220,  60,  60, 0.28)',  // red
  'rgba(225, 140,  30, 0.30)',  // orange
  'rgba(195, 175,  10, 0.38)',  // yellow
  'rgba( 40, 170,  70, 0.28)',  // green
  'rgba( 20, 180, 165, 0.28)',  // teal
  'rgba( 55, 130, 240, 0.30)',  // blue
  'rgba(145,  65, 240, 0.28)',  // purple
  'rgba(225,  50, 175, 0.28)',  // pink
  'rgba(155,  95,  35, 0.32)',  // brown
  'rgba(120, 185,  20, 0.32)',  // lime
];

const STYLE_ID = 'translit-module-style';

function decodePart(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseDataM(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const sep = pair.indexOf('=');
    if (sep < 0) continue;
    result[decodePart(pair.slice(0, sep))] = decodePart(pair.slice(sep + 1));
  }
  return result;
}

function applyTransliterations(): void {
  document.querySelectorAll<HTMLElement>('.snippet-row').forEach((snippetRow) => {
    // Assign color indices in literal-pane morpheme order so that the same
    // morpheme ID always resolves to the same color in both panes.
    const colorMap = new Map<string, string>();
    let colorCounter = 0;

    snippetRow.querySelectorAll<HTMLButtonElement>('.literal-pane .word-token').forEach((btn) => {
      const mid = parseDataM(btn.dataset.m ?? '')['mid'];
      if (mid && !colorMap.has(mid)) {
        colorMap.set(mid, TRANSLIT_COLORS[colorCounter % TRANSLIT_COLORS.length]);
        colorCounter++;
      }
    });

    // Inject a .word-translit span into every word-wrap that has transliteration data.
    snippetRow.querySelectorAll<HTMLButtonElement>('.word-token').forEach((btn) => {
      const wrap = btn.parentElement;
      if (!wrap) return;

      const meta = parseDataM(btn.dataset.m ?? '');
      const translit = meta['tr'];
      if (!translit) return;

      const mid = meta['mid'];
      const color = mid ? (colorMap.get(mid) ?? '') : '';

      const span = document.createElement('span');
      span.className = 'word-translit';
      if (color) span.style.background = color;
      span.textContent = translit;
      wrap.appendChild(span);
    });
  });
}

function removeTransliterations(): void {
  document.querySelectorAll('.word-translit').forEach((el) => el.remove());
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Transliteration module */
.show-translit .word-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: top;
  gap: 2px;
}
.word-translit {
  font-size: 0.65em;
  color: var(--muted);
  border-radius: 3px;
  padding: 0 4px 1px;
  line-height: 1.4;
  white-space: nowrap;
  display: block;
}
`;
  document.head.appendChild(style);
}

export function createTransliterationModule(): AppModule {
  const isChapterPage = !!document.querySelector('main.chapter-page');

  return {
    id: 'transliteration',
    label: 'Transliteration interlinear',
    infoHref: '/features#need-interlinear',
    active: false,
    includeInMenu: isChapterPage,
    activate() {
      this.active = true;
      ensureStyle();
      applyTransliterations();
      document.documentElement.classList.add('show-translit');
    },
    deactivate() {
      this.active = false;
      document.documentElement.classList.remove('show-translit');
      removeTransliterations();
    }
  };
}
