/**
 * wordPageEntry.ts
 *
 * Standalone browser entry point for word study pages on words.servewell.net.
 * Bundled separately from the main app shell (build:servewell-word-page).
 *
 * Reads the JSON island in #ws-data, renders the full word study UI into
 * #ws-render, and removes the raw-data fallback section from the visible area.
 */

// ---------------------------------------------------------------------------
// Types (mirror generateWordStudyHtml.ts interfaces)
// ---------------------------------------------------------------------------

interface InstanceEntry { ref: string; lit: string; trad: string; }
interface TranslationOut { totalInstances: number; instances: InstanceEntry[]; }
interface SlotOut {
  grammarFull: string; grammarFn: string;
  totalInstances: number; totalTranslations: number;
  translations: Record<string, TranslationOut>;
}
interface MetaOut {
  wordKey: string; fileNumber: number;
  strongsId: string; lang: string; lemma: string;
  rootTranslation?: string; transliteration?: string; totalInstances: number; totalSlots: number;
}
interface AncientWordOut { _meta: MetaOut; overflow?: Record<string, string>; slots: Record<string, SlotOut>; }
interface RelatedEntry { fileName: string; strongsId: string; lang: string; lemma: string; rootTranslation?: string; }
interface CrossRefEntry { fileName: string; wordKey: string; strongsId: string; lang: string; lemma: string; rootTranslation?: string; }
interface MainWordFile { relatedFiles?: RelatedEntry[]; crossRefs?: CrossRefEntry[]; ancientWord: AncientWordOut; }
interface OverflowFile { type: 'overflow'; overflowFrom: string; label: string; ancientWord: AncientWordOut; }

// ---------------------------------------------------------------------------
// Book maps (mirrors generateWordStudyHtml.ts)
// ---------------------------------------------------------------------------

const BOOK_TO_DISPLAY_NAME: Record<string, string> = {
  Gen: 'Genesis', Exo: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deu: 'Deuteronomy',
  Jos: 'Joshua', Jdg: 'Judges', Rut: 'Ruth',
  '1Sa': '1 Samuel', '2Sa': '2 Samuel', '1Ki': '1 Kings', '2Ki': '2 Kings',
  '1Ch': '1 Chronicles', '2Ch': '2 Chronicles', Ezr: 'Ezra', Neh: 'Nehemiah', Est: 'Esther',
  Job: 'Job', Psa: 'Psalms', Pro: 'Proverbs', Ecc: 'Ecclesiastes', Sol: 'Song of Songs',
  Isa: 'Isaiah', Jer: 'Jeremiah', Lam: 'Lamentations', Eze: 'Ezekiel', Dan: 'Daniel',
  Hos: 'Hosea', Joe: 'Joel', Amo: 'Amos', Oba: 'Obadiah', Jon: 'Jonah',
  Mic: 'Micah', Nah: 'Nahum', Hab: 'Habakkuk', Zep: 'Zephaniah', Hag: 'Haggai',
  Zec: 'Zechariah', Mal: 'Malachi',
  Mat: 'Matthew', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John', Act: 'Acts',
  Rom: 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians', Gal: 'Galatians',
  Eph: 'Ephesians', Php: 'Philippians', Col: 'Colossians',
  '1Th': '1 Thessalonians', '2Th': '2 Thessalonians',
  '1Ti': '1 Timothy', '2Ti': '2 Timothy', Tit: 'Titus', Phm: 'Philemon',
  Heb: 'Hebrews', Jas: 'James', '1Pe': '1 Peter', '2Pe': '2 Peter',
  '1Jn': '1 John', '2Jn': '2 John', '3Jn': '3 John', Jud: 'Jude', Rev: 'Revelation',
};

