export type ShellModuleListItem = {
  id: string;
  label: string;
  infoHref?: string;
  active: boolean;
};

export type ShellApi = {
  openPanel: () => void;
  closePanel: () => void;
  syncThemeInputs: (theme: 'light' | 'dark') => void;
  appendDemoLine: (text: string) => void;
  syncModuleInputs: (moduleId: string, active: boolean) => void;
  syncDemoButtons: (active: boolean) => void;
  renderModuleList: (modules: ShellModuleListItem[]) => void;
};

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function qsa<T extends HTMLElement>(selector: string): T[] {
  return Array.from(document.querySelectorAll(selector)) as T[];
}

export function createShell(): ShellApi {
  const css = `
:root {
  --bg: #ffffff;
  --fg: #171717;
  --muted: #666666;
  --bar: #f4f4f5;
  --border: #d9d9de;
  --panel: #ffffff;
}

:root[data-theme="dark"] {
  --bg: #111317;
  --fg: #f1f3f5;
  --muted: #a6aebb;
  --bar: #1a1d23;
  --border: #2c323c;
  --panel: #171a20;
}

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
}

body.with-app-shell {
  padding-top: 56px;
  padding-bottom: 60px;
  padding-left: 1%;
}

body.with-app-shell main.chapter-page {
  padding-right: 1%;
}

#app-shell-root button,
#app-shell-root input {
  font: inherit;
}

#app-shell-root .app-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  background: var(--bar);
  border-bottom: 1px solid var(--border);
  z-index: 50;
}

#app-shell-root .app-topbar-home {
  color: var(--fg);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
}

#app-shell-root .app-topbar-home:hover {
  color: var(--muted);
}

#app-shell-root .app-topbar-link {
  color: var(--fg);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  background: var(--panel);
  white-space: nowrap;
}

#app-shell-root .app-topbar-link:hover {
  color: var(--fg);
  background: var(--bg);
}

#app-shell-root .app-auth-cluster {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#app-shell-root .app-auth-menu-status,
#app-shell-root .app-sidepanel-auth-status {
  color: var(--fg);
  font-size: 0.82rem;
  line-height: 1.4;
}

#app-shell-root .app-auth-menu-copy {
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.4;
  margin-top: 0.35rem;
}

#app-shell-root .app-auth-menu-toggle {
  color: var(--fg);
  font-size: 0.82rem;
  padding: 0.28rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  cursor: pointer;
}

#app-shell-root .app-auth-menu-toggle:hover {
  background: var(--bg);
}

#app-shell-root .app-auth-menu {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  min-width: 16rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  background: var(--panel);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}

#app-shell-root .app-auth-menu[hidden] {
  display: none;
}

#app-shell-root .app-auth-menu-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.65rem;
}

#app-shell-root .app-auth-button,
#app-shell-root .app-sidepanel-auth-button {
  color: var(--fg);
  font-size: 0.9rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  background: var(--panel);
  cursor: pointer;
}

#app-shell-root .app-auth-button:hover,
#app-shell-root .app-sidepanel-auth-button:hover {
  background: var(--bg);
}

#app-shell-root .app-auth-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.34);
  z-index: 70;
}

#app-shell-root .app-auth-modal[hidden] {
  display: none;
}

#app-shell-root .app-auth-modal-card {
  width: min(92vw, 28rem);
  border: 1px solid var(--border);
  border-radius: 0.9rem;
  background: var(--panel);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  padding: 1rem;
}

#app-shell-root .app-auth-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

#app-shell-root .app-auth-modal-title {
  margin: 0;
  font-size: 1.05rem;
}

#app-shell-root .app-auth-modal-close {
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bar);
  width: 2rem;
  height: 2rem;
  cursor: pointer;
}

#app-shell-root .app-auth-modal-close:hover {
  color: var(--fg);
  background: var(--bg);
}

#app-shell-root .app-auth-modal-copy {
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0.75rem 0 0.9rem;
}

#app-shell-root .app-auth-modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

#app-shell-root .app-auth-modal-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

#app-shell-root .app-auth-modal-input {
  color: var(--fg);
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.55rem;
  background: var(--bg);
}

#app-shell-root .app-auth-modal-message {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.55rem;
  background: var(--bar);
  font-size: 0.88rem;
  line-height: 1.45;
}

#app-shell-root .app-auth-modal-message[data-tone="error"] {
  border-color: #d97706;
}

#app-shell-root .app-auth-modal-message[data-tone="success"] {
  border-color: #15803d;
}

#app-shell-root .app-auth-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

#app-shell-root .app-auth-modal-secondary,
#app-shell-root .app-auth-modal-submit {
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--panel);
  padding: 0.5rem 0.8rem;
  cursor: pointer;
}

#app-shell-root .app-auth-modal-secondary:hover,
#app-shell-root .app-auth-modal-submit:hover {
  background: var(--bg);
}

#app-shell-root .app-spacer {
  flex: 1;
}

#app-shell-root .app-checkrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#app-shell-root .app-checkrow-info {
  margin-left: auto;
  color: var(--fg);
  text-decoration: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  width: 1.1rem;
  height: 1.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  line-height: 1;
  background: var(--panel);
}

#app-shell-root .app-checkrow-info:hover {
  background: var(--bg);
}

#app-shell-root .app-sidepanel {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(86vw, 320px);
  transform: translateX(-102%);
  transition: transform 0.18s ease;
  background: var(--panel);
  border-right: 1px solid var(--border);
  z-index: 60;
  padding: 1rem;
  overflow: auto;
}

body.app-panel-open #app-shell-root .app-sidepanel {
  transform: translateX(0);
}

#app-shell-root .app-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  z-index: 55;
}

body.app-panel-open #app-shell-root .app-overlay {
  opacity: 1;
  pointer-events: auto;
}

#app-shell-root .app-sidepanel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

#app-shell-root .app-sidepanel-home {
  color: var(--fg);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
}

#app-shell-root .app-sidepanel-home:hover {
  color: var(--muted);
}

#app-shell-root .app-sidepanel section {
  margin-bottom: 1.25rem;
}

#app-shell-root .app-sidepanel-links {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

#app-shell-root .app-sidepanel-link {
  color: var(--fg);
  text-decoration: none;
  font-size: 0.95rem;
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  padding: 0.45rem 0.6rem;
  background: var(--bar);
}

#app-shell-root .app-sidepanel-link:hover {
  background: var(--bg);
}

#app-shell-root .app-sidepanel h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

#app-shell-root .app-sidepanel-auth {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

#app-shell-root .app-bottombar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bar);
  border-top: 1px solid var(--border);
  z-index: 50;
}

.is-inactive {
  opacity: 0.45;
}

/* Literal pane: apply small-caps only to literal English word tokens. */
.literal-pane .word-token {
  font-variant: all-small-caps;
}

/* Runtime override: ensure long word metadata popovers remain fully readable. */
.word-popover {
  max-height: min(72dvh, 34rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  #app-shell-root .app-topbar > .app-topbar-home,
  #app-shell-root .app-topbar > .app-checkrow,
  #app-shell-root .app-topbar > .app-topbar-link {
    display: none;
  }

  #app-shell-root .app-topbar > .app-auth-cluster {
    display: none;
  }
}

@media (min-width: 900px) {
  body.with-app-shell {
    padding-bottom: 0;
  }

  #app-shell-root .app-bottombar {
    display: none;
  }
}
`;

  if (!qs('#app-shell-style')) {
    const style = document.createElement('style');
    style.id = 'app-shell-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (!qs('#app-shell-root')) {
    document.body.insertAdjacentHTML(
      'afterbegin',
      `
<div id="app-shell-root">
  <header class="app-topbar">
    <button type="button" data-action="menu-open" aria-label="Open menu">☰</button>
    <a class="app-topbar-home" href="/">ServeWell.Net</a>
    <a class="app-topbar-link" href="/features">Features</a>
    <a class="app-topbar-link" href="/whats-next">What's Next</a>
    <a class="app-topbar-link" href="/about">About</a>
    <span class="app-spacer"></span>
    <div class="app-auth-cluster">
      <button type="button" class="app-auth-menu-toggle" data-auth-menu-toggle aria-haspopup="true" aria-expanded="false">Account</button>
      <div class="app-auth-menu" data-auth-menu hidden>
        <div class="app-auth-menu-status" data-auth-menu-status>Not signed in</div>
        <div class="app-auth-menu-copy" data-auth-menu-copy>Magic-link sign-in unlocks account features like role-based tools and contribution workflows, not just voting.</div>
        <div class="app-auth-menu-actions">
          <button type="button" class="app-auth-button" data-auth-button>Sign in</button>
        </div>
      </div>
    </div>
  </header>

  <aside class="app-sidepanel">
    <div class="app-sidepanel-header">
      <a class="app-sidepanel-home" href="/">ServeWell.Net</a>
      <button type="button" data-action="menu-close">✕</button>
    </div>

    <section class="app-sidepanel-links">
      <a class="app-sidepanel-link" href="/features">Features</a>
      <a class="app-sidepanel-link" href="/whats-next">What's Next</a>
      <a class="app-sidepanel-link" href="/about">About</a>
      <a class="app-sidepanel-link" href="/list-to-moderate" data-moderation-link hidden>List to Moderate (0)</a>
    </section>

    <section>
      <h3>Account</h3>
      <div class="app-sidepanel-auth">
        <span class="app-sidepanel-auth-status" data-auth-panel-status>Not signed in</span>
        <button type="button" class="app-sidepanel-auth-button" data-auth-button>Sign in</button>
      </div>
    </section>

    <section>
      <label class="app-checkrow">
        <input type="checkbox" data-setting="dark-mode">
        <span>Dark mode</span>
        <a class="app-checkrow-info" href="/features#need-dark-mode" title="Open details" aria-label="Open details for Dark mode">i</a>
      </label>
    </section>

    <section>
      <div id="app-module-list"></div>
    </section>
  </aside>

  <div class="app-overlay" data-action="menu-close"></div>

  <nav class="app-bottombar">
    <button type="button" data-action="menu-open">Menu</button>
    <button type="button" data-action="scroll-top">Top</button>
  </nav>

  <div class="app-auth-modal" data-auth-modal hidden>
    <div class="app-auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="app-auth-modal-title">
      <div class="app-auth-modal-header">
        <h3 class="app-auth-modal-title" id="app-auth-modal-title">Sign in</h3>
        <button type="button" class="app-auth-modal-close" data-auth-modal-close aria-label="Close sign-in dialog">✕</button>
      </div>
      <p class="app-auth-modal-copy">We promise never to send you update emails unless we get your permission first. So please enter your trusted email address and then look for a sign-in link in your inbox.</p>
      <form class="app-auth-modal-form" data-auth-form>
        <label class="app-auth-modal-label">
          <span>Trusted email address</span>
          <input class="app-auth-modal-input" type="email" data-auth-email autocomplete="email" inputmode="email" placeholder="name@example.com" required>
        </label>
        <p class="app-auth-modal-message" data-auth-modal-message hidden></p>
        <div class="app-auth-modal-actions">
          <button type="button" class="app-auth-modal-secondary" data-auth-modal-close>Cancel</button>
          <button type="submit" class="app-auth-modal-submit" data-auth-submit>Send sign-in link</button>
        </div>
      </form>
    </div>
  </div>
</div>`
    );
  }

  document.body.classList.add('with-app-shell');

  // Remove legacy static link emitted by older generated pages.
  const legacyHomeLink = document.querySelector<HTMLAnchorElement>('body > a[href="/"]');
  if (legacyHomeLink?.textContent?.trim() === 'Back to Home') {
    legacyHomeLink.remove();
  }

  // Remove legacy chapter-note text from previously generated pages.
  const legacyChapterNote = document.querySelector<HTMLParagraphElement>('main.chapter-page > p.chapter-note');
  legacyChapterNote?.remove();

  // Filter removed metadata fields from word popovers on already-generated pages.
  const sharedWordPopover = document.querySelector<HTMLElement>('.shared-word-popover');
  if (sharedWordPopover) {
    const hiddenLabels = new Set([
      'Snippet', 'Word Position', 'Morpheme Gloss',
      'Segment In Morpheme', 'Segments In Morpheme',
      'Grammar Code', 'Grammar Function'
    ]);

    sharedWordPopover.addEventListener('toggle', (event) => {
      if ((event as ToggleEvent).newState !== 'open') return;
      sharedWordPopover.querySelectorAll<HTMLElement>('.word-meta-row').forEach((row) => {
        const label = row.querySelector('.word-meta-label');
        if (label && hiddenLabels.has(label.textContent || '')) {
          row.remove();
        }
      });
    });
  }

  function openPanel() {
    document.body.classList.add('app-panel-open');
  }

  function closePanel() {
    document.body.classList.remove('app-panel-open');
  }

  const authMenu = qs<HTMLElement>('[data-auth-menu]');
  const authMenuToggle = qs<HTMLButtonElement>('[data-auth-menu-toggle]');
  const authModal = qs<HTMLElement>('[data-auth-modal]');
  const authForm = qs<HTMLFormElement>('[data-auth-form]');
  const authEmailInput = qs<HTMLInputElement>('[data-auth-email]');
  const authModalMessage = qs<HTMLElement>('[data-auth-modal-message]');
  const authSubmit = qs<HTMLButtonElement>('[data-auth-submit]');

  function closeAuthMenu() {
    authMenu?.setAttribute('hidden', '');
    authMenuToggle?.setAttribute('aria-expanded', 'false');
  }

  function openAuthMenu() {
    authMenu?.removeAttribute('hidden');
    authMenuToggle?.setAttribute('aria-expanded', 'true');
  }

  function setAuthModalMessage(message: string, tone: 'success' | 'error') {
    if (!authModalMessage) return;
    authModalMessage.hidden = false;
    authModalMessage.textContent = message;
    authModalMessage.dataset.tone = tone;
  }

  function clearAuthModalMessage() {
    if (!authModalMessage) return;
    authModalMessage.hidden = true;
    authModalMessage.textContent = '';
    delete authModalMessage.dataset.tone;
  }

  function openAuthModal() {
    closeAuthMenu();
    clearAuthModalMessage();
    authForm?.reset();
    authModal?.removeAttribute('hidden');
    window.setTimeout(() => authEmailInput?.focus(), 0);
  }

  function closeAuthModal() {
    authModal?.setAttribute('hidden', '');
    clearAuthModalMessage();
  }

  function syncThemeInputs(theme: 'light' | 'dark') {
    const isDark = theme === 'dark';
    qsa<HTMLInputElement>('input[data-setting="dark-mode"]').forEach((input) => {
      input.checked = isDark;
    });
  }

  type AuthState = {
    authenticated: boolean;
    userId?: string;
    email?: string;
    roles?: string[];
  };

  let authState: AuthState = { authenticated: false };
  let moderatorModeEnabled = false;
  let moderationQueueCount = 0;

  function dispatchAuthState() {
    window.dispatchEvent(new CustomEvent('servewell-auth-changed', {
      detail: { ...authState }
    }));
  }

  function hasModeratorRole(): boolean {
    return Boolean(authState.authenticated && authState.roles?.includes('moderator'));
  }

  function syncModerationUi() {
    const link = qs<HTMLAnchorElement>('[data-moderation-link]');
    if (!link) return;

    const visible = hasModeratorRole() && moderatorModeEnabled;
    link.hidden = !visible;
    if (visible) {
      link.textContent = `List to Moderate (${moderationQueueCount})`;
    }
  }

  async function refreshModerationQueueCount() {
    if (!hasModeratorRole() || !moderatorModeEnabled) {
      moderationQueueCount = 0;
      syncModerationUi();
      return;
    }

    try {
      const response = await fetch('/api/moderation/verse-commentary/queue', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Could not load moderation queue');
      const data = await response.json() as { count?: unknown };
      moderationQueueCount = typeof data.count === 'number' && Number.isFinite(data.count)
        ? Math.max(0, Math.floor(data.count))
        : 0;
    } catch {
      moderationQueueCount = 0;
    }

    syncModerationUi();
  }

  function syncAuthUi() {
    const statusText = authState.authenticated && authState.email
      ? `Signed in as ${authState.email}`
      : 'Not signed in';

    qsa<HTMLElement>('[data-auth-menu-status]').forEach((el) => {
      el.textContent = statusText;
    });

    qsa<HTMLElement>('[data-auth-menu-copy]').forEach((el) => {
      el.textContent = authState.authenticated
        ? 'You are signed in and can use account features, including role-based tools and contribution workflows.'
        : 'Magic-link sign-in unlocks account features like role-based tools and contribution workflows, not just voting.';
    });

    qsa<HTMLElement>('[data-auth-panel-status]').forEach((el) => {
      el.textContent = statusText;
    });

    qsa<HTMLButtonElement>('[data-auth-button]').forEach((button) => {
      button.textContent = authState.authenticated ? 'Sign out' : 'Sign in';
      button.setAttribute('aria-label', authState.authenticated ? 'Sign out' : 'Sign in');
    });

    dispatchAuthState();
    syncModerationUi();
  }

  async function refreshAuthState() {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Could not load auth state');

      const data = await response.json() as { authenticated?: boolean; email?: string };
      authState = {
        authenticated: Boolean(data.authenticated),
        userId: typeof (data as any).userId === 'string' ? (data as any).userId : undefined,
        email: data.email,
        roles: Array.isArray((data as any).roles) ? (data as any).roles.filter((role: unknown) => typeof role === 'string') : []
      };
    } catch (error) {
      console.warn('Could not refresh auth state', error);
      authState = { authenticated: false, roles: [] };
    }

    syncAuthUi();
    void refreshModerationQueueCount();
  }

  async function requestMagicLink() {
    const email = authEmailInput?.value.trim().toLowerCase() || '';
    if (!email) return;

    clearAuthModalMessage();
    if (authSubmit) {
      authSubmit.disabled = true;
      authSubmit.textContent = 'Sending...';
    }

    const response = await fetch('/api/auth/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json() as { error?: string; dev_magic_link?: string };

    if (!response.ok) {
      throw new Error(data.error || 'Could not request sign-in link');
    }

    if (data.dev_magic_link) {
      setAuthModalMessage(`Development sign-in link: ${data.dev_magic_link}`, 'success');
      return;
    }

    authForm?.reset();
    setAuthModalMessage('Check your email for a sign-in link.', 'success');
  }

  async function signOut() {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      throw new Error('Could not sign out');
    }
    authState = { authenticated: false };
    syncAuthUi();
    closeAuthMenu();
  }

  authMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (authMenu?.hasAttribute('hidden')) {
      openAuthMenu();
    } else {
      closeAuthMenu();
    }
  });

  qsa<HTMLElement>('[data-auth-modal-close]').forEach((button) => {
    button.addEventListener('click', () => {
      closeAuthModal();
    });
  });

  authModal?.addEventListener('click', (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });

  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await requestMagicLink();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication request failed';
      setAuthModalMessage(message, 'error');
    } finally {
      if (authSubmit) {
        authSubmit.disabled = false;
        authSubmit.textContent = 'Send sign-in link';
      }
    }
  });

  qsa<HTMLButtonElement>('[data-auth-button]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        if (authState.authenticated) {
          await signOut();
        } else {
          openAuthModal();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication request failed';
        setAuthModalMessage(message, 'error');
      }
    });
  });

  void refreshAuthState();

  window.addEventListener('focus', () => {
    void refreshAuthState();
  });

  window.addEventListener('pageshow', () => {
    void refreshAuthState();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void refreshAuthState();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('.app-auth-cluster')) {
      closeAuthMenu();
    }
  });

  window.addEventListener('servewell-moderator-mode-changed', (event) => {
    moderatorModeEnabled = Boolean((event as CustomEvent).detail?.enabled);
    void refreshModerationQueueCount();
  });

  window.addEventListener('servewell-moderation-queue-changed', () => {
    void refreshModerationQueueCount();
  });

  function appendDemoLine(text: string) {
    const output = qs<HTMLDivElement>('#demoOutput');
    if (!output) return;

    const line = document.createElement('div');
    line.textContent = text;
    output.insertBefore(line, output.firstChild);
  }

  function syncModuleInputs(moduleId: string, active: boolean) {
    qsa<HTMLInputElement>(`input[data-module-id="${moduleId}"]`).forEach((input) => {
      input.checked = active;
    });
  }

  function syncDemoButtons(active: boolean) {
    qsa<HTMLElement>('[data-module-target="demo"]').forEach((el) => {
      const inactive = !active;
      el.classList.toggle('is-inactive', inactive);
      el.setAttribute('aria-disabled', inactive ? 'true' : 'false');

      if (el instanceof HTMLButtonElement) {
        el.disabled = inactive;
      }
    });
  }

  function renderModuleList(modules: ShellModuleListItem[]) {
    const container = qs<HTMLDivElement>('#app-module-list');
    if (!container) return;

    container.innerHTML = modules
      .map((module) => {
        const checked = module.active ? ' checked' : '';
        const infoLink = module.infoHref
          ? `<a class="app-checkrow-info" href="${module.infoHref}" title="Open details" aria-label="Open details for ${module.label}">i</a>`
          : '';
        return `
<label class="app-checkrow">
  <input type="checkbox" data-module-id="${module.id}"${checked}>
  <span>${module.label}</span>
  ${infoLink}
</label>`;
      })
      .join('\n');
  }

  return {
    openPanel,
    closePanel,
    syncThemeInputs,
    appendDemoLine,
    syncModuleInputs,
    syncDemoButtons,
    renderModuleList
  };
}