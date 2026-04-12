import type { AppModule } from './createModuleRegistry';

type WorkType = 'dev' | 'adm' | 'copy';

type NeedOption = {
  id: string;
  label: string;
};

type TimeSummaryRow = {
  dev: number;
  adm: number;
  copy: number;
};

type TimeSummary = {
  pastSevenDays: TimeSummaryRow;
  thisWeek: TimeSummaryRow;
  previousWeek: TimeSummaryRow;
};

type Segment = {
  start: number;
  stop?: number;
};

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function toHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const normalized = Math.max(0, Math.round(totalMinutes));
  return {
    hours: Math.floor(normalized / 60),
    minutes: normalized % 60
  };
}

function rowToText(hours: number, minutes: number): string {
  return `${hours}h ${minutes}m`;
}

function formatSummaryCell(minutes: number): string {
  const hm = toHoursMinutes(minutes);
  return rowToText(hm.hours, hm.minutes);
}

export function createDevTimeModule(): AppModule {
  let active = false;
  let needsCache: NeedOption[] = [];
  let trackerSessionId = '';
  let running = false;
  let segments: Segment[] = [];
  let workType: WorkType = 'dev';
  let needId = '';
  let saving = false;

  const disposers: Array<() => void> = [];

  function ensureUi() {
    if (!document.getElementById('dev-time-style')) {
      const style = document.createElement('style');
      style.id = 'dev-time-style';
      style.textContent = `
#app-shell-root .dev-time-btn {
  color: var(--fg);
  font-size: 0.82rem;
  padding: 0.28rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  cursor: pointer;
}

#app-shell-root .dev-time-btn:hover {
  background: var(--bg);
}

#app-shell-root .dev-time-popover {
  position: fixed;
  top: 60px;
  right: 0.75rem;
  width: min(96vw, 430px);
  max-height: calc(100dvh - 80px);
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  padding: 0.75rem;
  background: var(--panel);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  z-index: 90;
}

#app-shell-root .dev-time-popover[hidden] {
  display: none;
}

#app-shell-root .dev-time-row {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.55rem;
}

#app-shell-root .dev-time-row label {
  font-size: 0.86rem;
  color: var(--fg);
}

#app-shell-root .dev-time-row select,
#app-shell-root .dev-time-duration input {
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--bg);
  padding: 0.42rem 0.5rem;
}

#app-shell-root .dev-time-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.5rem 0;
}

#app-shell-root .dev-time-actions button,
#app-shell-root .dev-time-save {
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--bar);
  padding: 0.35rem 0.55rem;
  cursor: pointer;
}

#app-shell-root .dev-time-actions button:hover,
#app-shell-root .dev-time-save:hover {
  background: var(--bg);
}

#app-shell-root .dev-time-duration {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

#app-shell-root .dev-time-duration label {
  font-size: 0.82rem;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

#app-shell-root .dev-time-summary {
  margin-top: 0.75rem;
  border-top: 1px solid var(--border);
  padding-top: 0.65rem;
}

#app-shell-root .dev-time-summary table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

#app-shell-root .dev-time-summary th,
#app-shell-root .dev-time-summary td {
  text-align: left;
  border-bottom: 1px solid var(--border);
  padding: 0.28rem 0.3rem;
}

#app-shell-root .dev-time-message {
  color: var(--muted);
  font-size: 0.8rem;
  margin-top: 0.35rem;
}

#app-shell-root .dev-time-message[data-tone='error'] {
  color: #9a3f00;
}
`;
      document.head.appendChild(style);
    }

    const topbar = qs<HTMLElement>('#app-shell-root .app-topbar');
    if (topbar && !qs('#dev-time-btn')) {
      const spacer = topbar.querySelector('.app-spacer');
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'dev-time-btn';
      button.className = 'dev-time-btn';
      button.textContent = 'time';
      if (spacer?.parentElement === topbar) {
        topbar.insertBefore(button, spacer);
      } else {
        topbar.appendChild(button);
      }
    }

    if (!qs('#dev-time-popover')) {
      const pop = document.createElement('div');
      pop.id = 'dev-time-popover';
      pop.className = 'dev-time-popover';
      pop.hidden = true;
      pop.innerHTML = `
<div class="dev-time-row">
  <label for="dev-time-work-type">Work Type</label>
  <select id="dev-time-work-type">
    <option value="dev" selected>Dev (Development)</option>
    <option value="adm">Adm (Administration)</option>
    <option value="copy">Copy (Content creation)</option>
  </select>
</div>
<div class="dev-time-row">
  <label for="dev-time-need">Need</label>
  <select id="dev-time-need"></select>
</div>
<div class="dev-time-actions">
  <button type="button" id="dev-time-playpause" aria-label="Start timer">▶</button>
  <button type="button" id="dev-time-stop" aria-label="Stop timer">■</button>
</div>
<div class="dev-time-duration" id="dev-time-duration" hidden>
  <label>Hours
    <input type="number" id="dev-time-hours" min="0" step="1" value="0">
  </label>
  <label>Minutes
    <input type="number" id="dev-time-minutes" min="0" max="59" step="1" value="0">
  </label>
</div>
<div id="dev-time-save-row" hidden style="display:flex;gap:0.45rem;">
  <button type="button" class="dev-time-save" id="dev-time-save">Save</button>
  <button type="button" class="dev-time-save" id="dev-time-cancel">Cancel</button>
</div>
<div class="dev-time-message" id="dev-time-message" hidden></div>
<div class="dev-time-summary">
  <table>
    <thead>
      <tr><th>Range</th><th>Dev</th><th>Adm</th><th>Copy</th><th>Total</th></tr>
    </thead>
    <tbody>
      <tr><td>Past 7 days</td><td id="dev-time-sum-7-dev">-</td><td id="dev-time-sum-7-adm">-</td><td id="dev-time-sum-7-copy">-</td><td id="dev-time-sum-7-total">-</td></tr>
      <tr><td>This week</td><td id="dev-time-sum-this-dev">-</td><td id="dev-time-sum-this-adm">-</td><td id="dev-time-sum-this-copy">-</td><td id="dev-time-sum-this-total">-</td></tr>
      <tr><td>Previous week</td><td id="dev-time-sum-prev-dev">-</td><td id="dev-time-sum-prev-adm">-</td><td id="dev-time-sum-prev-copy">-</td><td id="dev-time-sum-prev-total">-</td></tr>
    </tbody>
  </table>
</div>`;
      const shellRoot = document.getElementById('app-shell-root');
      (shellRoot || document.body).appendChild(pop);
    }
  }

  function setMessage(message: string, tone: 'info' | 'error' = 'info') {
    const el = qs<HTMLElement>('#dev-time-message');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      delete el.dataset.tone;
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.dataset.tone = tone;
  }

  function setRunningUi(value: boolean) {
    const playPause = qs<HTMLButtonElement>('#dev-time-playpause');
    if (!playPause) return;
    playPause.textContent = value ? '⏸' : '▶';
    playPause.setAttribute('aria-label', value ? 'Pause timer' : 'Start timer');
  }

  function getNeedSelect(): HTMLSelectElement | null {
    const el = qs<HTMLElement>('#dev-time-need');
    return el instanceof HTMLSelectElement ? el : null;
  }

  function getWorkTypeSelect(): HTMLSelectElement | null {
    const el = qs<HTMLElement>('#dev-time-work-type');
    return el instanceof HTMLSelectElement ? el : null;
  }

  function setDurationInputs(totalMinutes: number) {
    const hm = toHoursMinutes(totalMinutes);
    const h = qs<HTMLInputElement>('#dev-time-hours');
    const m = qs<HTMLInputElement>('#dev-time-minutes');
    if (h) h.value = String(hm.hours);
    if (m) m.value = String(hm.minutes);
  }

  function getDurationMinutesFromInputs(): number {
    const h = Math.max(0, Math.floor(Number(qs<HTMLInputElement>('#dev-time-hours')?.value || 0)));
    const mRaw = Math.floor(Number(qs<HTMLInputElement>('#dev-time-minutes')?.value || 0));
    const m = Math.max(0, Math.min(59, mRaw));
    const mInput = qs<HTMLInputElement>('#dev-time-minutes');
    if (mInput) mInput.value = String(m);
    return h * 60 + m;
  }

  function showStopControls(show: boolean) {
    const duration = qs<HTMLElement>('#dev-time-duration');
    const saveRow = qs<HTMLElement>('#dev-time-save-row');
    if (duration) duration.hidden = !show;
    if (saveRow) saveRow.hidden = !show;
  }

  function getTotalMinutesFromSegments(): number {
    let totalMs = 0;
    for (const segment of segments) {
      if (typeof segment.stop !== 'number') continue;
      totalMs += Math.max(0, segment.stop - segment.start);
    }
    return Math.round(totalMs / 60_000);
  }

  function getSessionBounds(): { startTime: number; endTime: number } | null {
    if (segments.length === 0) return null;
    const starts = segments.map((s) => s.start);
    const stops = segments.map((s) => s.stop).filter((value): value is number => typeof value === 'number');
    if (starts.length === 0 || stops.length === 0) return null;
    return {
      startTime: Math.min(...starts),
      endTime: Math.max(...stops)
    };
  }

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const data = await response.json() as T & { error?: string };
    if (!response.ok) {
      throw new Error((data as any).error || `Request failed: ${response.status}`);
    }
    return data;
  }

  async function loadNeedOptions() {
    const payload = await fetchJson<{ needs: NeedOption[] }>('/api/dev/time/needs');
    needsCache = Array.isArray(payload.needs) ? payload.needs : [];
    const select = getNeedSelect();
    if (!select) return;
    const previous = needId;
    select.innerHTML =
      '<option value=""></option>' +
      needsCache
        .map((need) => `<option value="${escHtml(need.id)}">${escHtml(need.label)}</option>`)
        .join('');
    const next = needsCache.some((need) => need.id === previous) ? previous : '';
    select.value = next;
    needId = next;
  }

  async function loadSummary() {
    const tzOffsetMinutes = new Date().getTimezoneOffset();
    const payload = await fetchJson<{ summary: TimeSummary }>(`/api/dev/time/summary?tzOffsetMinutes=${encodeURIComponent(String(tzOffsetMinutes))}`);
    const summary = payload.summary;
    const map: Array<[string, number]> = [
      ['#dev-time-sum-7-dev', summary.pastSevenDays.dev],
      ['#dev-time-sum-7-adm', summary.pastSevenDays.adm],
      ['#dev-time-sum-7-copy', summary.pastSevenDays.copy],
      ['#dev-time-sum-7-total', summary.pastSevenDays.dev + summary.pastSevenDays.adm + summary.pastSevenDays.copy],
      ['#dev-time-sum-this-dev', summary.thisWeek.dev],
      ['#dev-time-sum-this-adm', summary.thisWeek.adm],
      ['#dev-time-sum-this-copy', summary.thisWeek.copy],
      ['#dev-time-sum-this-total', summary.thisWeek.dev + summary.thisWeek.adm + summary.thisWeek.copy],
      ['#dev-time-sum-prev-dev', summary.previousWeek.dev],
      ['#dev-time-sum-prev-adm', summary.previousWeek.adm],
      ['#dev-time-sum-prev-copy', summary.previousWeek.copy],
      ['#dev-time-sum-prev-total', summary.previousWeek.dev + summary.previousWeek.adm + summary.previousWeek.copy]
    ];
    for (const [selector, value] of map) {
      const cell = qs<HTMLElement>(selector);
      if (cell) cell.textContent = formatSummaryCell(value);
    }
  }

  async function persistEvent(eventType: 'start' | 'pause' | 'stop', eventAt: number) {
    await fetchJson<{ success: boolean }>('/api/dev/time/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackerSessionId,
        eventType,
        workType,
        needId,
        eventAt
      })
    });
  }

  async function onPlayPause() {
    const now = Date.now();

    if (!running) {
      if (!trackerSessionId) trackerSessionId = crypto.randomUUID();
      await persistEvent('start', now);
      segments.push({ start: now });
      running = true;
      setRunningUi(true);
      setMessage('Timer running.');
      return;
    }

    const openSegment = segments[segments.length - 1];
    if (openSegment && typeof openSegment.stop !== 'number') {
      await persistEvent('pause', now);
      openSegment.stop = now;
    }
    running = false;
    setRunningUi(false);
    setMessage('Timer paused.');
  }

  async function onStop() {
    if (!trackerSessionId || segments.length === 0) {
      setMessage('Start the timer before stopping.', 'error');
      return;
    }

    const now = Date.now();
    if (running) {
      const openSegment = segments[segments.length - 1];
      if (openSegment && typeof openSegment.stop !== 'number') {
        await persistEvent('stop', now);
        openSegment.stop = now;
      }
    }

    running = false;
    setRunningUi(false);
    const totalMinutes = getTotalMinutesFromSegments();
    setDurationInputs(totalMinutes);
    showStopControls(true);
    setMessage('Adjust duration if needed, then Save.');
  }

  function onCancel() {
    trackerSessionId = '';
    segments = [];
    running = false;
    setRunningUi(false);
    setDurationInputs(0);
    showStopControls(false);
    setMessage('');
  }

  async function onSave() {
    if (saving) return;
    const bounds = getSessionBounds();
    if (!bounds) {
      setMessage('No completed timer segments to save.', 'error');
      return;
    }
    const durationMinutes = getDurationMinutesFromInputs();

    saving = true;
    try {
      await fetchJson<{ success: boolean }>('/api/dev/time/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackerSessionId,
          workType,
          needId,
          startTime: bounds.startTime,
          endTime: bounds.endTime,
          durationMinutes
        })
      });

      setMessage(durationMinutes === 0 ? 'Reset.' : 'Saved.');
      trackerSessionId = '';
      segments = [];
      setDurationInputs(0);
      showStopControls(false);
      if (durationMinutes > 0) await loadSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save time entry';
      setMessage(message, 'error');
    } finally {
      saving = false;
    }
  }

  async function openPopover() {
    const popover = qs<HTMLElement>('#dev-time-popover');
    if (!popover) return;
    popover.hidden = false;

    const btn = qs<HTMLElement>('#dev-time-btn');
    if (btn && isVisible(btn)) {
      const rect = btn.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 440, rect.right - 430));
      popover.style.left = `${Math.round(left)}px`;
      popover.style.right = 'auto';
      popover.style.top = `${Math.round(rect.bottom + 8)}px`;
    }

    const work = getWorkTypeSelect();
    if (work) work.value = workType;
    await loadNeedOptions();
    await loadSummary();
  }

  function closePopover() {
    const popover = qs<HTMLElement>('#dev-time-popover');
    if (!popover) return;
    popover.hidden = true;
  }

  function wireListeners() {
    const onDocClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = qs<HTMLElement>('#dev-time-btn');
      const popover = qs<HTMLElement>('#dev-time-popover');
      if (!button || !popover) return;

      if (target === button || target.closest('#dev-time-btn')) {
        if (popover.hidden) {
          void openPopover();
        } else {
          closePopover();
        }
        return;
      }

      if (!target.closest('#dev-time-popover')) {
        closePopover();
      }
    };

    const onWorkTypeChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.id !== 'dev-time-work-type') return;
      const next = target.value as WorkType;
      if (next === 'dev' || next === 'adm' || next === 'copy') {
        workType = next;
      }
    };

    const onNeedChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.id !== 'dev-time-need') return;
      needId = target.value;
    };

    const onActionClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === 'dev-time-playpause') {
        event.preventDefault();
        void onPlayPause();
      }
      if (target.id === 'dev-time-stop') {
        event.preventDefault();
        void onStop();
      }
      if (target.id === 'dev-time-save') {
        event.preventDefault();
        void onSave();
      }
      if (target.id === 'dev-time-cancel') {
        event.preventDefault();
        onCancel();
      }
    };

    const onEscape = (event: Event) => {
      const keyboard = event as KeyboardEvent;
      if (keyboard.key === 'Escape') closePopover();
    };

    document.addEventListener('click', onDocClick);
    document.addEventListener('change', onWorkTypeChange);
    document.addEventListener('change', onNeedChange);
    document.addEventListener('click', onActionClick);
    document.addEventListener('keydown', onEscape);

    disposers.push(() => document.removeEventListener('click', onDocClick));
    disposers.push(() => document.removeEventListener('change', onWorkTypeChange));
    disposers.push(() => document.removeEventListener('change', onNeedChange));
    disposers.push(() => document.removeEventListener('click', onActionClick));
    disposers.push(() => document.removeEventListener('keydown', onEscape));
  }

  function removeUi() {
    closePopover();
    qs('#dev-time-btn')?.remove();
    qs('#dev-time-popover')?.remove();
  }

  return {
    id: 'dev-time',
    label: 'Developer time',
    active,
    includeInMenu: false,
    available: false,
    activate() {
      if (this.active) return;
      this.active = true;
      ensureUi();
      setRunningUi(false);
      showStopControls(false);
      wireListeners();
    },
    deactivate() {
      if (!this.active) return;
      this.active = false;
      while (disposers.length) {
        const dispose = disposers.pop();
        dispose?.();
      }
      removeUi();
      running = false;
      saving = false;
      trackerSessionId = '';
      segments = [];
      needId = '';
      workType = 'dev';
    }
  };
}