const BOOK_ABBREV_ALIASES: Record<string, string> = {
  Ezk: 'Eze', Jol: 'Joe', Sng: 'Sol', Nam: 'Nah',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatRef(ref: string): string {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return ref;
  const canon = BOOK_ABBREV_ALIASES[m[1]] ?? m[1];
  const book = BOOK_TO_DISPLAY_NAME[canon] ?? m[1];
  return `${book} ${m[2]}:${m[3]}`;
}

function refToUrl(ref: string): string | null {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return null;
  const canon = BOOK_ABBREV_ALIASES[m[1]] ?? m[1];
  const book = BOOK_TO_DISPLAY_NAME[canon];
  if (!book) return null;
  return `https://servewell.net/-/${book.replace(/\s+/g, '-')}/${m[2]}#${m[3]}`;
}

function wordLink(fileName: string, label: string): string {
  return `<a href="https://words.servewell.net/${encodeURIComponent(fileName)}">${esc(label)}</a>`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanRendering(r: string): string {
  return r.replace(/<[^>]*>/g, ' ').replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const SKIP_HIGHLIGHT_WORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','he','her','his',
  'i','if','in','is','it','its','my','no','not','of','on','or','our','out',
  'she','so','that','the','their','they','this','to','up','was','we','were',
  'what','who','will','with','you','your',
]);

function highlightTarget(rawText: string, rendering: string, isLit: boolean): string {
  const cleaned = cleanRendering(rendering);
  if (!cleaned) return esc(rawText);
  if (!isLit) {
    const words = cleaned.toLowerCase().split(/\s+/);
    if (!words.some(w => w.length > 2 && !SKIP_HIGHLIGHT_WORDS.has(w))) return esc(rawText);
  }
  const pattern = escapeRegex(cleaned);
  try {
    return esc(rawText).replace(new RegExp(`\\b(${pattern})\\b`, 'gi'), '<mark class="ws-target">$1</mark>');
  } catch {
    return esc(rawText);
  }
}

// ---------------------------------------------------------------------------
// Render helpers (identical logic to generateWordStudyHtml.ts)
// ---------------------------------------------------------------------------

function renderInstance(inst: InstanceEntry, rendering: string): string {
  const url = refToUrl(inst.ref);
  const refHtml = url
    ? `<a class="ws-ref" href="${url}">${esc(formatRef(inst.ref))}</a>`
    : `<span class="ws-ref">${esc(formatRef(inst.ref))}</span>`;
  return [
    `<div class="ws-instance">`,
    refHtml,
    `<p class="ws-trad">${highlightTarget(inst.trad, rendering, false)}</p>`,
    `<p class="ws-lit">${highlightTarget(inst.lit, rendering, true)}</p>`,
    `</div>`,
  ].join('');
}

function renderTranslation(rendering: string, trans: TranslationOut, collapse: boolean): string {
  const countLabel = `${trans.totalInstances.toLocaleString()} instance${trans.totalInstances === 1 ? '' : 's'}`;
  const heading = `<h3 class="ws-rendering">${esc(rendering)} <span class="ws-count">(${countLabel})</span></h3>`;
  if (!collapse || trans.instances.length <= 1) {
    return `<div class="ws-translation">${heading}${trans.instances.map(i => renderInstance(i, rendering)).join('')}</div>`;
  }
  const [first, ...rest] = trans.instances;
  const hiddenCount = trans.totalInstances - 1;
  const notStoredCount = trans.totalInstances - 1 - rest.length;
  const overflowNote = notStoredCount > 0
    ? `<p class="ws-overflow-note">${notStoredCount.toLocaleString()} additional instance${notStoredCount === 1 ? '' : 's'} are in overflow documents linked below.</p>`
    : '';
  return [
    `<div class="ws-translation">`,
    heading,
    renderInstance(first, rendering),
    `<details class="ws-more">`,
    `<summary>${hiddenCount.toLocaleString()} more instance${hiddenCount === 1 ? '' : 's'}</summary>`,
    rest.map(i => renderInstance(i, rendering)).join(''),
    overflowNote,
    `</details>`,
    `</div>`,
  ].join('');
}

function renderSlot(code: string, slot: SlotOut, fileTotal: number): string {
  const shouldCollapse = fileTotal > 30;
  const sortedTranslations = Object.entries(slot.translations)
    .sort((a, b) => b[1].totalInstances - a[1].totalInstances);
  const translationsHtml = sortedTranslations
    .map(([r, t]) => renderTranslation(r, t, shouldCollapse && t.totalInstances > 5))
    .join('');
  const grammarLabel = slot.grammarFull?.trim() || code;
  const statsLabel = `${slot.totalInstances.toLocaleString()} instance${slot.totalInstances === 1 ? '' : 's'} · ${slot.totalTranslations} translation${slot.totalTranslations === 1 ? '' : 's'}`;
  return [
    `<section class="ws-slot" data-grammar-code="${esc(code)}">`,
    `<h2 class="ws-grammar-full">${esc(grammarLabel)}</h2>`,
    `<p class="ws-slot-stats">${statsLabel}</p>`,
    translationsHtml,
    `</section>`,
  ].join('');
}

function renderSlotsSection(slots: Record<string, SlotOut>, fileTotal: number): { html: string; mergedSlotCount: number } {
  const seen = new Map<string, { representativeCode: string; merged: SlotOut }>();
  for (const [code, slot] of Object.entries(slots)) {
    const key = slot.grammarFull?.trim() || code;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        representativeCode: code,
        merged: {
          grammarFull: slot.grammarFull, grammarFn: slot.grammarFn,
          totalInstances: slot.totalInstances, totalTranslations: slot.totalTranslations,
          translations: { ...slot.translations },
        },
      });
    } else {
      const m = existing.merged;
      for (const [rendering, trans] of Object.entries(slot.translations)) {
        if (!m.translations[rendering]) {
          m.translations[rendering] = { totalInstances: 0, instances: [] };
          m.totalTranslations++;
        }
        const t = m.translations[rendering];
        t.instances = [...t.instances, ...trans.instances];
        t.totalInstances += trans.totalInstances;
      }
      m.totalInstances += slot.totalInstances;
    }
  }
  const sorted = [...seen.values()].sort((a, b) => b.merged.totalInstances - a.merged.totalInstances);
  return {
    html: sorted.map(({ representativeCode, merged }) => renderSlot(representativeCode, merged, fileTotal)).join(''),
    mergedSlotCount: sorted.length,
  };
}

