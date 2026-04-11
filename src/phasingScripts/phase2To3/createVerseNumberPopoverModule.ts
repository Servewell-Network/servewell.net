import type { Delegator } from './createDelegator';
import type { AppModule } from './createModuleRegistry';

const STYLE_ID = 'verse-number-popover-style';
const POPOVER_ID = 'verse-number-popover';
const COPIED_POPOVER_ID = 'verse-link-copied-popover';

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
  width: min(22rem, calc(100vw - 1.5rem));
  padding: 0.8rem 0.9rem;
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

type VerseContext = {
  verse: string;
  title: string;
  link: string;
};

export function createVerseNumberPopoverModule(delegator: Delegator): AppModule {
  let activeVerseLink = '';
  let copyToastTimer = 0;
  const disposers: Array<() => void> = [];

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
      title: book && chapter ? `${book} ${chapter}:${verse}` : `Verse ${verse}`,
      link: url.toString(),
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

  function renderVersePopover(button: HTMLElement) {
    const popover = qs<HTMLElement>(`#${POPOVER_ID}`);
    if (!popover) return;

    const context = getVerseContext(button);
    if (!context) return;

    if (popover.matches(':popover-open') && activeVerseLink === context.link) {
      popover.hidePopover();
      return;
    }

    activeVerseLink = context.link;
    popover.innerHTML = `<div class="verse-number-popover-header"><div class="verse-number-popover-title">${escHtml(context.title)}</div></div><div class="verse-number-popover-actions"><button type="button" class="verse-number-popover-link-btn" data-verse-copy-link="${escHtml(context.link)}">Link</button></div><p class="verse-number-popover-body">More content coming here soon</p>`;
    if (popover.matches(':popover-open')) {
      popover.hidePopover();
    }
    popover.showPopover();
    positionPopover(popover, button);
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
          eventName: 'click',
          tagName: 'BUTTON',
          selector: 'button.verse-num',
          handle(button, event) {
            event.preventDefault();
            renderVersePopover(button);
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
    },
  };
}
