import type { AppModule } from './createModuleRegistry';

type PaneKind = 'literal' | 'traditional';
type PaneMode = PaneKind | 'both';

type BibleNavBook = {
  abbr?: string;
  name?: string;
};

type BibleNavData = {
  books?: BibleNavBook[];
};

const STYLE_ID = 'selection-control-style';

function getChapterPage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main.chapter-page');
}

function asElement(node: Node | null): Element | null {
  if (!node) return null;
  if (node instanceof Element) return node;
  return node.parentElement;
}

function getPaneKindFromElement(element: Element | null): PaneKind | null {
  if (!element) return null;
  const pane = element.closest('.snippet-pane');
  if (!(pane instanceof HTMLElement)) return null;
  if (pane.classList.contains('literal-pane')) return 'literal';
  if (pane.classList.contains('traditional-pane')) return 'traditional';
  return null;
}

function getPaneKindFromNode(node: Node | null): PaneKind | null {
  return getPaneKindFromElement(asElement(node));
}

function tokenMatchesPaneMode(token: Element, mode: PaneMode): boolean {
  if (mode === 'both') return true;
  return getPaneKindFromElement(token) === mode;
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseMetadata(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = decodePart(pair.slice(0, separatorIndex));
    const value = decodePart(pair.slice(separatorIndex + 1));
    result[key] = value;
  }
  return result;
}

function parseVerseLabelFromMid(mid: string): string | null {
  const colonIndex = mid.lastIndexOf(':');
  if (colonIndex < 0) return null;
  const afterColon = mid.slice(colonIndex + 1);
  const verseLabel = afterColon.split('.')[0]?.trim() ?? '';
  return verseLabel || null;
}

function getTokenVerseLabel(token: HTMLButtonElement): string | null {
  const metadata = parseMetadata(token.dataset.m ?? '');
  const mid = metadata.mid;
  if (mid) {
    const fromMid = parseVerseLabelFromMid(mid);
    if (fromMid) return fromMid;
  }

  const pane = token.closest('.snippet-pane');
  const paneVerse = pane?.querySelector('.verse-num')?.textContent?.trim();
  if (paneVerse) return paneVerse;

  const rowVerse = token.closest('.snippet-row')?.querySelector('.verse-num')?.textContent?.trim();
  return rowVerse || null;
}