function renderFooter(
  overflow: Record<string, string> | undefined,
  relatedFiles: RelatedEntry[] | undefined,
  crossRefs: CrossRefEntry[] | undefined,
): string {
  const parts: string[] = [];
  if (overflow && Object.keys(overflow).length > 0) {
    const items = Object.entries(overflow).map(([fn, label]) => `<li>${wordLink(fn, label)}</li>`).join('');
    parts.push(`<section class="ws-overflow-links"><h2>More Instances</h2><ul>${items}</ul></section>`);
  }
  if (relatedFiles?.length) {
    const items = relatedFiles.map(r => {
      const label = r.rootTranslation ? `${r.rootTranslation} (${r.lang}, ${r.strongsId})` : `${r.fileName} (${r.lang}, ${r.strongsId})`;
      return `<li>${wordLink(r.fileName, label)}</li>`;
    }).join('');
    parts.push(`<section class="ws-related"><h2>Related Files</h2><ul>${items}</ul></section>`);
  }
  if (crossRefs?.length) {
    const items = crossRefs.map(r => {
      const label = r.rootTranslation ? `${r.rootTranslation} (${r.lang}, ${r.strongsId})` : `${r.wordKey} (${r.lang}, ${r.strongsId})`;
      return `<li>${wordLink(r.fileName, label)}</li>`;
    }).join('');
    parts.push(`<section class="ws-crossrefs"><h2>Cross References</h2><ul>${items}</ul></section>`);
  }
  return parts.length ? `<div class="ws-footer">${parts.join('')}</div>` : '';
}

// ---------------------------------------------------------------------------
// Render main word page content
// ---------------------------------------------------------------------------

function renderMain(data: MainWordFile, container: HTMLElement): void {
  const meta = data.ancientWord._meta;
  const suffix = meta.fileNumber > 1 ? ` (${meta.fileNumber})` : '';
  const displayWord = (meta.rootTranslation ?? meta.wordKey).toUpperCase();

  const hasAnyCollapse = meta.totalInstances > 30 &&
    Object.values(data.ancientWord.slots).some(s =>
      Object.values(s.translations).some(t => t.totalInstances > 5));

  const { html: slotsHtml, mergedSlotCount } = renderSlotsSection(data.ancientWord.slots, meta.totalInstances);
  const footer = renderFooter(data.ancientWord.overflow, data.relatedFiles, data.crossRefs);

  const subtitleParts = [
    ...(meta.transliteration ? [esc(meta.transliteration)] : []),
    esc(meta.lemma), esc(meta.lang), esc(meta.strongsId),
  ];
  const expandBtn = hasAnyCollapse
    ? ` <button id="ws-expand-all" class="ws-expand-btn">Expand all</button>` : '';

  container.innerHTML = [
    `<h1>${esc(displayWord)}${esc(suffix)} <span class="ws-title-sub">· ${subtitleParts.join(' · ')}</span></h1>`,
    `<p class="ws-meta-stats">${meta.totalInstances.toLocaleString()} total instance${meta.totalInstances === 1 ? '' : 's'} · ${mergedSlotCount} grammar slot${mergedSlotCount === 1 ? '' : 's'}${expandBtn}</p>`,
    `<div id="ws-slots">${slotsHtml}</div>`,
    footer,
  ].join('');
}

