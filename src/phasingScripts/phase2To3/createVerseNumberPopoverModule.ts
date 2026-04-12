import type { Delegator } from './createDelegator';
import type { AppModule } from './createModuleRegistry';

const STYLE_ID = 'verse-number-popover-style';
const POPOVER_ID = 'verse-number-popover';
const COPIED_POPOVER_ID = 'verse-link-copied-popover';
const COMMENTARY_EDIT_BTN_ID = 'verse-commentary-edit-btn';
const COMMENTARY_SAVE_BTN_ID = 'verse-commentary-save-btn';
const COMMENTARY_CANCEL_BTN_ID = 'verse-commentary-cancel-btn';
const COMMENTARY_REJECTED_DISMISS_BTN_ID = 'verse-commentary-rejected-dismiss-btn';
const COMMENTARY_REJECTED_DISMISS_KEY_PREFIX = 'servewell-commentary-rejected-dismissed-';
const dismissedRejectedNoticeIds = new Set<string>();

const CSS = `
#verse-number-popover,
#verse-link-copied-popover {
  position: fixed;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--panel);
  color: var(--fg);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
}

#verse-number-popover {
  width: min(36rem, calc(100vw - 1.5rem));
  min-width: min(18rem, calc(100vw - 1.5rem));
  min-height: 12rem;
  max-width: calc(100vw - 1.5rem);
  max-height: calc(100vh - 1.5rem);
  padding: 0.8rem 1rem 0.9rem 0.9rem;
  resize: both;
  overflow: auto;
  z-index: 75;
}

#verse-number-popover:not(:popover-open),
#verse-link-copied-popover:not(:popover-open) {
  display: none;
}

.verse-number-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
  cursor: move;
  user-select: none;
}

.verse-number-popover-title {
  font-size: 0.98rem;
  font-weight: 700;
}

.verse-number-popover-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.verse-number-popover-link-btn {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bar);
  color: var(--fg);
  padding: 0.35rem 0.72rem;
  cursor: pointer;
}

.verse-number-popover-link-btn:hover {
  background: var(--bg);
}

.verse-number-popover-body {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.verse-number-popover-content {
  max-height: min(64vh, 34rem);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.45rem;
}

.verse-number-commentary-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.65rem 0 0;
}

.verse-number-commentary-btn {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bar);
  color: var(--fg);
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}

.verse-number-commentary-btn:hover {
  background: var(--bg);
}

.verse-number-commentary-group {
  margin-top: 0.7rem;
}

.verse-number-commentary-note {
  margin: 0.35rem 0 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.55rem;
  background: var(--bar);
  color: var(--fg);
  font-size: 0.9rem;
  line-height: 1.35;
  white-space: pre-wrap;
}

.verse-number-commentary-heading {
  margin: 0;
  color: var(--fg);
  font-size: 0.9rem;
  font-weight: 700;
}

.verse-number-commentary-instructions {
  margin: 0.28rem 0 0;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.35;
}

.verse-number-commentary-value {
  margin: 0.35rem 0 0;
  color: var(--fg);
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
}

.verse-number-commentary-textarea {
  width: 100%;
  margin-top: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg);
  color: var(--fg);
  font: inherit;
  font-size: 0.9rem;
  padding: 0.5rem 0.55rem;
  min-height: 4.2rem;
  resize: vertical;
}

.verse-num.verse-num-has-commentary {
  font-weight: 700;
}

#verse-link-copied-popover {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  z-index: 76;
}
`;

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s: string): string {
  return escHtml(s).replace(/'/g, '&#39;');
}

type VerseContext = {
  verse: string;
  book: string;
  chapter: string;
  title: string;
  link: string;
  commentaryId: string;
};

type CommentaryFieldKey =
  | 'godAndPlan'
  | 'examplesOfSuccess'
  | 'memoryHelps'
  | 'relatedTexts';

type CommentaryEntry = Record<CommentaryFieldKey, string>;

type AuthState = {
  authenticated: boolean;
  userId?: string;
  email?: string;
};

function rejectedDismissKey(commentaryId: string): string {
  return `${COMMENTARY_REJECTED_DISMISS_KEY_PREFIX}${commentaryId}`;
}

function isRejectedNoticeDismissed(commentaryId: string): boolean {
  if (dismissedRejectedNoticeIds.has(commentaryId)) return true;
  try {
    return localStorage.getItem(rejectedDismissKey(commentaryId)) === '1';
  } catch {
    return false;
  }
}

function dismissRejectedNotice(commentaryId: string) {
  dismissedRejectedNoticeIds.add(commentaryId);
  try {
    localStorage.setItem(rejectedDismissKey(commentaryId), '1');
  } catch {
  }
}

const COMMENTARY_FIELDS: Array<{ key: CommentaryFieldKey; heading: string; instructions: string }> = [
  {
    key: 'godAndPlan',
    heading: "God and God's Plan",
    instructions: "Give a short summary of what this verse or snippet illuminates about God and God's Plan and why that's important.",
  },
  {
    key: 'examplesOfSuccess',
    heading: 'Examples of Success',
    instructions: "Give a short list of examples of how people can succeed in this part of God's plan.",
  },
  {
    key: 'memoryHelps',
    heading: 'Memory Helps',
    instructions: 'Give a short summary of how this concept can be taught or remembered, such as concepts in the text that can be used as metaphors.',
  },
  {
    key: 'relatedTexts',
    heading: 'Related Texts',
    instructions: 'Give, if possible, references to a few texts that make this one more clear and a few texts that are more clear if you know this one.',
  },
];

const EMPTY_COMMENTARY_ENTRY: CommentaryEntry = {
  godAndPlan: '',
  examplesOfSuccess: '',
  memoryHelps: '',
  relatedTexts: '',
};

function getEmptyCommentaryEntry(): CommentaryEntry {
  return { ...EMPTY_COMMENTARY_ENTRY };
}

function normalizeCommentaryEntry(raw: unknown): CommentaryEntry {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<CommentaryEntry>;
  return {
    godAndPlan: typeof source.godAndPlan === 'string' ? source.godAndPlan : '',
    examplesOfSuccess: typeof source.examplesOfSuccess === 'string' ? source.examplesOfSuccess : '',
    memoryHelps: typeof source.memoryHelps === 'string' ? source.memoryHelps : '',
    relatedTexts: typeof source.relatedTexts === 'string' ? source.relatedTexts : '',
  };
}

function hasCommentary(entry: CommentaryEntry): boolean {
  return COMMENTARY_FIELDS.some((field) => entry[field.key].trim().length > 0);
}

export function createVerseNumberPopoverModule(delegator: Delegator): AppModule {
  let activeVerseLink = '';
  let activeVerseButton: HTMLElement | null = null;
  let activeContext: VerseContext | null = null;
  let activeRejectionNoticeId = '';
  let commentaryEditing = false;
  let manualPopoverPosition: { left: number; top: number } | null = null;
  let authState: AuthState = { authenticated: false };
  let copyToastTimer = 0;
  const disposers: Array<() => void> = [];

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const data = await response.json() as T & { error?: string };
    if (!response.ok) {
      throw new Error((data as { error?: string }).error || `Request failed: ${response.status}`);
    }
    return data;
  }

  function injectOnce() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    if (!qs(`#${POPOVER_ID}`)) {
      const popover = document.createElement('div');
      popover.id = POPOVER_ID;
      popover.setAttribute('popover', 'auto');
      document.body.appendChild(popover);
    }

    if (!qs(`#${COPIED_POPOVER_ID}`)) {
      const copiedPopover = document.createElement('div');
      copiedPopover.id = COPIED_POPOVER_ID;
      copiedPopover.setAttribute('popover', 'manual');
      copiedPopover.textContent = 'link copied';
      document.body.appendChild(copiedPopover);
    }
  }

  function getVerseContext(button: HTMLElement): VerseContext | null {
    const row = button.closest('.snippet-row');
    const main = qs<HTMLElement>('main.chapter-page');
    const verse = row?.id || button.textContent?.trim() || '';
    const book = main?.dataset.book || '';
    const chapter = main?.dataset.chapter || '';
    if (!verse) return null;

    const url = new URL(window.location.href);
    url.hash = verse;

    return {
      verse,
      book,
      chapter,
      title: book && chapter ? `${book} ${chapter}:${verse}` : `Verse ${verse}`,
      link: url.toString(),
      commentaryId: book && chapter ? `${book}|${chapter}|${verse}` : `${url.pathname}|${verse}`,
    };
  }

  function positionPopover(popover: HTMLElement, anchor: HTMLElement, preferAbove = false) {
    const margin = 12;
    const rect = anchor.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    let left = preferAbove ? rect.left + rect.width / 2 - popRect.width / 2 : rect.left;
    if (left + popRect.width > window.innerWidth - margin) {
      left = window.innerWidth - popRect.width - margin;
    }
    if (left < margin) left = margin;

    let top = preferAbove ? rect.top - popRect.height - 8 : rect.bottom + 8;
    if (!preferAbove && top + popRect.height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - popRect.height - 8);
    }
    if (preferAbove && top < margin) {
      top = Math.min(window.innerHeight - popRect.height - margin, rect.bottom + 8);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function positionVersePopover(popover: HTMLElement, anchor: HTMLElement) {
    if (manualPopoverPosition) {
      popover.style.left = `${Math.round(manualPopoverPosition.left)}px`;
      popover.style.top = `${Math.round(manualPopoverPosition.top)}px`;
      return;
    }
    positionPopover(popover, anchor);
  }

  function hideCopyToast() {
    window.clearTimeout(copyToastTimer);
    const copiedPopover = qs<HTMLElement>(`#${COPIED_POPOVER_ID}`);
    if (copiedPopover?.matches(':popover-open')) {
      copiedPopover.hidePopover();
    }
  }

  async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy failed');
  }

  function showCopyToast(anchor: HTMLElement, message = 'link copied') {
    const copiedPopover = qs<HTMLElement>(`#${COPIED_POPOVER_ID}`);
    if (!copiedPopover) return;

    copiedPopover.textContent = message;
    if (copiedPopover.matches(':popover-open')) {
      copiedPopover.hidePopover();
    }
    copiedPopover.showPopover();
    positionPopover(copiedPopover, anchor, true);

    window.clearTimeout(copyToastTimer);
    copyToastTimer = window.setTimeout(() => {
      if (copiedPopover.matches(':popover-open')) {
        copiedPopover.hidePopover();
      }
    }, 1200);
  }

  function buildCommentaryViewHtml(entry: CommentaryEntry, includeEditButton: boolean): string {
    const sections = COMMENTARY_FIELDS.flatMap((field) => {
      const value = entry[field.key].trim();
      if (!value) return [];
      return [`<section class="verse-number-commentary-group"><h4 class="verse-number-commentary-heading">${escHtml(field.heading)}</h4><p class="verse-number-commentary-value">${escHtml(value)}</p></section>`];
    }).join('');

    const actions = includeEditButton
      ? `<div class="verse-number-commentary-actions"><button type="button" id="${COMMENTARY_EDIT_BTN_ID}" class="verse-number-commentary-btn">Edit</button></div>`
      : '';

    return `<div class="verse-number-popover-content">${sections}${actions}</div>`;
  }

  function buildCommentaryEditHtml(entry: CommentaryEntry): string {
    const sections = COMMENTARY_FIELDS.map((field) => {
      const instructionsHtml = field.instructions
        ? `<p class="verse-number-commentary-instructions">${escHtml(field.instructions)}</p>`
        : '';
      return `<section class="verse-number-commentary-group"><h4 class="verse-number-commentary-heading">${escHtml(field.heading)}</h4>${instructionsHtml}<textarea class="verse-number-commentary-textarea" data-commentary-key="${escAttr(field.key)}">${escHtml(entry[field.key])}</textarea></section>`;
    }).join('');

    return `<div class="verse-number-popover-content">${sections}<div class="verse-number-commentary-actions"><button type="button" id="${COMMENTARY_SAVE_BTN_ID}" class="verse-number-commentary-btn">Save</button><button type="button" id="${COMMENTARY_CANCEL_BTN_ID}" class="verse-number-commentary-btn">Cancel</button></div></div>`;
  }

  function buildStatusNotice(status: string, rejectionNoticeId: string, moderationNotes: string): string {
    if (status === 'pending') {
      return '<p class="verse-number-popover-body">Your saved commentary is pending moderation. Public display uses approved content only.</p>';
    }
    if (status === 'rejected') {
      if (isRejectedNoticeDismissed(rejectionNoticeId)) return '';
      const note = moderationNotes.trim()
        ? moderationNotes.trim()
        : 'No moderation notes were provided.';
      return `<div class="verse-number-commentary-note"><strong>Rejected:</strong> ${escHtml(note)}<div class="verse-number-commentary-actions"><button type="button" id="${COMMENTARY_REJECTED_DISMISS_BTN_ID}" class="verse-number-commentary-btn">Dismiss</button></div></div>`;
    }
    return '';
  }

  function buildPublicEmptyHtml(): string {
    return '<p class="verse-number-popover-body">More content coming here soon.</p>';
  }

  function parseCommentaryForm(popover: HTMLElement): CommentaryEntry {
    const out = getEmptyCommentaryEntry();
    popover.querySelectorAll<HTMLTextAreaElement>('textarea[data-commentary-key]').forEach((textarea) => {
      const key = textarea.dataset.commentaryKey as CommentaryFieldKey | undefined;
      if (!key || !(key in out)) return;
      out[key] = textarea.value.trim();
    });
    return out;
  }

  async function loadVerseCommentary(context: VerseContext): Promise<{
    approved: { entry: CommentaryEntry; status: string; moderationNotes?: string; updatedAt?: number } | null;
    mine: { entry: CommentaryEntry; status: string; moderationNotes?: string; updatedAt?: number } | null;
    canEdit: boolean;
  }> {
    const query = new URLSearchParams({ book: context.book, chapter: context.chapter, verse: context.verse }).toString();
    const payload = await fetchJson<{
      approved?: { entry?: CommentaryEntry; status?: string; moderationNotes?: string; updatedAt?: number } | null;
      mine?: { entry?: CommentaryEntry; status?: string; moderationNotes?: string; updatedAt?: number } | null;
      canEdit?: boolean;
    }>(`/api/verse-commentary?${query}`);

    return {
      approved: payload.approved && payload.approved.entry
        ? {
            entry: normalizeCommentaryEntry(payload.approved.entry),
            status: payload.approved.status || 'approved',
            moderationNotes: typeof payload.approved.moderationNotes === 'string' ? payload.approved.moderationNotes : '',
            updatedAt: Number(payload.approved.updatedAt || 0) || 0,
          }
        : null,
      mine: payload.mine && payload.mine.entry
        ? {
            entry: normalizeCommentaryEntry(payload.mine.entry),
            status: payload.mine.status || '',
            moderationNotes: typeof payload.mine.moderationNotes === 'string' ? payload.mine.moderationNotes : '',
            updatedAt: Number(payload.mine.updatedAt || 0) || 0,
          }
        : null,
      canEdit: Boolean(payload.canEdit),
    };
  }

  async function syncVerseCommentaryMarkers() {
    const main = qs<HTMLElement>('main.chapter-page');
    const book = main?.dataset.book || '';
    const chapter = main?.dataset.chapter || '';
    if (!book || !chapter) {
      document.querySelectorAll<HTMLElement>('button.verse-num.verse-num-has-commentary').forEach((button) => {
        button.classList.remove('verse-num-has-commentary');
      });
      return;
    }

    try {
      const query = new URLSearchParams({ book, chapter }).toString();
      const payload = await fetchJson<{ approvedVerses?: string[]; mineVerses?: string[] }>(`/api/verse-commentary/chapter?${query}`);
      const visibleVerses = new Set<string>([
        ...(Array.isArray(payload.approvedVerses) ? payload.approvedVerses : []),
        ...(authState.authenticated && Array.isArray(payload.mineVerses) ? payload.mineVerses : []),
      ]);

      document.querySelectorAll<HTMLElement>('button.verse-num').forEach((button) => {
        const row = button.closest('.snippet-row');
        const verse = row?.id || button.textContent?.trim() || '';
        button.classList.toggle('verse-num-has-commentary', Boolean(verse && visibleVerses.has(verse)));
      });
    } catch {
      document.querySelectorAll<HTMLElement>('button.verse-num.verse-num-has-commentary').forEach((button) => {
        button.classList.remove('verse-num-has-commentary');
      });
    }
  }

  async function renderVersePopover(button: HTMLElement, options?: { forceRefresh?: boolean }) {
    const popover = qs<HTMLElement>(`#${POPOVER_ID}`);
    if (!popover) return;

    const context = getVerseContext(button);
    if (!context) return;

    if (!options?.forceRefresh && popover.matches(':popover-open') && activeVerseLink === context.link) {
      popover.hidePopover();
      activeVerseButton = null;
      activeContext = null;
      commentaryEditing = false;
      return;
    }

    activeVerseLink = context.link;
    activeVerseButton = button;
    activeContext = context;

    const header = `<div class="verse-number-popover-header"><div class="verse-number-popover-title">${escHtml(context.title)}</div></div><div class="verse-number-popover-actions"><button type="button" class="verse-number-popover-link-btn" data-verse-copy-link="${escHtml(context.link)}">Link</button></div>`;

    popover.innerHTML = `${header}<div class="verse-number-popover-content"><p class="verse-number-popover-body">Loading commentary...</p></div>`;
    if (popover.matches(':popover-open')) {
      popover.hidePopover();
    }
    popover.showPopover();
    positionVersePopover(popover, button);

    try {
      const payload = await loadVerseCommentary(context);
      if (activeVerseLink !== context.link || activeVerseButton !== button) return;

      const approvedEntry = payload.approved?.entry || getEmptyCommentaryEntry();
      const mineEntry = payload.mine?.entry || getEmptyCommentaryEntry();
      const mineStatus = payload.mine?.status || '';
      const mineUpdatedAt = payload.mine?.updatedAt || 0;
      const rejectionNoticeId = `${context.commentaryId}:${mineUpdatedAt}`;
      activeRejectionNoticeId = rejectionNoticeId;

      const showRejectedDraft = mineStatus === 'rejected'
        && Boolean(payload.mine?.entry)
        && !isRejectedNoticeDismissed(rejectionNoticeId);
      const visibleEntry = showRejectedDraft ? mineEntry : approvedEntry;
      const editEntry = payload.mine?.entry ? mineEntry : approvedEntry;

      let body = '';
      if (!authState.authenticated) {
        body = payload.approved && hasCommentary(payload.approved.entry)
          ? buildCommentaryViewHtml(payload.approved.entry, false)
          : buildPublicEmptyHtml();
      } else if (commentaryEditing) {
        body = buildCommentaryEditHtml(editEntry);
      } else {
        body = `${buildCommentaryViewHtml(visibleEntry, true)}${buildStatusNotice(mineStatus, rejectionNoticeId, payload.mine?.moderationNotes || '')}`;
      }

      button.classList.toggle('verse-num-has-commentary', hasCommentary(payload.approved?.entry || payload.mine?.entry || getEmptyCommentaryEntry()));
      popover.innerHTML = `${header}${body}`;
      positionVersePopover(popover, button);
    } catch (error) {
      if (activeVerseLink !== context.link || activeVerseButton !== button) return;
      popover.innerHTML = `${header}<div class="verse-number-popover-content"><p class="verse-number-popover-body">${escHtml(error instanceof Error ? error.message : 'Could not load commentary')}</p></div>`;
      positionVersePopover(popover, button);
    }
  }

  return {
    id: 'verse-number-popover',
    label: 'Verse Number Popover',
    active: false,
    includeInMenu: false,
    activate() {
      if (this.active) return;
      this.active = true;
      injectOnce();

      disposers.push(
        delegator.registerSublistener({
          eventName: 'mousedown',
          tagName: 'DIV',
          selector: '.verse-number-popover-header',
          handle(header, event) {
            const mouseEvent = event as MouseEvent;
            const popover = header.closest<HTMLElement>(`#${POPOVER_ID}`);
            if (!popover || !popover.matches(':popover-open')) return;
            const rect = popover.getBoundingClientRect();
            const offsetX = mouseEvent.clientX - rect.left;
            const offsetY = mouseEvent.clientY - rect.top;

            mouseEvent.preventDefault();

            const onMove = (moveEvent: MouseEvent) => {
              const margin = 10;
              const maxLeft = Math.max(margin, window.innerWidth - popover.offsetWidth - margin);
              const maxTop = Math.max(margin, window.innerHeight - popover.offsetHeight - margin);
              const left = Math.min(maxLeft, Math.max(margin, moveEvent.clientX - offsetX));
              const top = Math.min(maxTop, Math.max(margin, moveEvent.clientY - offsetY));
              manualPopoverPosition = { left, top };
              popover.style.left = `${Math.round(left)}px`;
              popover.style.top = `${Math.round(top)}px`;
            };

            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          },
        })
      );

      disposers.push(
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: 'button.verse-num',
          handle(button, event) {
            event.preventDefault();
            manualPopoverPosition = null;
            void renderVersePopover(button);
          },
        })
      );

      disposers.push(
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: 'button[data-verse-copy-link]',
          handle(button, event) {
            event.preventDefault();
            const link = button.dataset.verseCopyLink || '';
            if (!link) return;
            copyText(link)
              .then(() => showCopyToast(button, 'link copied'))
              .catch(() => showCopyToast(button, 'copy failed'));
          },
        })
      );

      disposers.push(
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: `#${COMMENTARY_REJECTED_DISMISS_BTN_ID}`,
          handle(_button, event) {
            event.preventDefault();
            if (!activeContext || !activeVerseButton) return;
            dismissRejectedNotice(activeRejectionNoticeId || activeContext.commentaryId);
            void renderVersePopover(activeVerseButton, { forceRefresh: true });
          },
        })
      );

      disposers.push(
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: `#${COMMENTARY_EDIT_BTN_ID}`,
          handle(_button, event) {
            event.preventDefault();
            if (!activeVerseButton) return;
            commentaryEditing = true;
            void renderVersePopover(activeVerseButton, { forceRefresh: true });
          },
        })
      );

      disposers.push(
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: `#${COMMENTARY_CANCEL_BTN_ID}`,
          handle(_button, event) {
            event.preventDefault();
            if (!activeVerseButton) return;
            commentaryEditing = false;
            void renderVersePopover(activeVerseButton, { forceRefresh: true });
          },
        })
      );

      disposers.push(
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: `#${COMMENTARY_SAVE_BTN_ID}`,
          handle(_button, event) {
            event.preventDefault();
            const popover = qs<HTMLElement>(`#${POPOVER_ID}`);
            if (!popover || !activeContext || !activeVerseButton) return;
            const entry = parseCommentaryForm(popover);

            void fetchJson<{ success: boolean }>(`/api/verse-commentary`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                book: activeContext.book,
                chapter: activeContext.chapter,
                verse: activeContext.verse,
                entry,
              }),
            }).then(() => {
              commentaryEditing = false;
              void syncVerseCommentaryMarkers();
              void renderVersePopover(activeVerseButton as HTMLElement, { forceRefresh: true });
            }).catch((error) => {
              const body = popover.querySelector('.verse-number-popover-body');
              if (body) {
                body.textContent = error instanceof Error ? error.message : 'Could not save commentary';
              }
            });
          },
        })
      );

      const onAuthChanged = (event: Event) => {
        const detail = (event as CustomEvent).detail as Partial<AuthState> | undefined;
        authState = {
          authenticated: Boolean(detail?.authenticated),
          userId: typeof detail?.userId === 'string' ? detail.userId : undefined,
          email: typeof detail?.email === 'string' ? detail.email : undefined,
        };
        void syncVerseCommentaryMarkers();
        if (activeVerseButton && qs<HTMLElement>(`#${POPOVER_ID}`)?.matches(':popover-open')) {
          void renderVersePopover(activeVerseButton, { forceRefresh: true });
        }
      };

      window.addEventListener('servewell-auth-changed', onAuthChanged);
      disposers.push(() => window.removeEventListener('servewell-auth-changed', onAuthChanged));
      window.setTimeout(() => { void syncVerseCommentaryMarkers(); }, 0);
    },
    deactivate() {
      this.active = false;
      while (disposers.length) {
        const dispose = disposers.pop();
        dispose?.();
      }
      hideCopyToast();
      const popover = qs<HTMLElement>(`#${POPOVER_ID}`);
      if (popover?.matches(':popover-open')) {
        popover.hidePopover();
      }
      activeVerseLink = '';
      activeVerseButton = null;
      activeContext = null;
      commentaryEditing = false;
      manualPopoverPosition = null;
    },
  };
}