function normalizeTokenText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function shouldInsertSpaceBeforeToken(token: string, existingText: string): boolean {
  if (/^[,.;:!?%\]\)]/.test(token)) return false;
  if (/[\[(]$/.test(existingText)) return false;
  return true;
}

function buildSelectionText(tokens: HTMLButtonElement[]): string {
  let result = '';

  for (const token of tokens) {
    const tokenText = normalizeTokenText(token.textContent ?? '');
    if (!tokenText) continue;

    if (result && shouldInsertSpaceBeforeToken(tokenText, result)) {
      result += ' ';
    }

    result += tokenText;
  }

  return result;
}

function buildTraditionalSelectionText(tokens: HTMLButtonElement[]): string {
  const groups: HTMLButtonElement[][] = [];
  let currentGroup: HTMLButtonElement[] = [];
  let currentPara: Element | null = null;

  for (const token of tokens) {
    const para = token.closest('.traditional-paragraph') ?? token.closest('.snippet-row') ?? null;
    if (para !== currentPara) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [];
      currentPara = para;
    }
    currentGroup.push(token);
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  return groups.map(buildSelectionText).join('\n\n');
}

function resolvePaneMode(selection: Selection): PaneMode {
  const beginPane = getPaneKindFromNode(selection.anchorNode);
  const endPane = getPaneKindFromNode(selection.focusNode);

  if (beginPane && endPane && beginPane === endPane) return beginPane;
  return 'both';
}

function getSelectedTokens(page: HTMLElement, selection: Selection, mode: PaneMode): HTMLButtonElement[] {
  if (selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);

  const tokens = Array.from(page.querySelectorAll<HTMLButtonElement>('button.word-token'));
  return tokens.filter((token) => {
    if (!tokenMatchesPaneMode(token, mode)) return false;
    try {
      return range.intersectsNode(token);
    } catch {
      return false;
    }
  });
}

function addPartialSuffix(verseLabel: string, suffix: 'a' | 'b'): string {
  if (/^\d+$/.test(verseLabel)) {
    return `${verseLabel}${suffix}`;
  }
  return verseLabel;
}

function getBookName(page: HTMLElement): string {
  const abbr = (page.dataset.book ?? '').trim();
  const fallback = abbr || 'Reference';

  const navDataScript = document.getElementById('bible-nav-data');
  if (!(navDataScript instanceof HTMLScriptElement)) return fallback;
  if (!navDataScript.textContent) return fallback;

  try {
    const parsed = JSON.parse(navDataScript.textContent) as BibleNavData;
    const books = Array.isArray(parsed.books) ? parsed.books : [];
    for (const book of books) {
      if (book.abbr === abbr && typeof book.name === 'string' && book.name.trim()) {
        return book.name.trim();
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function buildReferencePrefix(page: HTMLElement, selectedTokens: HTMLButtonElement[], mode: PaneMode): string | null {
  if (selectedTokens.length === 0) return null;

  const allTokensInMode = Array.from(page.querySelectorAll<HTMLButtonElement>('button.word-token')).filter((token) =>
    tokenMatchesPaneMode(token, mode)
  );

  const firstTokenByVerse = new Map<string, HTMLButtonElement>();
  const lastTokenByVerse = new Map<string, HTMLButtonElement>();
  for (const token of allTokensInMode) {
    const verseLabel = getTokenVerseLabel(token);
    if (!verseLabel) continue;
    if (!firstTokenByVerse.has(verseLabel)) {
      firstTokenByVerse.set(verseLabel, token);
    }
    lastTokenByVerse.set(verseLabel, token);
  }

  const firstSelected = selectedTokens[0];
  const lastSelected = selectedTokens[selectedTokens.length - 1];
  const startVerse = getTokenVerseLabel(firstSelected);
  const endVerse = getTokenVerseLabel(lastSelected);
  const chapterLabel = (page.dataset.chapter ?? '').trim();
  const bookName = getBookName(page);

  if (!startVerse || !endVerse || !chapterLabel) return null;

  const verseStartToken = firstTokenByVerse.get(startVerse);
  const verseEndToken = lastTokenByVerse.get(endVerse);
  const startPartial = !!verseStartToken && verseStartToken !== firstSelected;
  const endPartial = !!verseEndToken && verseEndToken !== lastSelected;

  let verseRangeLabel = '';
  if (startVerse === endVerse) {
    if (startPartial && !endPartial) {
      verseRangeLabel = addPartialSuffix(startVerse, 'b');
    } else if (!startPartial && endPartial) {
      verseRangeLabel = addPartialSuffix(startVerse, 'a');
    } else if (startPartial && endPartial) {
      verseRangeLabel = addPartialSuffix(startVerse, 'b');
    } else {
      verseRangeLabel = startVerse;
    }
  } else {
    const startLabel = startPartial ? addPartialSuffix(startVerse, 'b') : startVerse;
    const endLabel = endPartial ? addPartialSuffix(endVerse, 'a') : endVerse;
    verseRangeLabel = `${startLabel}-${endLabel}`;
  }

  return `${bookName} ${chapterLabel}:${verseRangeLabel}`;
}

function buildBothPanesSectionText(page: HTMLElement, selection: Selection): string | null {
  function groupByRow(tokens: HTMLButtonElement[]): HTMLButtonElement[][] {
    const rowMap = new Map<Element, HTMLButtonElement[]>();
    for (const token of tokens) {
      const row = token.closest('.snippet-row');
      if (!row) continue;
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push(token);
    }
    return Array.from(rowMap.values());
  }

  const literalGroups = groupByRow(getSelectedTokens(page, selection, 'literal'));
  const traditionalGroups = groupByRow(getSelectedTokens(page, selection, 'traditional'));

  if (literalGroups.length === 0 && traditionalGroups.length === 0) return null;

  const sections: string[] = [];

  if (literalGroups.length > 0) {
    sections.push('LITERAL\n' + literalGroups.map(buildSelectionText).join('\n\n'));
  }

  if (traditionalGroups.length > 0) {
    sections.push('TRADITIONAL\n' + traditionalGroups.map((g) => buildTraditionalSelectionText(g)).join('\n\n'));
  }

  return sections.join('\n\n');
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.chapter-page.selection-lock-literal .traditional-pane,
.chapter-page.selection-lock-traditional .literal-pane {
  user-select: none;
  -webkit-user-select: none;
}

.chapter-page .word-token {
  user-select: text;
  -webkit-user-select: text;
}
`;
  document.head.appendChild(style);
}

export function createSelectionControlModule(): AppModule {
  let page: HTMLElement | null = null;
  let pointerId: number | null = null;
  let startPane: PaneKind | null = null;
  let lastPointerClientX: number | null = null;

  const disposers: Array<() => void> = [];

  function setLockedPane(pane: PaneKind | null) {
    if (!page) return;
    page.classList.toggle('selection-lock-literal', pane === 'literal');
    page.classList.toggle('selection-lock-traditional', pane === 'traditional');
  }

  function resetGestureState() {
    pointerId = null;
    startPane = null;
    window.setTimeout(() => setLockedPane(null), 0);
  }

  function onPointerDown(event: PointerEvent) {
    if (!page) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!(event.target instanceof Node)) return;
    if (!page.contains(event.target)) return;

    pointerId = event.pointerId;
    startPane = getPaneKindFromNode(event.target);
    lastPointerClientX = event.clientX;
    setLockedPane(startPane);
  }

  function onPointerMove(event: PointerEvent) {
    if (!page) return;
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (!(event.target instanceof Node)) return;
    if (!page.contains(event.target)) return;

    lastPointerClientX = event.clientX;

    const hoverPane = getPaneKindFromNode(event.target);
    if (startPane && hoverPane && hoverPane !== startPane) {
      setLockedPane(null);
      return;
    }

    if (!startPane && hoverPane) {
      setLockedPane(hoverPane);
    }
  }

  function onPointerUpOrCancel(event: PointerEvent) {
    if (pointerId === null) return;
    if (event.pointerId !== pointerId) return;
    lastPointerClientX = event.clientX;
    resetGestureState();
  }

  function onWindowBlur() {
    resetGestureState();
  }

  function onCopy(event: ClipboardEvent) {
    if (!page) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!page.contains(range.commonAncestorContainer)) return;

    let paneMode = resolvePaneMode(selection);

    // If DOM node walking resolved a single pane but the pointer x-position
    // is on the opposite side (common when dragging upward), trust the x position.
    if (paneMode !== 'both' && lastPointerClientX !== null && window.innerWidth > 0) {
      const xPane: PaneKind = lastPointerClientX > window.innerWidth / 2 ? 'traditional' : 'literal';
      if (xPane !== paneMode) {
        paneMode = xPane;
      }
    }

    if (paneMode === 'both') {
      const beginPane = getPaneKindFromNode(selection.anchorNode);
      const endPane = getPaneKindFromNode(selection.focusNode);
      if (!beginPane || !endPane || beginPane === endPane) return;

      const allTokens = getSelectedTokens(page, selection, 'both');
      if (allTokens.length === 0) return;

      const prefix = buildReferencePrefix(page, allTokens, 'both');
      const bodyText = buildBothPanesSectionText(page, selection);
      if (!prefix && !bodyText) return;

      const payload = prefix
        ? (bodyText ? `${prefix}\n${bodyText}` : prefix)
        : bodyText ?? '';
      if (!payload) return;

      event.preventDefault();
      event.clipboardData?.setData('text/plain', payload);
      return;
    }

    const selectedTokens = getSelectedTokens(page, selection, paneMode);
    if (selectedTokens.length === 0) return;

    const prefix = buildReferencePrefix(page, selectedTokens, paneMode);
    const bodyText = paneMode === 'traditional'
      ? buildTraditionalSelectionText(selectedTokens)
      : buildSelectionText(selectedTokens);
    if (!prefix && !bodyText) return;

    const payload = prefix
      ? (bodyText ? `${prefix}\n${bodyText}` : prefix)
      : bodyText;
    if (!payload) return;

    event.preventDefault();
    event.clipboardData?.setData('text/plain', payload);
  }

  return {
    id: 'selection-control',
    label: 'Selection Control',
    active: false,
    includeInMenu: false,
    activate() {
      if (this.active) return;

      page = getChapterPage();
      if (!page) return;

      this.active = true;
      ensureStyle();

      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('pointermove', onPointerMove, true);
      document.addEventListener('pointerup', onPointerUpOrCancel, true);
      document.addEventListener('pointercancel', onPointerUpOrCancel, true);
      document.addEventListener('copy', onCopy, true);
      window.addEventListener('blur', onWindowBlur);

      disposers.push(() => document.removeEventListener('pointerdown', onPointerDown, true));
      disposers.push(() => document.removeEventListener('pointermove', onPointerMove, true));
      disposers.push(() => document.removeEventListener('pointerup', onPointerUpOrCancel, true));
      disposers.push(() => document.removeEventListener('pointercancel', onPointerUpOrCancel, true));
      disposers.push(() => document.removeEventListener('copy', onCopy, true));
      disposers.push(() => window.removeEventListener('blur', onWindowBlur));
    },
    deactivate() {
      if (!this.active) return;
      this.active = false;

      while (disposers.length > 0) {
        disposers.pop()?.();
      }

      setLockedPane(null);
      pointerId = null;
      startPane = null;
      lastPointerClientX = null;
      page = null;
    }
  };
}