// ---------------------------------------------------------------------------
// Render overflow page content
// ---------------------------------------------------------------------------

function renderOverflow(data: OverflowFile, container: HTMLElement): void {
  const meta = data.ancientWord._meta;
  const hasAnyCollapse = meta.totalInstances > 30 &&
    Object.values(data.ancientWord.slots).some(s =>
      Object.values(s.translations).some(t => t.totalInstances > 5));

  const backLink = `<a class="ws-back-link" href="https://words.servewell.net/${encodeURIComponent(data.overflowFrom)}">&#8592; Back to ${esc(meta.wordKey)}</a>`;
  const expandBtn = hasAnyCollapse
    ? ` <button id="ws-expand-all" class="ws-expand-btn">Expand all</button>` : '';

  const { html: slotsHtml } = renderSlotsSection(data.ancientWord.slots, meta.totalInstances);

  container.innerHTML = [
    `<div class="ws-meta">`,
    backLink,
    `<span class="ws-meta-info">${esc(data.label)}</span>`,
    ` · <span class="ws-meta-info">${esc(meta.lang)}</span>`,
    ` · <span class="ws-meta-info">${esc(meta.strongsId)}</span>`,
    `<p class="ws-meta-stats">${meta.totalInstances.toLocaleString()} instance${meta.totalInstances === 1 ? '' : 's'} in this section${expandBtn}</p>`,
    `</div>`,
    `<div id="ws-slots">${slotsHtml}</div>`,
  ].join('');
}

// ---------------------------------------------------------------------------
// Expand/collapse + fragment scroll (mirrors PAGE_JS inline script)
// ---------------------------------------------------------------------------

function wireExpandAll(): void {
  const allDetails = document.querySelectorAll<HTMLDetailsElement>('details.ws-more');
  const btn = document.getElementById('ws-expand-all');
  if (!btn) return;
  if (!allDetails.length) { btn.hidden = true; return; }

  function updateBtn(): void {
    const anyCollapsed = Array.from(allDetails).some(d => !d.open);
    btn!.textContent = anyCollapsed ? 'Expand all' : 'Collapse most';
  }
  updateBtn();
  allDetails.forEach(d => d.addEventListener('toggle', updateBtn));
  btn.addEventListener('click', () => {
    const anyCollapsed = Array.from(allDetails).some(d => !d.open);
    allDetails.forEach(d => { d.open = anyCollapsed; });
    updateBtn();
  });
}

function handleFragmentScroll(): void {
  const hash = window.location.hash;
  if (!hash || typeof CSS === 'undefined' || !CSS.escape) return;
  const m = hash.match(/[#&?]grammar=([^&]+)/);
  if (!m) return;
  const code = decodeURIComponent(m[1]);
  const container = document.getElementById('ws-slots');
  if (!container) return;
  const target = container.querySelector<HTMLElement>(`[data-grammar-code="${CSS.escape(code)}"]`);
  if (target && target.parentNode === container) {
    container.insertBefore(target, container.firstChild);
    target.classList.add('ws-slot-highlighted');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

(function init() {
  const dataEl = document.getElementById('ws-data');
  const renderEl = document.getElementById('ws-render');
  if (!dataEl || !renderEl) return;

  let data: MainWordFile | OverflowFile;
  try {
    data = JSON.parse(dataEl.textContent ?? '');
  } catch {
    renderEl.innerHTML = '<p style="color:red">Failed to parse word data.</p>';
    return;
  }

  if ((data as OverflowFile).type === 'overflow') {
    renderOverflow(data as OverflowFile, renderEl);
  } else {
    renderMain(data as MainWordFile, renderEl);
  }

  wireExpandAll();
  handleFragmentScroll();
})();
