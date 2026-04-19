"use strict";
(() => {
  // src/phasingScripts/phase2To3/createDelegator.ts
  function createDelegator() {
    const sublistenersByEvent = {};
    const dispatchersByEvent = {};
    function ensureDispatcher(eventName) {
      if (dispatchersByEvent[eventName]) return;
      const dispatcher = (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target) return;
        const sublisteners = (sublistenersByEvent[eventName] || []).slice();
        for (const sublistener of sublisteners) {
          const matched = target.closest(sublistener.selector);
          if (!matched) continue;
          if (matched.tagName.toUpperCase() !== sublistener.tagName.toUpperCase()) continue;
          sublistener.handle(matched, event);
        }
      };
      dispatchersByEvent[eventName] = dispatcher;
      document.addEventListener(eventName, dispatcher);
    }
    function registerSublistener(sublistener) {
      if (!sublistenersByEvent[sublistener.eventName]) {
        sublistenersByEvent[sublistener.eventName] = [];
      }
      sublistenersByEvent[sublistener.eventName].push(sublistener);
      ensureDispatcher(sublistener.eventName);
      return function deregister() {
        const bucket = sublistenersByEvent[sublistener.eventName];
        if (!bucket) return;
        const index = bucket.indexOf(sublistener);
        if (index !== -1) bucket.splice(index, 1);
        if (bucket.length === 0 && dispatchersByEvent[sublistener.eventName]) {
          document.removeEventListener(sublistener.eventName, dispatchersByEvent[sublistener.eventName]);
          delete dispatchersByEvent[sublistener.eventName];
        }
      };
    }
    return { registerSublistener };
  }

  // src/phasingScripts/phase2To3/createShell.ts
  function qs(selector) {
    return document.querySelector(selector);
  }
  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }
  function createShell() {
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
  #app-shell-root .app-topbar > .app-topbar-link,
  #app-shell-root .app-topbar > .app-topbar-search {
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
    if (!qs("#app-shell-style")) {
      const style = document.createElement("style");
      style.id = "app-shell-style";
      style.textContent = css;
      document.head.appendChild(style);
    }
    if (!qs("#app-shell-root")) {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `
<div id="app-shell-root">
  <header class="app-topbar">
    <button type="button" data-action="menu-open" aria-label="Open menu">\u2630</button>
    <a class="app-topbar-home" href="/">ServeWell.Net</a>
    <a class="app-topbar-link" href="/features">Features</a>
    <a class="app-topbar-link" href="/whats-next">What's Next</a>
    <a class="app-topbar-link" href="/about">About</a>
    <button type="button" id="ws-search-topbar-btn" class="app-auth-menu-toggle app-topbar-search" aria-label="Search words">Search</button>
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
      <button type="button" data-action="menu-close">\u2715</button>
    </div>

    <section class="app-sidepanel-links">
      <a class="app-sidepanel-link" href="/features">Features</a>
      <a class="app-sidepanel-link" href="/whats-new">What's New</a>
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
    <button type="button" id="ws-search-bottombar-btn" class="ws-search-btn" aria-label="Search words">Search</button>
    <button type="button" data-action="scroll-top">Top</button>
  </nav>

  <div class="app-auth-modal" data-auth-modal hidden>
    <div class="app-auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="app-auth-modal-title">
      <div class="app-auth-modal-header">
        <h3 class="app-auth-modal-title" id="app-auth-modal-title">Sign in</h3>
        <button type="button" class="app-auth-modal-close" data-auth-modal-close aria-label="Close sign-in dialog">\u2715</button>
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
    document.body.classList.add("with-app-shell");
    const legacyHomeLink = document.querySelector('body > a[href="/"]');
    if (legacyHomeLink?.textContent?.trim() === "Back to Home") {
      legacyHomeLink.remove();
    }
    const legacyChapterNote = document.querySelector("main.chapter-page > p.chapter-note");
    legacyChapterNote?.remove();
    const sharedWordPopover = document.querySelector(".shared-word-popover");
    if (sharedWordPopover) {
      const hiddenLabels = /* @__PURE__ */ new Set([
        "Snippet",
        "Word Position",
        "Morpheme Gloss",
        "Segment In Morpheme",
        "Segments In Morpheme",
        "Grammar Code",
        "Grammar Function"
      ]);
      sharedWordPopover.addEventListener("toggle", (event) => {
        if (event.newState !== "open") return;
        sharedWordPopover.querySelectorAll(".word-meta-row").forEach((row) => {
          const label = row.querySelector(".word-meta-label");
          if (label && hiddenLabels.has(label.textContent || "")) {
            row.remove();
          }
        });
      });
    }
    function openPanel() {
      document.body.classList.add("app-panel-open");
    }
    function closePanel() {
      document.body.classList.remove("app-panel-open");
    }
    const authMenu = qs("[data-auth-menu]");
    const authMenuToggle = qs("[data-auth-menu-toggle]");
    const authModal = qs("[data-auth-modal]");
    const authForm = qs("[data-auth-form]");
    const authEmailInput = qs("[data-auth-email]");
    const authModalMessage = qs("[data-auth-modal-message]");
    const authSubmit = qs("[data-auth-submit]");
    function closeAuthMenu() {
      authMenu?.setAttribute("hidden", "");
      authMenuToggle?.setAttribute("aria-expanded", "false");
    }
    function openAuthMenu() {
      authMenu?.removeAttribute("hidden");
      authMenuToggle?.setAttribute("aria-expanded", "true");
    }
    function setAuthModalMessage(message, tone) {
      if (!authModalMessage) return;
      authModalMessage.hidden = false;
      authModalMessage.textContent = message;
      authModalMessage.dataset.tone = tone;
    }
    function clearAuthModalMessage() {
      if (!authModalMessage) return;
      authModalMessage.hidden = true;
      authModalMessage.textContent = "";
      delete authModalMessage.dataset.tone;
    }
    function openAuthModal() {
      closeAuthMenu();
      clearAuthModalMessage();
      authForm?.reset();
      authModal?.removeAttribute("hidden");
      window.setTimeout(() => authEmailInput?.focus(), 0);
    }
    function closeAuthModal() {
      authModal?.setAttribute("hidden", "");
      clearAuthModalMessage();
    }
    function syncThemeInputs(theme) {
      const isDark = theme === "dark";
      qsa('input[data-setting="dark-mode"]').forEach((input) => {
        input.checked = isDark;
      });
    }
    let authState = { authenticated: false };
    let moderatorModeEnabled = false;
    let moderationQueueCount = 0;
    function dispatchAuthState() {
      window.dispatchEvent(new CustomEvent("servewell-auth-changed", {
        detail: { ...authState }
      }));
    }
    function hasModeratorRole() {
      return Boolean(authState.authenticated && authState.roles?.includes("moderator"));
    }
    function syncModerationUi() {
      const link = qs("[data-moderation-link]");
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
        const response = await fetch("/api/moderation/verse-commentary/queue", {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Could not load moderation queue");
        const data = await response.json();
        moderationQueueCount = typeof data.count === "number" && Number.isFinite(data.count) ? Math.max(0, Math.floor(data.count)) : 0;
      } catch {
        moderationQueueCount = 0;
      }
      syncModerationUi();
    }
    function syncAuthUi() {
      const statusText = authState.authenticated && authState.email ? `Signed in as ${authState.email}` : "Not signed in";
      qsa("[data-auth-menu-status]").forEach((el) => {
        el.textContent = statusText;
      });
      qsa("[data-auth-menu-copy]").forEach((el) => {
        el.textContent = authState.authenticated ? "You are signed in and can use account features, including role-based tools and contribution workflows." : "Magic-link sign-in unlocks account features like role-based tools and contribution workflows, not just voting.";
      });
      qsa("[data-auth-panel-status]").forEach((el) => {
        el.textContent = statusText;
      });
      qsa("[data-auth-button]").forEach((button) => {
        button.textContent = authState.authenticated ? "Sign out" : "Sign in";
        button.setAttribute("aria-label", authState.authenticated ? "Sign out" : "Sign in");
      });
      dispatchAuthState();
      syncModerationUi();
    }
    async function refreshAuthState() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Could not load auth state");
        const data = await response.json();
        authState = {
          authenticated: Boolean(data.authenticated),
          userId: typeof data.userId === "string" ? data.userId : void 0,
          email: data.email,
          roles: Array.isArray(data.roles) ? data.roles.filter((role) => typeof role === "string") : []
        };
      } catch (error) {
        console.warn("Could not refresh auth state", error);
        authState = { authenticated: false, roles: [] };
      }
      syncAuthUi();
      void refreshModerationQueueCount();
    }
    async function requestMagicLink() {
      const email = authEmailInput?.value.trim().toLowerCase() || "";
      if (!email) return;
      clearAuthModalMessage();
      if (authSubmit) {
        authSubmit.disabled = true;
        authSubmit.textContent = "Sending...";
      }
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not request sign-in link");
      }
      if (data.dev_magic_link) {
        setAuthModalMessage(`Development sign-in link: ${data.dev_magic_link}`, "success");
        return;
      }
      authForm?.reset();
      setAuthModalMessage("Check your email for a sign-in link.", "success");
    }
    async function signOut() {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        throw new Error("Could not sign out");
      }
      authState = { authenticated: false };
      syncAuthUi();
      closeAuthMenu();
    }
    authMenuToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (authMenu?.hasAttribute("hidden")) {
        openAuthMenu();
      } else {
        closeAuthMenu();
      }
    });
    qsa("[data-auth-modal-close]").forEach((button) => {
      button.addEventListener("click", () => {
        closeAuthModal();
      });
    });
    authModal?.addEventListener("click", (event) => {
      if (event.target === authModal) {
        closeAuthModal();
      }
    });
    authForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await requestMagicLink();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Authentication request failed";
        setAuthModalMessage(message, "error");
      } finally {
        if (authSubmit) {
          authSubmit.disabled = false;
          authSubmit.textContent = "Send sign-in link";
        }
      }
    });
    qsa("[data-auth-button]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          if (authState.authenticated) {
            await signOut();
          } else {
            openAuthModal();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Authentication request failed";
          setAuthModalMessage(message, "error");
        }
      });
    });
    void refreshAuthState();
    window.addEventListener("focus", () => {
      void refreshAuthState();
    });
    window.addEventListener("pageshow", () => {
      void refreshAuthState();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void refreshAuthState();
      }
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(".app-auth-cluster")) {
        closeAuthMenu();
      }
    });
    window.addEventListener("servewell-moderator-mode-changed", (event) => {
      moderatorModeEnabled = Boolean(event.detail?.enabled);
      void refreshModerationQueueCount();
    });
    window.addEventListener("servewell-moderation-queue-changed", () => {
      void refreshModerationQueueCount();
    });
    function appendDemoLine(text) {
      const output = qs("#demoOutput");
      if (!output) return;
      const line = document.createElement("div");
      line.textContent = text;
      output.insertBefore(line, output.firstChild);
    }
    function syncModuleInputs(moduleId, active) {
      qsa(`input[data-module-id="${moduleId}"]`).forEach((input) => {
        input.checked = active;
      });
    }
    function syncDemoButtons(active) {
      qsa('[data-module-target="demo"]').forEach((el) => {
        const inactive = !active;
        el.classList.toggle("is-inactive", inactive);
        el.setAttribute("aria-disabled", inactive ? "true" : "false");
        if (el instanceof HTMLButtonElement) {
          el.disabled = inactive;
        }
      });
    }
    function renderModuleList(modules) {
      const container = qs("#app-module-list");
      if (!container) return;
      container.innerHTML = modules.map((module) => {
        const checked = module.active ? " checked" : "";
        const infoLink = module.infoHref ? `<a class="app-checkrow-info" href="${module.infoHref}" title="Open details" aria-label="Open details for ${module.label}">i</a>` : "";
        return `
<label class="app-checkrow">
  <input type="checkbox" data-module-id="${module.id}"${checked}>
  <span>${module.label}</span>
  ${infoLink}
</label>`;
      }).join("\n");
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

  // src/phasingScripts/phase2To3/createTheme.ts
  function createTheme(shell) {
    const themeStorageKey = "servewell-theme";
    function set(theme) {
      document.documentElement.dataset.theme = theme;
      shell.syncThemeInputs(theme);
      try {
        localStorage.setItem(themeStorageKey, theme);
      } catch {
      }
    }
    function restore() {
      let savedTheme = "";
      try {
        savedTheme = localStorage.getItem(themeStorageKey) || "";
      } catch {
      }
      set(savedTheme === "dark" ? "dark" : "light");
    }
    return { set, restore };
  }

  // src/phasingScripts/phase2To3/createModuleRegistry.ts
  var STORAGE_KEY_PREFIX = "servewell-module-";
  function storageKey(id) {
    return `${STORAGE_KEY_PREFIX}${id}`;
  }
  function createModuleRegistry(shell) {
    const modules = {};
    function register(module) {
      modules[module.id] = module;
    }
    function render() {
      shell.renderModuleList(Object.values(modules).filter((module) => module.includeInMenu !== false && module.available !== false));
    }
    function activate(id) {
      const module = modules[id];
      if (!module) return;
      module.activate();
      shell.syncModuleInputs(id, true);
      try {
        localStorage.setItem(storageKey(id), "1");
      } catch {
      }
    }
    function deactivate(id, options) {
      const module = modules[id];
      if (!module) return;
      module.deactivate();
      shell.syncModuleInputs(id, false);
      if (options?.persist === false) return;
      try {
        localStorage.setItem(storageKey(id), "0");
      } catch {
      }
    }
    function isActive(id) {
      return !!modules[id]?.active;
    }
    function getAll() {
      return Object.values(modules);
    }
    function restoreFromStorage() {
      Object.values(modules).forEach((module) => {
        if (module.includeInMenu === false) return;
        if (module.available === false) return;
        let saved = "";
        try {
          saved = localStorage.getItem(storageKey(module.id)) ?? "";
        } catch {
        }
        if (saved === "1") activate(module.id);
        else if (!saved && module.defaultActive) activate(module.id);
      });
    }
    return { register, render, activate, deactivate, isActive, getAll, restoreFromStorage };
  }

  // src/phasingScripts/phase2To3/registerShellListeners.ts
  function registerShellListeners(delegator, shell, theme, modules) {
    delegator.registerSublistener({
      eventName: "click",
      tagName: "BUTTON",
      selector: 'button[data-action="menu-open"]',
      handle() {
        shell.openPanel();
      }
    });
    delegator.registerSublistener({
      eventName: "click",
      tagName: "BUTTON",
      selector: 'button[data-action="menu-close"]',
      handle() {
        shell.closePanel();
      }
    });
    delegator.registerSublistener({
      eventName: "click",
      tagName: "DIV",
      selector: 'div[data-action="menu-close"]',
      handle() {
        shell.closePanel();
      }
    });
    delegator.registerSublistener({
      eventName: "click",
      tagName: "BUTTON",
      selector: 'button[data-action="scroll-top"]',
      handle() {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    delegator.registerSublistener({
      eventName: "change",
      tagName: "INPUT",
      selector: 'input[data-setting="dark-mode"]',
      handle(matched) {
        const input = matched;
        theme.set(input.checked ? "dark" : "light");
      }
    });
    delegator.registerSublistener({
      eventName: "change",
      tagName: "INPUT",
      selector: "input[data-module-id]",
      handle(matched) {
        const input = matched;
        const moduleId = input.getAttribute("data-module-id");
        if (!moduleId) return;
        if (input.checked) modules.activate(moduleId);
        else modules.deactivate(moduleId);
      }
    });
  }

  // src/phasingScripts/phase2To3/createDemoModule.ts
  function qs2(selector) {
    return document.querySelector(selector);
  }
  function createDemoModule(delegator, shell) {
    if (!qs2("#framework-demo-root")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
<section id="framework-demo-root">
  <h2>Framework demo</h2>
  <p>Turn the Demo module off in the side panel, then tap Demo again.</p>
  <div class="demo-buttons">
    <button type="button" data-action="demo-ping" data-module-target="demo">Demo button</button>
    <button type="button" data-action="demo-clear" data-module-target="demo">Clear demo log</button>
  </div>
  <div id="demoOutput"></div>
</section>`
      );
    }
    if (!qs2("#demo-style")) {
      const style = document.createElement("style");
      style.id = "demo-style";
      style.textContent = `
#framework-demo-root {
  margin: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}

#framework-demo-root .demo-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

#demoOutput {
  margin-top: 0.75rem;
  padding: 0.75rem;
  min-height: 3rem;
  border: 1px dashed var(--border);
  color: var(--muted);
}
`;
      document.head.appendChild(style);
    }
    function appendDemoLine(text) {
      const output = qs2("#demoOutput");
      if (!output) return;
      const line = document.createElement("div");
      line.textContent = text;
      output.insertBefore(line, output.firstChild);
    }
    const module = {
      id: "demo",
      label: "Demo module",
      active: false,
      activate() {
        if (module.active) return;
        const disposers = [
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: 'button[data-action="demo-ping"]',
            handle() {
              appendDemoLine(`Demo handled at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
            }
          }),
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: 'button[data-action="demo-clear"]',
            handle() {
              const output = qs2("#demoOutput");
              if (!output) return;
              output.innerHTML = "";
              appendDemoLine("Demo log cleared");
            }
          })
        ];
        module.active = true;
        shell.syncModuleInputs("demo", true);
        shell.syncDemoButtons(true);
        appendDemoLine("Demo module activated");
        module._disposers = disposers;
      },
      deactivate() {
        if (!module.active) return;
        const disposers = module._disposers || [];
        while (disposers.length > 0) {
          const dispose = disposers.pop();
          if (dispose) dispose();
        }
        module.active = false;
        shell.syncModuleInputs("demo", false);
        shell.syncDemoButtons(false);
        appendDemoLine("Demo module deactivated");
      }
    };
    return module;
  }

  // src/phasingScripts/phase2To3/createBibleNavModule.ts
  var navData = null;
  var navDataLoading = false;
  function loadNavData() {
    if (navData) return navData;
    try {
      const el = document.getElementById("bible-nav-data");
      if (el) navData = JSON.parse(el.textContent ?? "{}");
    } catch {
    }
    if (!navData) navData = { books: [], sections: [] };
    return navData;
  }
  function parseNavData(raw) {
    try {
      const parsed = JSON.parse(raw);
      const books = Array.isArray(parsed.books) ? parsed.books : [];
      const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      if (books.length === 0) return null;
      return {
        books,
        sections
      };
    } catch {
      return null;
    }
  }
  function loadNavDataFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const el = doc.getElementById("bible-nav-data");
    if (!el?.textContent) return null;
    return parseNavData(el.textContent);
  }
  var STORAGE_KEY_BOOKMARKS = "servewell-nav-bookmarks";
  var STORAGE_KEY_ALPHABETICAL = "servewell-nav-alphabetical";
  function isChapterRoute(pathname) {
    return /^\/-\/[^/]+\/(\d+)(?:\.html)?\/?$/.test(pathname);
  }
  function qs3(selector) {
    return document.querySelector(selector);
  }
  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var CSS = `
#bible-nav-btns {
  display: flex;
  gap: 0.25rem;
  margin-left: 1rem;
  align-items: center;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

#bible-nav-btns::-webkit-scrollbar {
  display: none;
}

#bible-nav-btns ~ .app-spacer {
  display: none;
}

.nav-ref-chip {
  display: inline-flex;
  align-items: stretch;
  min-width: 0;
  flex-shrink: 0;
}

.nav-ref-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  text-decoration: none;
}

.nav-ref-btn:hover { background: var(--bg); }

.nav-ref-btn--with-remove {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.nav-ref-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.55rem;
  padding: 0 0.32rem;
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 0.375rem 0.375rem 0;
  background: var(--bar);
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.nav-ref-chip-remove:hover {
  background: var(--bg);
  color: var(--fg);
}

.nav-radio {
  font-size: 0.65em;
  line-height: 1;
  color: var(--muted);
  opacity: 0.45;
}

.nav-radio--enabled         { opacity: 1; color: var(--muted); }
.nav-radio--enabled-selected { opacity: 1; color: var(--fg); }

#bible-nav-popover {
  position: fixed;
  top: 62px;
  left: 0.75rem;
  width: min(96vw, 400px);
  max-height: calc(100dvh - 130px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--panel);
  padding: 0;
  margin: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

#bible-nav-popover:not(:popover-open) { display: none; }

.nav-pop-inner  { padding: 0.65rem 0.75rem; }

.nav-pop-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.nav-pop-controls {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.55rem;
}

.nav-check-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--fg);
  cursor: pointer;
}

.nav-check-row input {
  accent-color: #3b82f6;
}

.nav-goto-btn {
  display: inline-block;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.85rem;
  text-decoration: none;
  font-weight: 600;
}

.nav-goto-btn:hover { background: var(--bg); }

.nav-remove-btn {
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.nav-remove-btn:hover { background: var(--bg); }

.nav-book-grid  { display: flex; flex-direction: column; gap: 0.2rem; }

.nav-book-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.nav-book-btn {
  padding: 0.18rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 0.22rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
}

.nav-book-btn:hover { background: var(--bg); }

.nav-ch-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.nav-ch-btn {
  display: inline-block;
  padding: 0.18rem 0.3rem;
  min-width: 1.8rem;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 0.22rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.78rem;
  text-decoration: none;
}

.nav-ch-btn:hover { background: var(--bg); }

.nav-back-btn {
  border: none;
  background: none;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  color: var(--muted);
  padding: 0 0.15rem;
  line-height: 1;
}

.nav-back-btn:hover { color: var(--fg); }
`;
  function createBibleNavModule(delegator) {
    let bookmarks = [];
    let alphabetical = false;
    let activeSlot = "current";
    let navView = "books";
    let navSelectedBook = null;
    const disposers = [];
    function ensureNavDataLoaded() {
      if (loadNavData().books.length > 0) return;
      if (navDataLoading) return;
      navDataLoading = true;
      fetch("/-/Genesis/1").then((res) => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))).then((html) => {
        const loaded = loadNavDataFromHtml(html);
        if (loaded) {
          navData = loaded;
          renderTopbar();
          renderPopover();
        }
      }).catch(() => {
      }).finally(() => {
        navDataLoading = false;
      });
    }
    function getCurrentRef() {
      if (typeof window !== "undefined" && !isChapterRoute(window.location.pathname)) return null;
      const main = qs3("main.chapter-page");
      if (!main) return null;
      const book = main.dataset.book ?? "";
      const chapter = parseInt(main.dataset.chapter ?? "0", 10);
      return book && chapter ? { book, chapter } : null;
    }
    function loadStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
        bookmarks = raw ? JSON.parse(raw) : [];
      } catch {
        bookmarks = [];
      }
      try {
        alphabetical = localStorage.getItem(STORAGE_KEY_ALPHABETICAL) === "true";
      } catch {
        alphabetical = false;
      }
    }
    function saveBookmarks() {
      try {
        localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks));
      } catch {
      }
    }
    function saveAlphabetical() {
      try {
        localStorage.setItem(STORAGE_KEY_ALPHABETICAL, String(alphabetical));
      } catch {
      }
    }
    function refsEqual(a, b) {
      return a.book === b.book && a.chapter === b.chapter;
    }
    function isCurrentBookmarked() {
      const cur = getCurrentRef();
      return !!cur && bookmarks.some((b) => refsEqual(b, cur));
    }
    function addCurrentBookmark() {
      const cur = getCurrentRef();
      if (cur && !isCurrentBookmarked()) {
        bookmarks.push(cur);
        saveBookmarks();
      }
    }
    function removeCurrentBookmark() {
      const cur = getCurrentRef();
      if (cur) {
        bookmarks = bookmarks.filter((b) => !refsEqual(b, cur));
        saveBookmarks();
      }
    }
    function removeBookmarkAt(idx) {
      bookmarks.splice(idx, 1);
      saveBookmarks();
    }
    function getBook(abbr) {
      return loadNavData().books.find((b) => b.abbr === abbr);
    }
    function refLabel(ref) {
      const book = getBook(ref.book);
      return `${book?.displayAbbr ?? ref.book}\xA0${ref.chapter}`;
    }
    function refHref(ref) {
      const book = getBook(ref.book);
      return book ? `/-/${book.url}/${ref.chapter}` : "#";
    }
    function injectOnce2() {
      if (qs3("#bible-nav-btns")) return;
      if (!qs3("#bible-nav-style")) {
        const style = document.createElement("style");
        style.id = "bible-nav-style";
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      const topbar = qs3("#app-shell-root .app-topbar");
      if (!topbar) return;
      const titleLink = topbar.querySelector(".app-topbar-home");
      const btns = document.createElement("div");
      btns.id = "bible-nav-btns";
      btns.addEventListener("wheel", (event) => {
        if (event.deltaY !== 0) {
          event.preventDefault();
          btns.scrollLeft += event.deltaY;
        }
      }, { passive: false });
      if (titleLink?.nextSibling) {
        topbar.insertBefore(btns, titleLink.nextSibling);
      } else {
        topbar.appendChild(btns);
      }
      const popover = document.createElement("div");
      popover.id = "bible-nav-popover";
      popover.setAttribute("popover", "");
      document.body.appendChild(popover);
    }
    function renderTopbar() {
      const container = qs3("#bible-nav-btns");
      if (!container) return;
      const cur = getCurrentRef();
      if (!cur) {
        container.innerHTML = `<button type="button" class="nav-ref-btn" popovertarget="bible-nav-popover" data-nav-slot="current">Bible</button>`;
        return;
      }
      const slots = [
        { ref: cur, isCurrent: true, bmIdx: -1 },
        ...bookmarks.map((b, i) => ({ ref: b, isCurrent: false, bmIdx: i })).filter((s) => !refsEqual(s.ref, cur))
      ];
      const hasMultiple = slots.length > 1;
      container.innerHTML = slots.map(({ ref, isCurrent, bmIdx }) => {
        let radioClass;
        let radioSymbol;
        if (!hasMultiple) {
          radioClass = "nav-radio";
          radioSymbol = "\u25CF";
        } else if (isCurrent) {
          radioClass = "nav-radio nav-radio--enabled-selected";
          radioSymbol = "\u25CF";
        } else {
          radioClass = "nav-radio nav-radio--enabled";
          radioSymbol = "\u25CB";
        }
        const labelHtml = `<span class="${radioClass}" aria-hidden="true">${radioSymbol}</span>${escHtml(refLabel(ref))}`;
        if (!isCurrent) {
          return `<span class="nav-ref-chip"><a class="nav-ref-btn nav-ref-btn--with-remove" href="${escHtml(refHref(ref))}">${labelHtml}</a><button type="button" class="nav-ref-chip-remove" aria-label="Remove bookmark ${escHtml(refLabel(ref))}" data-nav-remove-top-bookmark="${bmIdx}">&times;</button></span>`;
        }
        const slotData = isCurrent ? "current" : String(bmIdx);
        return `<button type="button" class="nav-ref-btn" popovertarget="bible-nav-popover" data-nav-book="${escHtml(ref.book)}" data-nav-chapter="${ref.chapter}" data-nav-slot="${slotData}">${labelHtml}</button>`;
      }).join("");
    }
    function renderPopover() {
      const popover = qs3("#bible-nav-popover");
      if (!popover) return;
      popover.innerHTML = navView === "chapters" && navSelectedBook ? renderChaptersView(navSelectedBook) : renderBooksView();
    }
    function renderBooksView() {
      ensureNavDataLoaded();
      const isCurrentSlot = activeSlot === "current";
      const bmIdx = typeof activeSlot === "number" ? activeSlot : -1;
      const currentRef = getCurrentRef();
      const slotRef = isCurrentSlot ? currentRef : bookmarks[bmIdx] ?? null;
      let topControls = "";
      if (isCurrentSlot && currentRef) {
        const checked = isCurrentBookmarked() ? " checked" : "";
        topControls = `<label class="nav-check-row"><input type="checkbox" id="nav-bookmark-chk"${checked}><span>Bookmark This Reference</span></label>`;
      } else if (slotRef) {
        const book = getBook(slotRef.book);
        const href = book ? `/-/${escHtml(book.url)}/${slotRef.chapter}` : "#";
        topControls = `<a class="nav-goto-btn" href="${href}">Go\xA0to ${escHtml(refLabel(slotRef))}</a><button type="button" class="nav-remove-btn" id="nav-remove-bookmark">Remove This Bookmark</button>`;
      }
      const alphaChecked = alphabetical ? " checked" : "";
      const alphaControl = `<label class="nav-check-row"><input type="checkbox" id="nav-alpha-chk"${alphaChecked}><span>Alphabetical</span></label>`;
      const data = loadNavData();
      if (data.books.length === 0) {
        return `<div class="nav-pop-inner">
<div class="nav-pop-header"><strong>Select A Document</strong></div>
<div class="nav-pop-controls">${topControls}${alphaControl}</div>
<div class="nav-book-grid"><div class="nav-check-row">Loading references...</div></div>
</div>`;
      }
      let booksHtml;
      if (alphabetical) {
        const sorted = [...data.books].sort((a, b) => a.displayAbbr.localeCompare(b.displayAbbr));
        const btns = sorted.map((b) => `<button type="button" class="nav-book-btn" data-nav-pick-book="${escHtml(b.abbr)}">${escHtml(b.displayAbbr)}</button>`).join("");
        booksHtml = `<div class="nav-book-group">${btns}</div>`;
      } else {
        const bookMap = new Map(data.books.map((b) => [b.abbr, b]));
        booksHtml = data.sections.map((section) => {
          const btns = section.map((abbr) => {
            const b = bookMap.get(abbr);
            if (!b) return "";
            return `<button type="button" class="nav-book-btn" data-nav-pick-book="${escHtml(b.abbr)}">${escHtml(b.displayAbbr)}</button>`;
          }).join("");
          return `<div class="nav-book-group">${btns}</div>`;
        }).join("");
      }
      return `<div class="nav-pop-inner">
<div class="nav-pop-header"><strong>Select A Document</strong></div>
<div class="nav-pop-controls">${topControls}${alphaControl}</div>
<div class="nav-book-grid">${booksHtml}</div>
</div>`;
    }
    function renderChaptersView(abbr) {
      const book = getBook(abbr);
      if (!book) return "";
      const links = Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => `<a class="nav-ch-btn" href="/-/${escHtml(book.url)}/${n}">${n}</a>`).join("");
      return `<div class="nav-pop-inner">
<div class="nav-pop-header"><button type="button" class="nav-back-btn" id="nav-back" aria-label="Back to book list">&#8249;</button><strong>${escHtml(book.name)}</strong></div>
<div class="nav-ch-grid">${links}</div>
</div>`;
    }
    const module = {
      id: "bible-nav",
      label: "Bible Navigation",
      active: false,
      includeInMenu: false,
      activate() {
        if (module.active) return;
        module.active = true;
        loadStorage();
        ensureNavDataLoaded();
        injectOnce2();
        renderTopbar();
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button.nav-ref-btn",
          handle(el) {
            const slot = el.dataset.navSlot ?? "current";
            activeSlot = slot === "current" ? "current" : parseInt(slot, 10);
            navView = "books";
            navSelectedBook = null;
            renderPopover();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button[data-nav-remove-top-bookmark]",
          handle(el, event) {
            event.preventDefault();
            const idx = parseInt(el.dataset.navRemoveTopBookmark ?? "-1", 10);
            if (idx < 0) return;
            removeBookmarkAt(idx);
            renderTopbar();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button[data-nav-pick-book]",
          handle(el) {
            navSelectedBook = el.dataset.navPickBook ?? null;
            if (navSelectedBook) {
              navView = "chapters";
              renderPopover();
            }
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button#nav-back",
          handle() {
            navView = "books";
            navSelectedBook = null;
            renderPopover();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "change",
          tagName: "INPUT",
          selector: "input#nav-bookmark-chk",
          handle(el) {
            const input = el;
            if (input.checked) {
              addCurrentBookmark();
            } else {
              removeCurrentBookmark();
            }
            renderTopbar();
            renderPopover();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button#nav-remove-bookmark",
          handle() {
            if (typeof activeSlot === "number") removeBookmarkAt(activeSlot);
            qs3("#bible-nav-popover")?.hidePopover();
            activeSlot = "current";
            renderTopbar();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "change",
          tagName: "INPUT",
          selector: "input#nav-alpha-chk",
          handle(el) {
            alphabetical = el.checked;
            saveAlphabetical();
            renderPopover();
          }
        }));
      },
      deactivate() {
        if (!module.active) return;
        module.active = false;
        while (disposers.length) disposers.pop()?.();
      }
    };
    return module;
  }

  // src/phasingScripts/phase2To3/createVerseNumberPopoverModule.ts
  var STYLE_ID = "verse-number-popover-style";
  var POPOVER_ID = "verse-number-popover";
  var COPIED_POPOVER_ID = "verse-link-copied-popover";
  var COMMENTARY_EDIT_BTN_ID = "verse-commentary-edit-btn";
  var COMMENTARY_SAVE_BTN_ID = "verse-commentary-save-btn";
  var COMMENTARY_CANCEL_BTN_ID = "verse-commentary-cancel-btn";
  var COMMENTARY_REJECTED_DISMISS_BTN_ID = "verse-commentary-rejected-dismiss-btn";
  var COMMENTARY_REJECTED_DISMISS_KEY_PREFIX = "servewell-commentary-rejected-dismissed-";
  var dismissedRejectedNoticeIds = /* @__PURE__ */ new Set();
  var CSS2 = `
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
  function qs4(selector) {
    return document.querySelector(selector);
  }
  function escHtml2(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) {
    return escHtml2(s).replace(/'/g, "&#39;");
  }
  function rejectedDismissKey(commentaryId) {
    return `${COMMENTARY_REJECTED_DISMISS_KEY_PREFIX}${commentaryId}`;
  }
  function isRejectedNoticeDismissed(commentaryId) {
    if (dismissedRejectedNoticeIds.has(commentaryId)) return true;
    try {
      return localStorage.getItem(rejectedDismissKey(commentaryId)) === "1";
    } catch {
      return false;
    }
  }
  function dismissRejectedNotice(commentaryId) {
    dismissedRejectedNoticeIds.add(commentaryId);
    try {
      localStorage.setItem(rejectedDismissKey(commentaryId), "1");
    } catch {
    }
  }
  var COMMENTARY_FIELDS = [
    {
      key: "godAndPlan",
      heading: "God and God's Plan",
      instructions: "Give a short summary of what this verse or snippet illuminates about God and God's Plan and why that's important."
    },
    {
      key: "examplesOfSuccess",
      heading: "Examples of Success",
      instructions: "Give a short list of examples of how people can succeed in this part of God's plan."
    },
    {
      key: "memoryHelps",
      heading: "Memory Helps",
      instructions: "Give a short summary of how this concept can be taught or remembered, such as concepts in the text that can be used as metaphors."
    },
    {
      key: "relatedTexts",
      heading: "Related Texts",
      instructions: "Give, if possible, references to a few texts that make this one more clear and a few texts that are more clear if you know this one."
    }
  ];
  var EMPTY_COMMENTARY_ENTRY = {
    godAndPlan: "",
    examplesOfSuccess: "",
    memoryHelps: "",
    relatedTexts: ""
  };
  function getEmptyCommentaryEntry() {
    return { ...EMPTY_COMMENTARY_ENTRY };
  }
  function normalizeCommentaryEntry(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      godAndPlan: typeof source.godAndPlan === "string" ? source.godAndPlan : "",
      examplesOfSuccess: typeof source.examplesOfSuccess === "string" ? source.examplesOfSuccess : "",
      memoryHelps: typeof source.memoryHelps === "string" ? source.memoryHelps : "",
      relatedTexts: typeof source.relatedTexts === "string" ? source.relatedTexts : ""
    };
  }
  function hasCommentary(entry) {
    return COMMENTARY_FIELDS.some((field) => entry[field.key].trim().length > 0);
  }
  function isModerator(auth) {
    return Boolean(auth.authenticated && auth.roles?.includes("moderator"));
  }
  function createVerseNumberPopoverModule(delegator) {
    let activeVerseLink = "";
    let activeVerseButton = null;
    let activeContext = null;
    let activeRejectionNoticeId = "";
    let commentaryEditing = false;
    let manualPopoverPosition = null;
    let authState = { authenticated: false };
    let copyToastTimer = 0;
    const disposers = [];
    async function fetchJson(url, init) {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }
      return data;
    }
    function injectOnce2() {
      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS2;
        document.head.appendChild(style);
      }
      if (!qs4(`#${POPOVER_ID}`)) {
        const popover = document.createElement("div");
        popover.id = POPOVER_ID;
        popover.setAttribute("popover", "auto");
        document.body.appendChild(popover);
      }
      if (!qs4(`#${COPIED_POPOVER_ID}`)) {
        const copiedPopover = document.createElement("div");
        copiedPopover.id = COPIED_POPOVER_ID;
        copiedPopover.setAttribute("popover", "manual");
        copiedPopover.textContent = "link copied";
        document.body.appendChild(copiedPopover);
      }
    }
    function getVerseContext(button) {
      const row = button.closest(".snippet-row");
      const main = qs4("main.chapter-page");
      const verse = row?.id || button.textContent?.trim() || "";
      const book = main?.dataset.book || "";
      const chapter = main?.dataset.chapter || "";
      if (!verse) return null;
      const url = new URL(window.location.href);
      url.hash = verse;
      return {
        verse,
        book,
        chapter,
        title: book && chapter ? `${book} ${chapter}:${verse}` : `Verse ${verse}`,
        link: url.toString(),
        commentaryId: book && chapter ? `${book}|${chapter}|${verse}` : `${url.pathname}|${verse}`
      };
    }
    function positionPopover(popover, anchor, preferAbove = false) {
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
    function positionVersePopover(popover, anchor) {
      if (manualPopoverPosition) {
        popover.style.left = `${Math.round(manualPopoverPosition.left)}px`;
        popover.style.top = `${Math.round(manualPopoverPosition.top)}px`;
        return;
      }
      positionPopover(popover, anchor);
    }
    function hideCopyToast() {
      window.clearTimeout(copyToastTimer);
      const copiedPopover = qs4(`#${COPIED_POPOVER_ID}`);
      if (copiedPopover?.matches(":popover-open")) {
        copiedPopover.hidePopover();
      }
    }
    async function copyText(text) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch {
        }
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Copy failed");
    }
    function showCopyToast(anchor, message = "link copied") {
      const copiedPopover = qs4(`#${COPIED_POPOVER_ID}`);
      if (!copiedPopover) return;
      copiedPopover.textContent = message;
      if (copiedPopover.matches(":popover-open")) {
        copiedPopover.hidePopover();
      }
      copiedPopover.showPopover();
      positionPopover(copiedPopover, anchor, true);
      window.clearTimeout(copyToastTimer);
      copyToastTimer = window.setTimeout(() => {
        if (copiedPopover.matches(":popover-open")) {
          copiedPopover.hidePopover();
        }
      }, 1200);
    }
    function buildCommentaryViewHtml(entry, includeEditButton) {
      const sections = COMMENTARY_FIELDS.flatMap((field) => {
        const value = entry[field.key].trim();
        if (!value) return [];
        return [`<section class="verse-number-commentary-group"><h4 class="verse-number-commentary-heading">${escHtml2(field.heading)}</h4><p class="verse-number-commentary-value">${escHtml2(value)}</p></section>`];
      }).join("");
      const actions = includeEditButton ? `<div class="verse-number-commentary-actions"><button type="button" id="${COMMENTARY_EDIT_BTN_ID}" class="verse-number-commentary-btn">Edit</button></div>` : "";
      return `<div class="verse-number-popover-content">${sections}${actions}</div>`;
    }
    function buildCommentaryEditHtml(entry) {
      const sections = COMMENTARY_FIELDS.map((field) => {
        const instructionsHtml = field.instructions ? `<p class="verse-number-commentary-instructions">${escHtml2(field.instructions)}</p>` : "";
        return `<section class="verse-number-commentary-group"><h4 class="verse-number-commentary-heading">${escHtml2(field.heading)}</h4>${instructionsHtml}<textarea class="verse-number-commentary-textarea" data-commentary-key="${escAttr(field.key)}">${escHtml2(entry[field.key])}</textarea></section>`;
      }).join("");
      return `<div class="verse-number-popover-content">${sections}<div class="verse-number-commentary-actions"><button type="button" id="${COMMENTARY_SAVE_BTN_ID}" class="verse-number-commentary-btn">Save</button><button type="button" id="${COMMENTARY_CANCEL_BTN_ID}" class="verse-number-commentary-btn">Cancel</button></div></div>`;
    }
    function buildStatusNotice(status, rejectionNoticeId, moderationNotes) {
      if (status === "pending") {
        return '<p class="verse-number-popover-body">Your saved commentary is pending moderation. Public display uses approved content only.</p>';
      }
      if (status === "rejected") {
        if (isRejectedNoticeDismissed(rejectionNoticeId)) return "";
        const note = moderationNotes.trim() ? moderationNotes.trim() : "No moderation notes were provided.";
        return `<div class="verse-number-commentary-note"><strong>Rejected:</strong> ${escHtml2(note)}<div class="verse-number-commentary-actions"><button type="button" id="${COMMENTARY_REJECTED_DISMISS_BTN_ID}" class="verse-number-commentary-btn">Dismiss</button></div></div>`;
      }
      return "";
    }
    function buildPublicEmptyHtml() {
      return '<p class="verse-number-popover-body">More content is expected here in the future.</p>';
    }
    function parseCommentaryForm(popover) {
      const out = getEmptyCommentaryEntry();
      popover.querySelectorAll("textarea[data-commentary-key]").forEach((textarea) => {
        const key = textarea.dataset.commentaryKey;
        if (!key || !(key in out)) return;
        out[key] = textarea.value.trim();
      });
      return out;
    }
    async function loadVerseCommentary(context) {
      const query = new URLSearchParams({ book: context.book, chapter: context.chapter, verse: context.verse }).toString();
      const payload = await fetchJson(`/api/verse-commentary?${query}`);
      return {
        approved: payload.approved && payload.approved.entry ? {
          entry: normalizeCommentaryEntry(payload.approved.entry),
          status: payload.approved.status || "approved",
          moderationNotes: typeof payload.approved.moderationNotes === "string" ? payload.approved.moderationNotes : "",
          updatedAt: Number(payload.approved.updatedAt || 0) || 0
        } : null,
        mine: payload.mine && payload.mine.entry ? {
          entry: normalizeCommentaryEntry(payload.mine.entry),
          status: payload.mine.status || "",
          moderationNotes: typeof payload.mine.moderationNotes === "string" ? payload.mine.moderationNotes : "",
          updatedAt: Number(payload.mine.updatedAt || 0) || 0
        } : null,
        canEdit: Boolean(payload.canEdit)
      };
    }
    async function syncVerseCommentaryMarkers() {
      const main = qs4("main.chapter-page");
      const book = main?.dataset.book || "";
      const chapter = main?.dataset.chapter || "";
      if (!book || !chapter) {
        document.querySelectorAll("button.verse-num.verse-num-has-commentary").forEach((button) => {
          button.classList.remove("verse-num-has-commentary");
        });
        return;
      }
      try {
        const query = new URLSearchParams({ book, chapter }).toString();
        const payload = await fetchJson(`/api/verse-commentary/chapter?${query}`);
        const visibleVerses = /* @__PURE__ */ new Set([
          ...Array.isArray(payload.approvedVerses) ? payload.approvedVerses : [],
          ...authState.authenticated && Array.isArray(payload.mineVerses) ? payload.mineVerses : []
        ]);
        document.querySelectorAll("button.verse-num").forEach((button) => {
          const row = button.closest(".snippet-row");
          const verse = row?.id || button.textContent?.trim() || "";
          button.classList.toggle("verse-num-has-commentary", Boolean(verse && visibleVerses.has(verse)));
        });
      } catch {
        document.querySelectorAll("button.verse-num.verse-num-has-commentary").forEach((button) => {
          button.classList.remove("verse-num-has-commentary");
        });
      }
    }
    async function renderVersePopover(button, options) {
      const popover = qs4(`#${POPOVER_ID}`);
      if (!popover) return;
      const context = getVerseContext(button);
      if (!context) return;
      if (!options?.forceRefresh && popover.matches(":popover-open") && activeVerseLink === context.link) {
        popover.hidePopover();
        activeVerseButton = null;
        activeContext = null;
        commentaryEditing = false;
        return;
      }
      activeVerseLink = context.link;
      activeVerseButton = button;
      activeContext = context;
      const header = `<div class="verse-number-popover-header"><div class="verse-number-popover-title">${escHtml2(context.title)}</div></div><div class="verse-number-popover-actions"><button type="button" class="verse-number-popover-link-btn" data-verse-copy-link="${escHtml2(context.link)}">Link</button></div>`;
      popover.innerHTML = `${header}<div class="verse-number-popover-content"><p class="verse-number-popover-body">Loading commentary...</p></div>`;
      if (popover.matches(":popover-open")) {
        popover.hidePopover();
      }
      popover.showPopover();
      positionVersePopover(popover, button);
      try {
        const payload = await loadVerseCommentary(context);
        if (activeVerseLink !== context.link || activeVerseButton !== button) return;
        const approvedEntry = payload.approved?.entry || getEmptyCommentaryEntry();
        const mineEntry = payload.mine?.entry || getEmptyCommentaryEntry();
        const mineStatus = payload.mine?.status || "";
        const mineUpdatedAt = payload.mine?.updatedAt || 0;
        const rejectionNoticeId = `${context.commentaryId}:${mineUpdatedAt}`;
        activeRejectionNoticeId = rejectionNoticeId;
        const showRejectedDraft = mineStatus === "rejected" && Boolean(payload.mine?.entry) && !isRejectedNoticeDismissed(rejectionNoticeId);
        const visibleEntry = showRejectedDraft ? mineEntry : approvedEntry;
        const editEntry = payload.mine?.entry ? mineEntry : approvedEntry;
        const moderator = isModerator(authState);
        let body = "";
        if (!moderator) {
          body = payload.approved && hasCommentary(payload.approved.entry) ? buildCommentaryViewHtml(payload.approved.entry, false) : buildPublicEmptyHtml();
        } else if (commentaryEditing) {
          body = buildCommentaryEditHtml(editEntry);
        } else {
          body = `${buildCommentaryViewHtml(visibleEntry, true)}${buildStatusNotice(mineStatus, rejectionNoticeId, payload.mine?.moderationNotes || "")}`;
        }
        button.classList.toggle("verse-num-has-commentary", hasCommentary(payload.approved?.entry || payload.mine?.entry || getEmptyCommentaryEntry()));
        popover.innerHTML = `${header}${body}`;
        positionVersePopover(popover, button);
      } catch (error) {
        if (activeVerseLink !== context.link || activeVerseButton !== button) return;
        popover.innerHTML = `${header}<div class="verse-number-popover-content"><p class="verse-number-popover-body">${escHtml2(error instanceof Error ? error.message : "Could not load commentary")}</p></div>`;
        positionVersePopover(popover, button);
      }
    }
    return {
      id: "verse-number-popover",
      label: "Verse Number Popover",
      active: false,
      includeInMenu: false,
      activate() {
        if (this.active) return;
        this.active = true;
        injectOnce2();
        disposers.push(
          delegator.registerSublistener({
            eventName: "mousedown",
            tagName: "DIV",
            selector: ".verse-number-popover-header",
            handle(header, event) {
              const mouseEvent = event;
              const popover = header.closest(`#${POPOVER_ID}`);
              if (!popover || !popover.matches(":popover-open")) return;
              const rect = popover.getBoundingClientRect();
              const offsetX = mouseEvent.clientX - rect.left;
              const offsetY = mouseEvent.clientY - rect.top;
              mouseEvent.preventDefault();
              const onMove = (moveEvent) => {
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
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }
          })
        );
        disposers.push(
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: "button.verse-num",
            handle(button, event) {
              event.preventDefault();
              manualPopoverPosition = null;
              void renderVersePopover(button);
            }
          })
        );
        disposers.push(
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: "button[data-verse-copy-link]",
            handle(button, event) {
              event.preventDefault();
              const link = button.dataset.verseCopyLink || "";
              if (!link) return;
              copyText(link).then(() => showCopyToast(button, "link copied")).catch(() => showCopyToast(button, "copy failed"));
            }
          })
        );
        disposers.push(
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: `#${COMMENTARY_REJECTED_DISMISS_BTN_ID}`,
            handle(_button, event) {
              event.preventDefault();
              if (!activeContext || !activeVerseButton) return;
              dismissRejectedNotice(activeRejectionNoticeId || activeContext.commentaryId);
              void renderVersePopover(activeVerseButton, { forceRefresh: true });
            }
          })
        );
        disposers.push(
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: `#${COMMENTARY_EDIT_BTN_ID}`,
            handle(_button, event) {
              event.preventDefault();
              if (!activeVerseButton) return;
              commentaryEditing = true;
              void renderVersePopover(activeVerseButton, { forceRefresh: true });
            }
          })
        );
        disposers.push(
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: `#${COMMENTARY_CANCEL_BTN_ID}`,
            handle(_button, event) {
              event.preventDefault();
              if (!activeVerseButton) return;
              commentaryEditing = false;
              void renderVersePopover(activeVerseButton, { forceRefresh: true });
            }
          })
        );
        disposers.push(
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: `#${COMMENTARY_SAVE_BTN_ID}`,
            handle(_button, event) {
              event.preventDefault();
              const popover = qs4(`#${POPOVER_ID}`);
              if (!popover || !activeContext || !activeVerseButton) return;
              const entry = parseCommentaryForm(popover);
              void fetchJson(`/api/verse-commentary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  book: activeContext.book,
                  chapter: activeContext.chapter,
                  verse: activeContext.verse,
                  entry
                })
              }).then(() => {
                commentaryEditing = false;
                void syncVerseCommentaryMarkers();
                void renderVersePopover(activeVerseButton, { forceRefresh: true });
              }).catch((error) => {
                const body = popover.querySelector(".verse-number-popover-body");
                if (body) {
                  body.textContent = error instanceof Error ? error.message : "Could not save commentary";
                }
              });
            }
          })
        );
        const onAuthChanged = (event) => {
          const detail = event.detail;
          authState = {
            authenticated: Boolean(detail?.authenticated),
            userId: typeof detail?.userId === "string" ? detail.userId : void 0,
            email: typeof detail?.email === "string" ? detail.email : void 0,
            roles: Array.isArray(detail?.roles) ? detail.roles.filter((role) => typeof role === "string") : []
          };
          void syncVerseCommentaryMarkers();
          if (activeVerseButton && qs4(`#${POPOVER_ID}`)?.matches(":popover-open")) {
            void renderVersePopover(activeVerseButton, { forceRefresh: true });
          }
        };
        window.addEventListener("servewell-auth-changed", onAuthChanged);
        disposers.push(() => window.removeEventListener("servewell-auth-changed", onAuthChanged));
        window.setTimeout(() => {
          void syncVerseCommentaryMarkers();
        }, 0);
      },
      deactivate() {
        this.active = false;
        while (disposers.length) {
          const dispose = disposers.pop();
          dispose?.();
        }
        hideCopyToast();
        const popover = qs4(`#${POPOVER_ID}`);
        if (popover?.matches(":popover-open")) {
          popover.hidePopover();
        }
        activeVerseLink = "";
        activeVerseButton = null;
        activeContext = null;
        commentaryEditing = false;
        manualPopoverPosition = null;
      }
    };
  }

  // src/phasingScripts/phase2To3/createDeveloperRoleModule.ts
  function createDeveloperRoleModule() {
    return {
      id: "developer-role",
      label: "Developer role",
      active: false,
      includeInMenu: true,
      available: false,
      activate() {
        if (this.active) return;
        this.active = true;
        document.documentElement.dataset.developerMode = "1";
        window.dispatchEvent(new CustomEvent("servewell-developer-mode-changed", {
          detail: { enabled: true }
        }));
      },
      deactivate() {
        if (!this.active) return;
        this.active = false;
        delete document.documentElement.dataset.developerMode;
        window.dispatchEvent(new CustomEvent("servewell-developer-mode-changed", {
          detail: { enabled: false }
        }));
      }
    };
  }

  // src/phasingScripts/phase2To3/createModeratorRoleModule.ts
  function createModeratorRoleModule() {
    return {
      id: "moderator-role",
      label: "Moderator role",
      active: false,
      defaultActive: true,
      includeInMenu: true,
      available: false,
      activate() {
        if (this.active) return;
        this.active = true;
        document.documentElement.dataset.moderatorMode = "1";
        window.dispatchEvent(new CustomEvent("servewell-moderator-mode-changed", {
          detail: { enabled: true }
        }));
      },
      deactivate() {
        if (!this.active) return;
        this.active = false;
        delete document.documentElement.dataset.moderatorMode;
        window.dispatchEvent(new CustomEvent("servewell-moderator-mode-changed", {
          detail: { enabled: false }
        }));
      }
    };
  }

  // src/phasingScripts/phase2To3/createDevTimeModule.ts
  function qs5(selector) {
    return document.querySelector(selector);
  }
  function escHtml3(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function toHoursMinutes(totalMinutes) {
    const normalized = Math.max(0, Math.round(totalMinutes));
    return {
      hours: Math.floor(normalized / 60),
      minutes: normalized % 60
    };
  }
  function rowToText(hours, minutes) {
    return `${hours}h ${minutes}m`;
  }
  function formatSummaryCell(minutes) {
    const hm = toHoursMinutes(minutes);
    return rowToText(hm.hours, hm.minutes);
  }
  function createDevTimeModule() {
    let active = false;
    let needsCache = [];
    let trackerSessionId = "";
    let running = false;
    let segments = [];
    let workType = "dev";
    let needId = "";
    let saving = false;
    const disposers = [];
    function ensureUi() {
      if (!document.getElementById("dev-time-style")) {
        const style = document.createElement("style");
        style.id = "dev-time-style";
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
      const topbar = qs5("#app-shell-root .app-topbar");
      if (topbar && !qs5("#dev-time-btn")) {
        const spacer = topbar.querySelector(".app-spacer");
        const button = document.createElement("button");
        button.type = "button";
        button.id = "dev-time-btn";
        button.className = "dev-time-btn";
        button.textContent = "time";
        if (spacer?.parentElement === topbar) {
          topbar.insertBefore(button, spacer);
        } else {
          topbar.appendChild(button);
        }
      }
      if (!qs5("#dev-time-popover")) {
        const pop = document.createElement("div");
        pop.id = "dev-time-popover";
        pop.className = "dev-time-popover";
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
  <button type="button" id="dev-time-playpause" aria-label="Start timer">\u25B6</button>
  <button type="button" id="dev-time-stop" aria-label="Stop timer">\u25A0</button>
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
        const shellRoot = document.getElementById("app-shell-root");
        (shellRoot || document.body).appendChild(pop);
      }
    }
    function setMessage(message, tone = "info") {
      const el = qs5("#dev-time-message");
      if (!el) return;
      if (!message) {
        el.hidden = true;
        el.textContent = "";
        delete el.dataset.tone;
        return;
      }
      el.hidden = false;
      el.textContent = message;
      el.dataset.tone = tone;
    }
    function setRunningUi(value) {
      const playPause = qs5("#dev-time-playpause");
      if (!playPause) return;
      playPause.textContent = value ? "\u23F8" : "\u25B6";
      playPause.setAttribute("aria-label", value ? "Pause timer" : "Start timer");
    }
    function getNeedSelect() {
      const el = qs5("#dev-time-need");
      return el instanceof HTMLSelectElement ? el : null;
    }
    function getWorkTypeSelect() {
      const el = qs5("#dev-time-work-type");
      return el instanceof HTMLSelectElement ? el : null;
    }
    function setDurationInputs(totalMinutes) {
      const hm = toHoursMinutes(totalMinutes);
      const h = qs5("#dev-time-hours");
      const m = qs5("#dev-time-minutes");
      if (h) h.value = String(hm.hours);
      if (m) m.value = String(hm.minutes);
    }
    function getDurationMinutesFromInputs() {
      const h = Math.max(0, Math.floor(Number(qs5("#dev-time-hours")?.value || 0)));
      const mRaw = Math.floor(Number(qs5("#dev-time-minutes")?.value || 0));
      const m = Math.max(0, Math.min(59, mRaw));
      const mInput = qs5("#dev-time-minutes");
      if (mInput) mInput.value = String(m);
      return h * 60 + m;
    }
    function showStopControls(show) {
      const duration = qs5("#dev-time-duration");
      const saveRow = qs5("#dev-time-save-row");
      if (duration) duration.hidden = !show;
      if (saveRow) saveRow.hidden = !show;
    }
    function getTotalMinutesFromSegments() {
      let totalMs = 0;
      for (const segment of segments) {
        if (typeof segment.stop !== "number") continue;
        totalMs += Math.max(0, segment.stop - segment.start);
      }
      return Math.round(totalMs / 6e4);
    }
    function getSessionBounds() {
      if (segments.length === 0) return null;
      const starts = segments.map((s) => s.start);
      const stops = segments.map((s) => s.stop).filter((value) => typeof value === "number");
      if (starts.length === 0 || stops.length === 0) return null;
      return {
        startTime: Math.min(...starts),
        endTime: Math.max(...stops)
      };
    }
    async function fetchJson(url, init) {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }
      return data;
    }
    async function loadNeedOptions() {
      const payload = await fetchJson("/api/dev/time/needs");
      needsCache = Array.isArray(payload.needs) ? payload.needs : [];
      const select = getNeedSelect();
      if (!select) return;
      const previous = needId;
      select.innerHTML = '<option value=""></option>' + needsCache.map((need) => `<option value="${escHtml3(need.id)}">${escHtml3(need.label)}</option>`).join("");
      const next = needsCache.some((need) => need.id === previous) ? previous : "";
      select.value = next;
      needId = next;
    }
    async function loadSummary() {
      const tzOffsetMinutes = (/* @__PURE__ */ new Date()).getTimezoneOffset();
      const payload = await fetchJson(`/api/dev/time/summary?tzOffsetMinutes=${encodeURIComponent(String(tzOffsetMinutes))}`);
      const summary = payload.summary;
      const map = [
        ["#dev-time-sum-7-dev", summary.pastSevenDays.dev],
        ["#dev-time-sum-7-adm", summary.pastSevenDays.adm],
        ["#dev-time-sum-7-copy", summary.pastSevenDays.copy],
        ["#dev-time-sum-7-total", summary.pastSevenDays.dev + summary.pastSevenDays.adm + summary.pastSevenDays.copy],
        ["#dev-time-sum-this-dev", summary.thisWeek.dev],
        ["#dev-time-sum-this-adm", summary.thisWeek.adm],
        ["#dev-time-sum-this-copy", summary.thisWeek.copy],
        ["#dev-time-sum-this-total", summary.thisWeek.dev + summary.thisWeek.adm + summary.thisWeek.copy],
        ["#dev-time-sum-prev-dev", summary.previousWeek.dev],
        ["#dev-time-sum-prev-adm", summary.previousWeek.adm],
        ["#dev-time-sum-prev-copy", summary.previousWeek.copy],
        ["#dev-time-sum-prev-total", summary.previousWeek.dev + summary.previousWeek.adm + summary.previousWeek.copy]
      ];
      for (const [selector, value] of map) {
        const cell = qs5(selector);
        if (cell) cell.textContent = formatSummaryCell(value);
      }
    }
    async function persistEvent(eventType, eventAt) {
      await fetchJson("/api/dev/time/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        await persistEvent("start", now);
        segments.push({ start: now });
        running = true;
        setRunningUi(true);
        setMessage("Timer running.");
        return;
      }
      const openSegment = segments[segments.length - 1];
      if (openSegment && typeof openSegment.stop !== "number") {
        await persistEvent("pause", now);
        openSegment.stop = now;
      }
      running = false;
      setRunningUi(false);
      setMessage("Timer paused.");
    }
    async function onStop() {
      if (!trackerSessionId || segments.length === 0) {
        setMessage("Start the timer before stopping.", "error");
        return;
      }
      const now = Date.now();
      if (running) {
        const openSegment = segments[segments.length - 1];
        if (openSegment && typeof openSegment.stop !== "number") {
          await persistEvent("stop", now);
          openSegment.stop = now;
        }
      }
      running = false;
      setRunningUi(false);
      const totalMinutes = getTotalMinutesFromSegments();
      setDurationInputs(totalMinutes);
      showStopControls(true);
      setMessage("Adjust duration if needed, then Save.");
    }
    function onCancel() {
      trackerSessionId = "";
      segments = [];
      running = false;
      setRunningUi(false);
      setDurationInputs(0);
      showStopControls(false);
      setMessage("");
    }
    async function onSave() {
      if (saving) return;
      const bounds = getSessionBounds();
      if (!bounds) {
        setMessage("No completed timer segments to save.", "error");
        return;
      }
      const durationMinutes = getDurationMinutesFromInputs();
      saving = true;
      try {
        await fetchJson("/api/dev/time/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackerSessionId,
            workType,
            needId,
            startTime: bounds.startTime,
            endTime: bounds.endTime,
            durationMinutes
          })
        });
        setMessage(durationMinutes === 0 ? "Reset." : "Saved.");
        trackerSessionId = "";
        segments = [];
        setDurationInputs(0);
        showStopControls(false);
        if (durationMinutes > 0) await loadSummary();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save time entry";
        setMessage(message, "error");
      } finally {
        saving = false;
      }
    }
    async function openPopover() {
      const popover = qs5("#dev-time-popover");
      if (!popover) return;
      popover.hidden = false;
      const btn = qs5("#dev-time-btn");
      if (btn && isVisible(btn)) {
        const rect = btn.getBoundingClientRect();
        const left = Math.max(8, Math.min(window.innerWidth - 440, rect.right - 430));
        popover.style.left = `${Math.round(left)}px`;
        popover.style.right = "auto";
        popover.style.top = `${Math.round(rect.bottom + 8)}px`;
      }
      const work = getWorkTypeSelect();
      if (work) work.value = workType;
      await loadNeedOptions();
      await loadSummary();
    }
    function closePopover() {
      const popover = qs5("#dev-time-popover");
      if (!popover) return;
      popover.hidden = true;
    }
    function wireListeners() {
      const onDocClick = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const button = qs5("#dev-time-btn");
        const popover = qs5("#dev-time-popover");
        if (!button || !popover) return;
        if (target === button || target.closest("#dev-time-btn")) {
          if (popover.hidden) {
            void openPopover();
          } else {
            closePopover();
          }
          return;
        }
        if (!target.closest("#dev-time-popover")) {
          closePopover();
        }
      };
      const onWorkTypeChange = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.id !== "dev-time-work-type") return;
        const next = target.value;
        if (next === "dev" || next === "adm" || next === "copy") {
          workType = next;
        }
      };
      const onNeedChange = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.id !== "dev-time-need") return;
        needId = target.value;
      };
      const onActionClick = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.id === "dev-time-playpause") {
          event.preventDefault();
          void onPlayPause();
        }
        if (target.id === "dev-time-stop") {
          event.preventDefault();
          void onStop();
        }
        if (target.id === "dev-time-save") {
          event.preventDefault();
          void onSave();
        }
        if (target.id === "dev-time-cancel") {
          event.preventDefault();
          onCancel();
        }
      };
      const onEscape = (event) => {
        const keyboard = event;
        if (keyboard.key === "Escape") closePopover();
      };
      document.addEventListener("click", onDocClick);
      document.addEventListener("change", onWorkTypeChange);
      document.addEventListener("change", onNeedChange);
      document.addEventListener("click", onActionClick);
      document.addEventListener("keydown", onEscape);
      disposers.push(() => document.removeEventListener("click", onDocClick));
      disposers.push(() => document.removeEventListener("change", onWorkTypeChange));
      disposers.push(() => document.removeEventListener("change", onNeedChange));
      disposers.push(() => document.removeEventListener("click", onActionClick));
      disposers.push(() => document.removeEventListener("keydown", onEscape));
    }
    function removeUi() {
      closePopover();
      qs5("#dev-time-btn")?.remove();
      qs5("#dev-time-popover")?.remove();
    }
    return {
      id: "dev-time",
      label: "Developer time",
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
        trackerSessionId = "";
        segments = [];
        needId = "";
        workType = "dev";
      }
    };
  }

  // src/phasingScripts/phase2To3/createTransliterationModule.ts
  var TRANSLIT_COLORS = [
    "rgba(220,  60,  60, 0.28)",
    // red
    "rgba(225, 140,  30, 0.30)",
    // orange
    "rgba(195, 175,  10, 0.38)",
    // yellow
    "rgba( 40, 170,  70, 0.28)",
    // green
    "rgba( 20, 180, 165, 0.28)",
    // teal
    "rgba( 55, 130, 240, 0.30)",
    // blue
    "rgba(145,  65, 240, 0.28)",
    // purple
    "rgba(225,  50, 175, 0.28)",
    // pink
    "rgba(155,  95,  35, 0.32)",
    // brown
    "rgba(120, 185,  20, 0.32)"
    // lime
  ];
  var STYLE_ID2 = "translit-module-style";
  function decodePart(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }
  function parseDataM(raw) {
    const result = {};
    for (const pair of raw.split("&")) {
      if (!pair) continue;
      const sep = pair.indexOf("=");
      if (sep < 0) continue;
      result[decodePart(pair.slice(0, sep))] = decodePart(pair.slice(sep + 1));
    }
    return result;
  }
  function applyTransliterations() {
    document.querySelectorAll(".snippet-row").forEach((snippetRow) => {
      snippetRow.querySelectorAll(".word-translit").forEach((el) => el.remove());
      const colorMap = /* @__PURE__ */ new Map();
      let colorCounter = 0;
      snippetRow.querySelectorAll(".literal-pane .word-token").forEach((btn) => {
        const mid = parseDataM(btn.dataset.m ?? "")["mid"];
        if (mid && !colorMap.has(mid)) {
          colorMap.set(mid, TRANSLIT_COLORS[colorCounter % TRANSLIT_COLORS.length]);
          colorCounter++;
        }
      });
      snippetRow.querySelectorAll(".word-token").forEach((btn) => {
        const wrap = btn.parentElement;
        if (!wrap) return;
        const meta = parseDataM(btn.dataset.m ?? "");
        const translit = meta["tr"];
        if (!translit) return;
        const mid = meta["mid"];
        const color = mid ? colorMap.get(mid) ?? "" : "";
        const span = document.createElement("span");
        span.className = "word-translit";
        if (color) span.style.background = color;
        span.textContent = translit;
        wrap.appendChild(span);
      });
    });
  }
  function removeTransliterations() {
    document.querySelectorAll(".word-translit").forEach((el) => el.remove());
  }
  function ensureStyle() {
    if (document.getElementById(STYLE_ID2)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID2;
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
  function createTransliterationModule() {
    const isChapterPage = !!document.querySelector("main.chapter-page");
    return {
      id: "transliteration",
      label: "Transliteration interlinear",
      infoHref: "/features#need-interlinear",
      active: false,
      includeInMenu: isChapterPage,
      activate() {
        this.active = true;
        ensureStyle();
        applyTransliterations();
        document.documentElement.classList.add("show-translit");
      },
      deactivate() {
        this.active = false;
        document.documentElement.classList.remove("show-translit");
        removeTransliterations();
      }
    };
  }

  // src/phasingScripts/phase2To3/createSelectionControlModule.ts
  var STYLE_ID3 = "selection-control-style";
  function getChapterPage() {
    return document.querySelector("main.chapter-page");
  }
  function asElement(node) {
    if (!node) return null;
    if (node instanceof Element) return node;
    return node.parentElement;
  }
  function getPaneKindFromElement(element) {
    if (!element) return null;
    const pane = element.closest(".snippet-pane");
    if (!(pane instanceof HTMLElement)) return null;
    if (pane.classList.contains("literal-pane")) return "literal";
    if (pane.classList.contains("traditional-pane")) return "traditional";
    return null;
  }
  function getPaneKindFromNode(node) {
    return getPaneKindFromElement(asElement(node));
  }
  function tokenMatchesPaneMode(token, mode) {
    if (mode === "both") return true;
    return getPaneKindFromElement(token) === mode;
  }
  function decodePart2(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  function parseMetadata(raw) {
    const result = {};
    for (const pair of raw.split("&")) {
      if (!pair) continue;
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex < 0) continue;
      const key = decodePart2(pair.slice(0, separatorIndex));
      const value = decodePart2(pair.slice(separatorIndex + 1));
      result[key] = value;
    }
    return result;
  }
  function parseVerseLabelFromMid(mid) {
    const colonIndex = mid.lastIndexOf(":");
    if (colonIndex < 0) return null;
    const afterColon = mid.slice(colonIndex + 1);
    const verseLabel = afterColon.split(".")[0]?.trim() ?? "";
    return verseLabel || null;
  }
  function getTokenVerseLabel(token) {
    const metadata = parseMetadata(token.dataset.m ?? "");
    const mid = metadata.mid;
    if (mid) {
      const fromMid = parseVerseLabelFromMid(mid);
      if (fromMid) return fromMid;
    }
    const pane = token.closest(".snippet-pane");
    const paneVerse = pane?.querySelector(".verse-num")?.textContent?.trim();
    if (paneVerse) return paneVerse;
    const rowVerse = token.closest(".snippet-row")?.querySelector(".verse-num")?.textContent?.trim();
    return rowVerse || null;
  }
  function normalizeTokenText(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function shouldInsertSpaceBeforeToken(token, existingText) {
    if (/^[,.;:!?%\]\)]/.test(token)) return false;
    if (/[\[(]$/.test(existingText)) return false;
    return true;
  }
  function buildSelectionText(tokens) {
    let result = "";
    for (const token of tokens) {
      const tokenText = normalizeTokenText(token.textContent ?? "");
      if (!tokenText) continue;
      if (result && shouldInsertSpaceBeforeToken(tokenText, result)) {
        result += " ";
      }
      result += tokenText;
    }
    return result;
  }
  function buildTraditionalSelectionText(tokens) {
    const groups = [];
    let currentGroup = [];
    let currentPara = null;
    for (const token of tokens) {
      const para = token.closest(".traditional-paragraph") ?? token.closest(".snippet-row") ?? null;
      if (para !== currentPara) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [];
        currentPara = para;
      }
      currentGroup.push(token);
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups.map(buildSelectionText).join("\n\n");
  }
  function rangeIntersectsNode(range, node) {
    try {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      const endsAfterNodeStart = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
      const startsBeforeNodeEnd = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0;
      return endsAfterNodeStart && startsBeforeNodeEnd;
    } catch {
      return false;
    }
  }
  function rectsOverlap(a, b) {
    const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return overlapWidth > 0 && overlapHeight > 0;
  }
  function hasVisualRangeOverlap(rangeRects, element) {
    const tokenRects = Array.from(element.getClientRects());
    if (tokenRects.length === 0) return false;
    for (const tokenRect of tokenRects) {
      for (const rangeRect of rangeRects) {
        if (rectsOverlap(tokenRect, rangeRect)) {
          return true;
        }
      }
    }
    return false;
  }
  function tokenIsSelectedByRange(range, rangeRects, token) {
    if (!rangeIntersectsNode(range, token)) return false;
    if (rangeRects.length > 0) {
      return hasVisualRangeOverlap(rangeRects, token);
    }
    return true;
  }
  function buildTraditionalSelectionTextFromRange(page, selection) {
    if (selection.rangeCount === 0) return "";
    const range = selection.getRangeAt(0);
    const rangeRects = Array.from(range.getClientRects());
    const blocks = Array.from(
      page.querySelectorAll(
        ".traditional-pane .traditional-heading, .traditional-pane .traditional-crossref, .traditional-pane .traditional-paragraph"
      )
    );
    const pieces = [];
    function pushPiece(text, kind) {
      const normalized = normalizeTokenText(text);
      if (!normalized) return;
      pieces.push({ text: normalized, kind });
    }
    for (const block of blocks) {
      if (!rangeIntersectsNode(range, block)) continue;
      if (block.classList.contains("traditional-paragraph")) {
        const tokens = Array.from(block.querySelectorAll("button.word-token")).filter(
          (token) => tokenIsSelectedByRange(range, rangeRects, token)
        );
        if (tokens.length > 0) {
          pushPiece(buildSelectionText(tokens), "paragraph");
        }
        continue;
      }
      if (block.classList.contains("traditional-heading")) {
        pushPiece(block.textContent ?? "", "heading");
        continue;
      }
      pushPiece(block.textContent ?? "", "crossref");
    }
    let result = "";
    for (const piece of pieces) {
      if (result) {
        result += piece.kind === "heading" ? "\n\n\n" : "\n\n";
      }
      result += piece.text;
    }
    return result;
  }
  function resolvePaneMode(selection) {
    const beginPane = getPaneKindFromNode(selection.anchorNode);
    const endPane = getPaneKindFromNode(selection.focusNode);
    if (beginPane && endPane && beginPane === endPane) return beginPane;
    return "both";
  }
  function getSelectedTokens(page, selection, mode) {
    if (selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const rangeRects = Array.from(range.getClientRects());
    const tokens = Array.from(page.querySelectorAll("button.word-token"));
    return tokens.filter((token) => {
      if (!tokenMatchesPaneMode(token, mode)) return false;
      return tokenIsSelectedByRange(range, rangeRects, token);
    });
  }
  function getSelectedPanesInVisualOrder(tokens) {
    const panesByKind = /* @__PURE__ */ new Map();
    for (const token of tokens) {
      const kind = getPaneKindFromElement(token);
      if (!kind || panesByKind.has(kind)) continue;
      const pane = token.closest(".snippet-pane");
      if (pane instanceof HTMLElement) {
        panesByKind.set(kind, pane);
      }
    }
    return Array.from(panesByKind.entries()).sort(([, a], [, b]) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(([kind, element]) => ({ kind, element }));
  }
  function inferPaneFromPointerX(selectedPanes, pointerClientX) {
    if (selectedPanes.length === 0) return null;
    if (selectedPanes.length === 1) return selectedPanes[0].kind;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const pane of selectedPanes) {
      const rect = pane.element.getBoundingClientRect();
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
    if (!(right > left)) return null;
    const clampedX = Math.min(Math.max(pointerClientX, left), right - 1e-3);
    const segmentWidth = (right - left) / selectedPanes.length;
    const index = Math.min(selectedPanes.length - 1, Math.floor((clampedX - left) / segmentWidth));
    return selectedPanes[index]?.kind ?? null;
  }
  function getVisibleModePane(page) {
    if (page.classList.contains("mode-traditional-only")) return "traditional";
    if (page.classList.contains("mode-literal-only")) return "literal";
    return null;
  }
  function addPartialSuffix(verseLabel, suffix) {
    if (/^\d+$/.test(verseLabel)) {
      return `${verseLabel}${suffix}`;
    }
    return verseLabel;
  }
  function getBookName(page) {
    const abbr = (page.dataset.book ?? "").trim();
    const fallback = abbr || "Reference";
    const navDataScript = document.getElementById("bible-nav-data");
    if (!(navDataScript instanceof HTMLScriptElement)) return fallback;
    if (!navDataScript.textContent) return fallback;
    try {
      const parsed = JSON.parse(navDataScript.textContent);
      const books = Array.isArray(parsed.books) ? parsed.books : [];
      for (const book of books) {
        if (book.abbr === abbr && typeof book.name === "string" && book.name.trim()) {
          return book.name.trim();
        }
      }
    } catch {
      return fallback;
    }
    return fallback;
  }
  function buildReferencePrefix(page, selectedTokens, mode) {
    if (selectedTokens.length === 0) return null;
    const allTokensInMode = Array.from(page.querySelectorAll("button.word-token")).filter(
      (token) => tokenMatchesPaneMode(token, mode)
    );
    const firstTokenByVerse = /* @__PURE__ */ new Map();
    const lastTokenByVerse = /* @__PURE__ */ new Map();
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
    const chapterLabel = (page.dataset.chapter ?? "").trim();
    const bookName = getBookName(page);
    if (!startVerse || !endVerse || !chapterLabel) return null;
    const verseStartToken = firstTokenByVerse.get(startVerse);
    const verseEndToken = lastTokenByVerse.get(endVerse);
    const startPartial = !!verseStartToken && verseStartToken !== firstSelected;
    const endPartial = !!verseEndToken && verseEndToken !== lastSelected;
    let verseRangeLabel = "";
    if (startVerse === endVerse) {
      if (startPartial && !endPartial) {
        verseRangeLabel = addPartialSuffix(startVerse, "b");
      } else if (!startPartial && endPartial) {
        verseRangeLabel = addPartialSuffix(startVerse, "a");
      } else if (startPartial && endPartial) {
        verseRangeLabel = addPartialSuffix(startVerse, "b");
      } else {
        verseRangeLabel = startVerse;
      }
    } else {
      const startLabel = startPartial ? addPartialSuffix(startVerse, "b") : startVerse;
      const endLabel = endPartial ? addPartialSuffix(endVerse, "a") : endVerse;
      verseRangeLabel = `${startLabel}-${endLabel}`;
    }
    return `${bookName} ${chapterLabel}:${verseRangeLabel}`;
  }
  function trimLikelyBoundaryLeadToken(page, mode, tokens, lastGestureStartedOnToken) {
    if (mode === "both") return tokens;
    if (lastGestureStartedOnToken) return tokens;
    if (tokens.length < 2) return tokens;
    const firstToken = tokens[0];
    const secondToken = tokens[1];
    const firstVerse = getTokenVerseLabel(firstToken);
    const secondVerse = getTokenVerseLabel(secondToken);
    if (!firstVerse || !secondVerse || firstVerse === secondVerse) return tokens;
    const firstVerseCount = tokens.filter((token) => getTokenVerseLabel(token) === firstVerse).length;
    if (firstVerseCount !== 1) return tokens;
    const allTokensInMode = Array.from(page.querySelectorAll("button.word-token")).filter(
      (token) => tokenMatchesPaneMode(token, mode)
    );
    let lastTokenInFirstVerse = null;
    for (const token of allTokensInMode) {
      if (getTokenVerseLabel(token) === firstVerse) {
        lastTokenInFirstVerse = token;
      }
    }
    if (lastTokenInFirstVerse !== firstToken) return tokens;
    return tokens.slice(1);
  }
  function buildBothPanesSectionText(page, selection) {
    function groupByRow(tokens) {
      const rowMap = /* @__PURE__ */ new Map();
      for (const token of tokens) {
        const row = token.closest(".snippet-row");
        if (!row) continue;
        if (!rowMap.has(row)) rowMap.set(row, []);
        rowMap.get(row).push(token);
      }
      return Array.from(rowMap.values());
    }
    const literalGroups = groupByRow(getSelectedTokens(page, selection, "literal"));
    const traditionalText = buildTraditionalSelectionTextFromRange(page, selection);
    if (literalGroups.length === 0 && !traditionalText) return null;
    const sections = [];
    if (literalGroups.length > 0) {
      sections.push("LITERAL\n" + literalGroups.map(buildSelectionText).join("\n\n"));
    }
    if (traditionalText) {
      sections.push("TRADITIONAL\n" + traditionalText);
    }
    return sections.join("\n\n");
  }
  function ensureStyle2() {
    if (document.getElementById(STYLE_ID3)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID3;
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
  function createSelectionControlModule() {
    let page = null;
    let pointerId = null;
    let startPane = null;
    let lastPointerClientX = null;
    let gestureStartedOnToken = false;
    let lastGestureStartedOnToken = false;
    let gestureCrossedPanes = false;
    let lastGestureCrossedPanes = false;
    const disposers = [];
    function setLockedPane(pane) {
      if (!page) return;
      page.classList.toggle("selection-lock-literal", pane === "literal");
      page.classList.toggle("selection-lock-traditional", pane === "traditional");
    }
    function resetGestureState() {
      pointerId = null;
      startPane = null;
      gestureStartedOnToken = false;
      gestureCrossedPanes = false;
      window.setTimeout(() => setLockedPane(null), 0);
    }
    function onPointerDown(event) {
      if (!page) return;
      if (!event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!(event.target instanceof Node)) return;
      pointerId = event.pointerId;
      startPane = getPaneKindFromNode(event.target);
      lastPointerClientX = event.clientX;
      gestureStartedOnToken = asElement(event.target)?.closest("button.word-token") !== null;
      lastGestureStartedOnToken = false;
      gestureCrossedPanes = false;
      lastGestureCrossedPanes = false;
      setLockedPane(startPane);
    }
    function onPointerMove(event) {
      if (!page) return;
      if (pointerId === null || event.pointerId !== pointerId) return;
      if (!(event.target instanceof Node)) return;
      lastPointerClientX = event.clientX;
      const hoverPane = getPaneKindFromNode(event.target);
      if (startPane && hoverPane && hoverPane !== startPane) {
        gestureCrossedPanes = true;
        setLockedPane(null);
        return;
      }
      if (!startPane && hoverPane) {
        setLockedPane(hoverPane);
      }
    }
    function onPointerUpOrCancel(event) {
      if (pointerId === null) return;
      if (event.pointerId !== pointerId) return;
      lastPointerClientX = event.clientX;
      lastGestureStartedOnToken = gestureStartedOnToken;
      lastGestureCrossedPanes = gestureCrossedPanes;
      resetGestureState();
    }
    function onWindowBlur() {
      lastGestureStartedOnToken = false;
      lastGestureCrossedPanes = false;
      resetGestureState();
    }
    function onCopy(event) {
      if (!page) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const selectionTouchesPage = page.contains(range.commonAncestorContainer) || rangeIntersectsNode(range, page);
      if (!selectionTouchesPage) return;
      const allSelectedTokens = getSelectedTokens(page, selection, "both");
      const traditionalBodyFromRange = buildTraditionalSelectionTextFromRange(page, selection);
      const forcedPane = getVisibleModePane(page);
      let paneMode = resolvePaneMode(selection);
      if (forcedPane) {
        paneMode = forcedPane;
      }
      const selectedPanes = getSelectedPanesInVisualOrder(
        forcedPane ? allSelectedTokens.filter((token) => getPaneKindFromElement(token) === forcedPane) : allSelectedTokens
      );
      if (!forcedPane && selectedPanes.length === 1) {
        paneMode = selectedPanes[0].kind;
      } else if (!forcedPane && selectedPanes.length === 0 && traditionalBodyFromRange) {
        paneMode = "traditional";
      } else if (!forcedPane && selectedPanes.length > 1) {
        if (lastGestureCrossedPanes) {
          paneMode = "both";
        } else if (lastPointerClientX !== null) {
          const inferredPane = inferPaneFromPointerX(selectedPanes, lastPointerClientX);
          if (inferredPane) {
            paneMode = inferredPane;
          }
        }
      }
      if (paneMode === "both") {
        if (selectedPanes.length < 2) return;
        const prefix2 = buildReferencePrefix(page, allSelectedTokens, "both");
        const bodyText2 = buildBothPanesSectionText(page, selection);
        if (!prefix2 && !bodyText2) return;
        const payload2 = prefix2 ? bodyText2 ? `${prefix2}
${bodyText2}` : prefix2 : bodyText2 ?? "";
        if (!payload2) return;
        event.preventDefault();
        event.clipboardData?.setData("text/plain", payload2);
        return;
      }
      let selectedTokens = allSelectedTokens.filter((token) => getPaneKindFromElement(token) === paneMode);
      selectedTokens = trimLikelyBoundaryLeadToken(page, paneMode, selectedTokens, lastGestureStartedOnToken);
      const prefix = selectedTokens.length > 0 ? buildReferencePrefix(page, selectedTokens, paneMode) : null;
      let bodyText = "";
      if (paneMode === "traditional") {
        bodyText = !lastGestureStartedOnToken && traditionalBodyFromRange ? traditionalBodyFromRange : selectedTokens.length > 0 ? buildTraditionalSelectionText(selectedTokens) : traditionalBodyFromRange;
      } else {
        if (selectedTokens.length === 0) return;
        bodyText = buildSelectionText(selectedTokens);
      }
      if (!prefix && !bodyText) return;
      const payload = prefix ? bodyText ? `${prefix}
${bodyText}` : prefix : bodyText;
      if (!payload) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", payload);
    }
    return {
      id: "selection-control",
      label: "Selection Control",
      active: false,
      includeInMenu: false,
      activate() {
        if (this.active) return;
        page = getChapterPage();
        if (!page) return;
        this.active = true;
        ensureStyle2();
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("pointermove", onPointerMove, true);
        document.addEventListener("pointerup", onPointerUpOrCancel, true);
        document.addEventListener("pointercancel", onPointerUpOrCancel, true);
        document.addEventListener("copy", onCopy, true);
        window.addEventListener("blur", onWindowBlur);
        disposers.push(() => document.removeEventListener("pointerdown", onPointerDown, true));
        disposers.push(() => document.removeEventListener("pointermove", onPointerMove, true));
        disposers.push(() => document.removeEventListener("pointerup", onPointerUpOrCancel, true));
        disposers.push(() => document.removeEventListener("pointercancel", onPointerUpOrCancel, true));
        disposers.push(() => document.removeEventListener("copy", onCopy, true));
        disposers.push(() => window.removeEventListener("blur", onWindowBlur));
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
        gestureStartedOnToken = false;
        lastGestureStartedOnToken = false;
        gestureCrossedPanes = false;
        lastGestureCrossedPanes = false;
        page = null;
      }
    };
  }

  // src/phasingScripts/phase2To3/wordSearchLogic.ts
  var IRREGULARS = {
    was: "be",
    is: "be",
    am: "be",
    are: "be",
    were: "be",
    been: "be",
    went: "go",
    gone: "go",
    goes: "go",
    had: "have",
    has: "have",
    having: "have",
    did: "do",
    does: "do",
    done: "do",
    doing: "do",
    said: "say",
    says: "say",
    saying: "say",
    gave: "give",
    given: "give",
    gives: "give",
    giving: "give",
    took: "take",
    taken: "take",
    takes: "take",
    came: "come",
    comes: "come",
    coming: "come",
    ran: "run",
    runs: "run",
    running: "run",
    saw: "see",
    seen: "see",
    sees: "see",
    seeing: "see",
    knew: "know",
    known: "know",
    knows: "know",
    knowing: "know",
    thought: "think",
    thinks: "think",
    thinking: "think"
  };
  function simplelemmatize(word) {
    const w = word.toLowerCase().trim();
    if (!w) return w;
    if (IRREGULARS[w]) return IRREGULARS[w];
    const n = w.length;
    if (n > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (n > 5 && w.endsWith("ing")) {
      const stem = w.slice(0, -3);
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
        return stem.slice(0, -1);
      }
      return stem + "e";
    }
    if (n > 4 && w.endsWith("ed")) {
      const stem = w.slice(0, -2);
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
        return stem.slice(0, -1);
      }
      return stem + "e";
    }
    if (n > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }
  function resolveToken(token, idx) {
    const lower = token.toLowerCase().trim();
    if (!lower) return { kind: "unresolved" };
    if (lower in idx) return { kind: "resolved", lemma: lower };
    const lem = simplelemmatize(lower);
    if (lem !== lower && lem in idx) return { kind: "resolved", lemma: lem };
    if (lem !== lower && lem.endsWith("e") && lem.length > 2) {
      const noE = lem.slice(0, -1);
      if (noE in idx) return { kind: "resolved", lemma: noE };
    }
    if (lower.endsWith("ing") && lower.length > 5) {
      const bareStem = lower.slice(0, -3);
      if (bareStem in idx) return { kind: "resolved", lemma: bareStem };
    }
    const MAX_CANDIDATES = 40;
    const candidates = [];
    for (const k of Object.keys(idx)) {
      if (k.startsWith(lower)) {
        candidates.push(k);
        if (candidates.length >= MAX_CANDIDATES) break;
      }
    }
    if (candidates.length === 1) return { kind: "resolved", lemma: candidates[0] };
    if (candidates.length > 1) return { kind: "ambiguous", candidates };
    return { kind: "unresolved" };
  }
  function getFileNamesForLemma(lemma, idx) {
    const count = idx[lemma] ?? 1;
    if (count <= 1) return [lemma];
    return [lemma, ...Array.from({ length: count - 1 }, (_, i) => `${lemma}_${i + 2}`)];
  }
  function extractVerseRef(ref) {
    const dot = ref.lastIndexOf(".");
    return dot !== -1 ? ref.slice(0, dot) : ref;
  }
  function parseQueryTokens(query) {
    return query.split(/\s+/).filter(Boolean);
  }
  function sortByRarity(lemmas, idx) {
    return [...lemmas].sort((a, b) => (idx[a] ?? 1) - (idx[b] ?? 1));
  }

  // src/phasingScripts/phase2To3/wordSearchFetch.ts
  var WORD_INDEX_URL = (() => {
    if (typeof location === "undefined") return "https://servewell.net/_word_index.json";
    const h = location.hostname;
    return h === "servewell.net" || h === "localhost" || h === "127.0.0.1" ? "/_word_index.json" : "https://servewell.net/_word_index.json";
  })();
  var WORDS_BASE_URL = "https://words.servewell.net";
  var indexData = null;
  var indexLoading = false;
  var indexLoadFailed = false;
  function getIndexSync() {
    return indexData;
  }
  function isIndexLoadFailed() {
    return indexLoadFailed;
  }
  function loadIndex() {
    if (indexData) return Promise.resolve(indexData);
    if (indexLoadFailed) return Promise.resolve(null);
    if (indexLoading) {
      return new Promise((resolve) => {
        const id = setInterval(() => {
          if (!indexLoading) {
            clearInterval(id);
            resolve(indexData);
          }
        }, 50);
      });
    }
    indexLoading = true;
    return fetch(WORD_INDEX_URL).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))).then((d) => {
      indexData = d;
      indexLoading = false;
      return d;
    }).catch(() => {
      indexLoadFailed = true;
      indexLoading = false;
      return null;
    });
  }
  function prefetchIndex() {
    if (!indexData && !indexLoading && !indexLoadFailed) loadIndex().catch(() => {
    });
  }
  var fileCache = /* @__PURE__ */ new Map();
  function fetchWordFile(fileName) {
    const cached = fileCache.get(fileName);
    if (cached !== void 0) return cached;
    const url = `${WORDS_BASE_URL}/${encodeURIComponent(fileName)}`;
    const p = fetch(url).then((r) => {
      if (!r.ok) return Promise.resolve(null);
      return r.text().then((html) => {
        const m = html.match(/<pre id="ws-data">([\s\S]*?)<\/pre>/);
        if (!m) return null;
        const jsonText = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        try {
          return JSON.parse(jsonText);
        } catch {
          return null;
        }
      });
    }).then((json) => {
      if (!json?.ancientWord) return null;
      const { _meta, slots, overflow } = json.ancientWord;
      const byVerse = /* @__PURE__ */ new Map();
      const litByVerse = /* @__PURE__ */ new Map();
      const tradByVerse = /* @__PURE__ */ new Map();
      for (const slot of Object.values(slots)) {
        for (const [rendering, trans] of Object.entries(slot.translations)) {
          for (const inst of trans.instances) {
            const vr = extractVerseRef(inst.ref);
            if (!byVerse.has(vr)) byVerse.set(vr, rendering);
            if (!litByVerse.has(vr)) litByVerse.set(vr, inst.lit);
            if (!tradByVerse.has(vr)) tradByVerse.set(vr, inst.trad);
          }
        }
      }
      return {
        lemma: _meta.wordKey,
        fileName,
        totalInstances: _meta.totalInstances,
        hasOverflow: !!(overflow && Object.keys(overflow).length > 0),
        crossRefFileNames: json.crossRefs?.map((c) => c.fileName) ?? [],
        byVerse,
        litByVerse,
        tradByVerse
      };
    }).catch(() => null);
    fileCache.set(fileName, p);
    return p;
  }
  async function fetchLemmaFiles(lemma, idx) {
    const names = getFileNamesForLemma(lemma, idx);
    const [firstResult, ...restResults] = await Promise.all(names.map(fetchWordFile));
    const allResults = [firstResult, ...restResults];
    const crossRefNames = firstResult?.crossRefFileNames ?? [];
    if (crossRefNames.length > 0) {
      const crossResults = await Promise.all(crossRefNames.map(fetchWordFile));
      allResults.push(...crossResults);
    }
    const verseSet = /* @__PURE__ */ new Set();
    const sampleByVerse = /* @__PURE__ */ new Map();
    const litByVerse = /* @__PURE__ */ new Map();
    const tradByVerse = /* @__PURE__ */ new Map();
    let totalInstances = 0;
    let hasOverflow = false;
    for (const r of allResults) {
      if (!r) continue;
      totalInstances += r.totalInstances;
      if (r.hasOverflow) hasOverflow = true;
      for (const [vr, rendering] of r.byVerse) {
        verseSet.add(vr);
        if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
      }
      for (const [vr, lit] of r.litByVerse) {
        if (!litByVerse.has(vr)) litByVerse.set(vr, lit);
      }
      for (const [vr, trad] of r.tradByVerse) {
        if (!tradByVerse.has(vr)) tradByVerse.set(vr, trad);
      }
    }
    return { verseSet, totalInstances, hasOverflow, sampleByVerse, litByVerse, tradByVerse };
  }

  // src/phasingScripts/phase2To3/createWordSearchModule.ts
  var POPOVER_ID2 = "ws-search-popover";
  var INPUT_ID = "ws-search-input";
  var RESULTS_ID = "ws-search-results";
  var TOPBAR_BTN_ID = "ws-search-topbar-btn";
  var BOTTOMBAR_BTN_ID = "ws-search-bottombar-btn";
  var MAX_DISPLAYED = 50;
  var BOOK_DISPLAY = {
    Gen: "Genesis",
    Exo: "Exodus",
    Lev: "Leviticus",
    Num: "Numbers",
    Deu: "Deuteronomy",
    Jos: "Joshua",
    Jdg: "Judges",
    Rut: "Ruth",
    "1Sa": "1 Samuel",
    "2Sa": "2 Samuel",
    "1Ki": "1 Kings",
    "2Ki": "2 Kings",
    "1Ch": "1 Chronicles",
    "2Ch": "2 Chronicles",
    Ezr: "Ezra",
    Neh: "Nehemiah",
    Est: "Esther",
    Job: "Job",
    Psa: "Psalms",
    Pro: "Proverbs",
    Ecc: "Ecclesiastes",
    Sol: "Song of Songs",
    Isa: "Isaiah",
    Jer: "Jeremiah",
    Lam: "Lamentations",
    Eze: "Ezekiel",
    Dan: "Daniel",
    Hos: "Hosea",
    Joe: "Joel",
    Amo: "Amos",
    Oba: "Obadiah",
    Jon: "Jonah",
    Mic: "Micah",
    Nah: "Nahum",
    Hab: "Habakkuk",
    Zep: "Zephaniah",
    Hag: "Haggai",
    Zec: "Zechariah",
    Mal: "Malachi",
    Mat: "Matthew",
    Mrk: "Mark",
    Luk: "Luke",
    Jhn: "John",
    Act: "Acts",
    Rom: "Romans",
    "1Co": "1 Corinthians",
    "2Co": "2 Corinthians",
    Gal: "Galatians",
    Eph: "Ephesians",
    Php: "Philippians",
    Col: "Colossians",
    "1Th": "1 Thessalonians",
    "2Th": "2 Thessalonians",
    "1Ti": "1 Timothy",
    "2Ti": "2 Timothy",
    Tit: "Titus",
    Phm: "Philemon",
    Heb: "Hebrews",
    Jas: "James",
    "1Pe": "1 Peter",
    "2Pe": "2 Peter",
    "1Jn": "1 John",
    "2Jn": "2 John",
    "3Jn": "3 John",
    Jud: "Jude",
    Rev: "Revelation"
  };
  var BOOK_ALIASES = { Ezk: "Eze", Jol: "Joe", Sng: "Sol", Nam: "Nah" };
  var BOOK_ORDER = Object.fromEntries(Object.keys(BOOK_DISPLAY).map((k, i) => [k, i]));
  function sortCanonical(refs) {
    return [...refs].sort((a, b) => {
      const ma = a.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
      const mb = b.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
      const ai = ma ? BOOK_ORDER[BOOK_ALIASES[ma[1]] ?? ma[1]] ?? 999 : 999;
      const bi = mb ? BOOK_ORDER[BOOK_ALIASES[mb[1]] ?? mb[1]] ?? 999 : 999;
      return ai - bi || parseInt(ma?.[2] ?? "0") - parseInt(mb?.[2] ?? "0") || parseInt(ma?.[3] ?? "0") - parseInt(mb?.[3] ?? "0");
    });
  }
  function formatVerseRef(ref) {
    const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    if (!m) return ref;
    const code = BOOK_ALIASES[m[1]] ?? m[1];
    return `${BOOK_DISPLAY[code] ?? m[1]} ${m[2]}:${m[3]}`;
  }
  function verseUrl(ref) {
    const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    if (!m) return null;
    const code = BOOK_ALIASES[m[1]] ?? m[1];
    const bookName = BOOK_DISPLAY[code];
    if (!bookName) return null;
    return `https://servewell.net/-/${bookName.replace(/\s+/g, "-")}/${m[2]}#${m[3]}`;
  }
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var STYLES = `
#ws-search-popover {
  position: fixed;
  top: 62px;
  right: 0.75rem;
  left: 0.75rem;
  width: min(calc(100vw - 1.5rem), 380px);
  box-sizing: border-box;
}
@media (min-width: 540px) {
  #ws-search-popover {
    left: auto;
  }
  #ws-search-input { font-size: 1.05rem; }
  #ws-search-status { font-size: 0.88rem; }
  .ws-sr-verse-link { font-size: 0.97rem; }
  .ws-sr-word-link { font-size: 1rem; }
  #ws-see-text-bar { font-size: 0.85rem; }
  .ws-sr-verse-text { font-size: 0.84rem; }
}
#ws-search-popover {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--panel);
  padding: 0.65rem 0.75rem 0.5rem;
  margin: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  gap: 0;
}
#ws-search-popover:not(:popover-open) { display: none; }

#ws-search-input {
  width: 100%;
  font-size: 0.97rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--bg);
  color: var(--fg);
  box-sizing: border-box;
}

#ws-search-status {
  font-size: 0.8rem;
  color: var(--muted);
  min-height: 1.3em;
  padding: 0.25rem 0.1rem 0.1rem;
}

#ws-search-results {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 55vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}

#ws-search-results li {
  border-top: 1px solid var(--border);
}
#ws-search-results:empty { border: none; }

.ws-sr-verse-link {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.4rem 0.4rem;
  text-decoration: none;
  color: var(--fg);
  font-size: 0.88rem;
}
.ws-sr-verse-link:hover, .ws-sr-verse-link:focus {
  background: var(--bg);
  border-radius: 0.3rem;
}
.ws-sr-ref { font-weight: 600; white-space: nowrap; }
.ws-sr-hint {
  font-size: 0.78rem;
  color: var(--muted);
  padding: 0.35rem 0.4rem 0.1rem;
  font-style: italic;
  border-top: none !important;
}
.ws-sr-word-link {
  display: block;
  padding: 0.38rem 0.4rem;
  border-radius: 0.35rem;
  text-decoration: none;
  color: var(--fg);
  font-size: 0.9rem;
}
.ws-sr-word-link:hover, .ws-sr-word-link:focus { background: var(--bg); }
.ws-sr-count {
  font-size: 0.78em;
  color: var(--muted);
  margin-left: 0.35em;
}
#ws-see-text-bar {
  font-size: 0.78rem;
  color: var(--muted);
  padding: 0.15rem 0.1rem 0;
  display: flex;
  gap: 0.6rem;
  align-items: center;
}
#ws-see-text-bar label { cursor: pointer; user-select: none; }
.ws-sr-verse-text {
  font-size: 0.76rem;
  padding: 0.15rem 0.4rem 0.3rem;
  color: var(--muted);
  line-height: 1.55;
}
.ws-sr-trad { font-size: 0.9rem; }
.ws-sr-verse-text mark {
  background: #ffe08a;
  color: #1a1a1a;
  border-radius: 0.1em;
  padding: 0 0.1em;
}
:root[data-theme="dark"] .ws-sr-verse-text mark {
  background: #7a5f00;
  color: #f5e6a3;
}
`;
  var injected = false;
  function injectOnce() {
    if (injected) return;
    injected = true;
    if (!document.getElementById("ws-search-styles")) {
      const style = document.createElement("style");
      style.id = "ws-search-styles";
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
    if (!document.getElementById(POPOVER_ID2)) {
      const popover = document.createElement("div");
      popover.id = POPOVER_ID2;
      popover.setAttribute("popover", "");
      popover.innerHTML = `
<input id="${INPUT_ID}" type="search" placeholder="Search Bible words\u2026" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search Bible words">
<div id="ws-search-status" aria-live="polite"></div><div id="ws-see-text-bar">Show: <label>Literal <input type="checkbox" id="ws-show-lit"></label> <label>Traditional <input type="checkbox" id="ws-show-trad"></label></div><ul id="${RESULTS_ID}" role="list" aria-label="Search results"></ul>`;
      document.body.appendChild(popover);
    }
    for (const id of [TOPBAR_BTN_ID, BOTTOMBAR_BTN_ID]) {
      document.getElementById(id)?.setAttribute("popovertarget", POPOVER_ID2);
    }
    document.getElementById(POPOVER_ID2)?.addEventListener("toggle", (e) => {
      if (e.newState === "open") {
        setTimeout(() => document.getElementById(INPUT_ID)?.focus(), 30);
        prefetchIndex();
      } else {
        const inp = document.getElementById(INPUT_ID);
        if (inp) inp.value = "";
        clearDisplay();
      }
    });
    document.getElementById(INPUT_ID)?.addEventListener("input", (e) => {
      handleInput(e.target.value);
    });
    for (const id of ["ws-show-lit", "ws-show-trad"]) {
      document.getElementById(id)?.addEventListener("change", () => {
        void updateVerseText();
      });
    }
  }
  function setStatus(msg) {
    const el = document.getElementById("ws-search-status");
    if (el) el.textContent = msg;
  }
  function clearDisplay() {
    const ul = document.getElementById(RESULTS_ID);
    if (ul) ul.innerHTML = "";
    setStatus("");
    currentAllRenderingsByVerse = /* @__PURE__ */ new Map();
    currentLitByVerse = /* @__PURE__ */ new Map();
    currentTradByVerse = /* @__PURE__ */ new Map();
    for (const id of ["ws-show-lit", "ws-show-trad"]) {
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    }
  }
  function showWordLinks(matches, idx) {
    const ul = document.getElementById(RESULTS_ID);
    if (!ul) return;
    ul.innerHTML = matches.map((lemma) => {
      const count = idx[lemma];
      const countHtml = count && count > 1 ? `<span class="ws-sr-count">(${count} forms)</span>` : "";
      const url = `${WORDS_BASE_URL}/${encodeURIComponent(lemma)}`;
      return `<li><a class="ws-sr-word-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(lemma)}${countHtml}</a></li>`;
    }).join("");
  }
  function showVerseResults(verseRefs, primaryLemma, resolvedCount, hasOverflow) {
    const ul = document.getElementById(RESULTS_ID);
    if (!ul) return;
    const slice = verseRefs.slice(0, MAX_DISPLAYED);
    const items = slice.map((vr) => {
      const display = formatVerseRef(vr);
      const url = verseUrl(vr);
      const textDivs = `<div class="ws-sr-verse-text ws-sr-lit" hidden></div><div class="ws-sr-verse-text ws-sr-trad" hidden></div>`;
      return url ? `<li data-vr="${esc(vr)}"><a class="ws-sr-verse-link" href="${esc(url)}"><span class="ws-sr-ref">${esc(display)}</span></a>${textDivs}</li>` : `<li data-vr="${esc(vr)}"><span class="ws-sr-verse-link"><span class="ws-sr-ref">${esc(display)}</span></span>${textDivs}</li>`;
    }).join("");
    const overflow = hasOverflow ? "+" : "";
    const hint = verseRefs.length > MAX_DISPLAYED ? `<li class="ws-sr-hint">Showing ${MAX_DISPLAYED} of ${verseRefs.length}${overflow} \u2014 keep typing to narrow down</li>` : "";
    ul.innerHTML = items + hint;
    const overflowNote = "";
    if (resolvedCount > 1) {
      setStatus(`${verseRefs.length}${overflow} verses match all terms`);
    } else {
      setStatus(`${verseRefs.length}${overflow} verses for "${primaryLemma}"${verseRefs.length ? " \u2014 type more words to narrow" : ""}`);
    }
    const litCb = document.getElementById("ws-show-lit");
    const tradCb = document.getElementById("ws-show-trad");
    if (litCb?.checked || tradCb?.checked) {
      void updateVerseText();
    }
  }
  var activeSearchId = 0;
  var currentAllRenderingsByVerse = /* @__PURE__ */ new Map();
  var currentLitByVerse = /* @__PURE__ */ new Map();
  var currentTradByVerse = /* @__PURE__ */ new Map();
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function highlightRenderings(text, renderings) {
    let result = esc(text);
    for (const rendering of renderings) {
      const cleaned = rendering.replace(/<[^>]*>/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned.length < 2) continue;
      try {
        result = result.replace(new RegExp(`\\b(${escapeRegex(cleaned)})\\b`, "gi"), "<mark>$1</mark>");
      } catch {
      }
    }
    return result;
  }
  async function updateVerseText() {
    const ul = document.getElementById(RESULTS_ID);
    if (!ul) return;
    const showLit = document.getElementById("ws-show-lit")?.checked ?? false;
    const showTrad = document.getElementById("ws-show-trad")?.checked ?? false;
    for (const li of ul.querySelectorAll("li[data-vr]")) {
      const vr = li.dataset.vr ?? "";
      const renderings = currentAllRenderingsByVerse.get(vr) ?? /* @__PURE__ */ new Set();
      const litDiv = li.querySelector(".ws-sr-lit");
      const tradDiv = li.querySelector(".ws-sr-trad");
      if (litDiv) {
        if (showLit) {
          if (!litDiv.dataset.loaded) {
            const text = currentLitByVerse.get(vr) ?? "";
            litDiv.innerHTML = text ? highlightRenderings(text, renderings) : "";
            litDiv.dataset.loaded = "1";
          }
          litDiv.removeAttribute("hidden");
        } else {
          litDiv.setAttribute("hidden", "");
        }
      }
      if (tradDiv) {
        if (showTrad) {
          if (!tradDiv.dataset.loaded) {
            const text = currentTradByVerse.get(vr) ?? "";
            tradDiv.innerHTML = text ? highlightRenderings(text, renderings) : "";
            tradDiv.dataset.loaded = "1";
          }
          tradDiv.removeAttribute("hidden");
        } else {
          tradDiv.setAttribute("hidden", "");
        }
      }
    }
  }
  async function handleInput(rawQuery) {
    const searchId = ++activeSearchId;
    const query = rawQuery.trim();
    if (!query) {
      clearDisplay();
      return;
    }
    currentAllRenderingsByVerse = /* @__PURE__ */ new Map();
    let idx = getIndexSync();
    if (!idx) {
      if (isIndexLoadFailed()) {
        setStatus("Search index unavailable.");
        return;
      }
      setStatus("Loading index\u2026");
      idx = await loadIndex();
      if (searchId !== activeSearchId) return;
      if (!idx) {
        setStatus("Search index unavailable.");
        return;
      }
    }
    const tokens = parseQueryTokens(query);
    const resolutions = tokens.map((t) => ({ token: t, res: resolveToken(t, idx) }));
    const resolvedLemmas = resolutions.filter((r) => r.res.kind === "resolved").map((r) => r.res.lemma);
    if (resolvedLemmas.length === 0) {
      const lastRes = resolutions[resolutions.length - 1]?.res;
      if (lastRes?.kind === "ambiguous") {
        showWordLinks(lastRes.candidates.slice(0, 8), idx);
        setStatus("");
      } else {
        clearDisplay();
        setStatus(tokens.length > 0 ? "No matching words found." : "");
      }
      return;
    }
    const sorted = sortByRarity(resolvedLemmas, idx);
    const primary = sorted[0];
    setStatus(`Searching "${sorted.join(" + ")}"\u2026`);
    const fetchPromises = new Map(sorted.map((lemma) => [lemma, fetchLemmaFiles(lemma, idx)]));
    const primaryResult = await fetchPromises.get(primary);
    if (searchId !== activeSearchId) return;
    if (!primaryResult || primaryResult.verseSet.size === 0) {
      clearDisplay();
      setStatus(`No verse data found for "${primary}". (JSON files may not be deployed yet.)`);
      return;
    }
    let currentSet = primaryResult.verseSet;
    let anyOverflow = primaryResult.hasOverflow;
    currentLitByVerse = new Map(primaryResult.litByVerse);
    currentTradByVerse = new Map(primaryResult.tradByVerse);
    for (const [vr, r] of primaryResult.sampleByVerse) {
      currentAllRenderingsByVerse.set(vr, /* @__PURE__ */ new Set([r, ...sorted]));
    }
    showVerseResults(sortCanonical([...currentSet]), primary, sorted.length > 1 ? 0 : 1, anyOverflow);
    if (sorted.length > 1) {
      const remaining = sorted.slice(1);
      await Promise.all(remaining.map(async (lemma) => {
        const result = await fetchPromises.get(lemma);
        if (searchId !== activeSearchId) return;
        if (!result) return;
        const narrowed = /* @__PURE__ */ new Set();
        for (const vr of currentSet) {
          if (result.verseSet.has(vr)) narrowed.add(vr);
        }
        currentSet = narrowed;
        if (result.hasOverflow) anyOverflow = true;
        for (const [vr, r] of result.sampleByVerse) {
          const s = currentAllRenderingsByVerse.get(vr);
          if (s) s.add(r);
          else currentAllRenderingsByVerse.set(vr, /* @__PURE__ */ new Set([r]));
        }
        for (const [vr, lit] of result.litByVerse) {
          if (!currentLitByVerse.has(vr)) currentLitByVerse.set(vr, lit);
        }
        for (const [vr, trad] of result.tradByVerse) {
          if (!currentTradByVerse.has(vr)) currentTradByVerse.set(vr, trad);
        }
        if (searchId !== activeSearchId) return;
        showVerseResults(sortCanonical([...currentSet]), primary, sorted.length, anyOverflow);
      }));
    }
  }
  function createWordSearchModule() {
    const disposers = [];
    return {
      id: "word-search",
      label: "Word search",
      active: false,
      includeInMenu: false,
      activate() {
        if (this.active) return;
        this.active = true;
        injectOnce();
        const keydownHandler = (e) => {
          if (e.key === "k" && (e.metaKey || e.ctrlKey) || e.key === "/") {
            const active = document.activeElement;
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
            e.preventDefault();
            document.getElementById(POPOVER_ID2)?.showPopover?.();
          }
        };
        document.addEventListener("keydown", keydownHandler);
        disposers.push(() => document.removeEventListener("keydown", keydownHandler));
        if (typeof requestIdleCallback !== "undefined") {
          const handle = requestIdleCallback(() => prefetchIndex());
          disposers.push(() => typeof cancelIdleCallback !== "undefined" ? cancelIdleCallback(handle) : void 0);
        } else {
          setTimeout(() => prefetchIndex(), 300);
        }
      },
      deactivate() {
        if (!this.active) return;
        this.active = false;
        while (disposers.length) disposers.pop()?.();
        document.getElementById(POPOVER_ID2)?.hidePopover?.();
      }
    };
  }

  // src/phasingScripts/phase2To3/jsDomFramework.ts
  function isDemoRoute(pathname) {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    return normalizedPath === "/-/hey" || normalizedPath === "/-/hey.html";
  }
  function jsDomFramework() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => jsDomFramework(), { once: true });
      }
      return;
    }
    if (document.documentElement.dataset.appBootstrapped === "1") return;
    document.documentElement.dataset.appBootstrapped = "1";
    const delegator = createDelegator();
    const shell = createShell();
    const theme = createTheme(shell);
    const modules = createModuleRegistry(shell);
    const moderatorRoleModule = createModeratorRoleModule();
    const developerRoleModule = createDeveloperRoleModule();
    const devTimeModule = createDevTimeModule();
    const onDemoPage = typeof window !== "undefined" && isDemoRoute(window.location.pathname);
    if (onDemoPage) {
      modules.register(createDemoModule(delegator, shell));
    }
    modules.register(moderatorRoleModule);
    modules.register(developerRoleModule);
    modules.register(devTimeModule);
    modules.register(createBibleNavModule(delegator));
    modules.register(createVerseNumberPopoverModule(delegator));
    modules.register(createTransliterationModule());
    modules.register(createSelectionControlModule());
    modules.register(createWordSearchModule());
    registerShellListeners(delegator, shell, theme, modules);
    theme.restore();
    modules.render();
    modules.restoreFromStorage();
    modules.activate("word-search");
    function applyRoleAvailability(detail) {
      const roles = Array.isArray(detail?.roles) ? detail.roles.filter((role) => typeof role === "string") : [];
      const hasModerator = roles.includes("moderator");
      const hasDeveloper = roles.includes("developer");
      moderatorRoleModule.available = hasModerator;
      if (!hasModerator && modules.isActive("moderator-role")) {
        modules.deactivate("moderator-role", { persist: false });
      }
      developerRoleModule.available = hasDeveloper;
      if (!hasDeveloper) {
        if (modules.isActive("dev-time")) modules.deactivate("dev-time", { persist: false });
        if (modules.isActive("developer-role")) modules.deactivate("developer-role", { persist: false });
        devTimeModule.available = false;
      }
      modules.render();
      if (hasModerator || hasDeveloper) {
        modules.restoreFromStorage();
      }
    }
    window.addEventListener("servewell-auth-changed", (event) => {
      const customEvent = event;
      applyRoleAvailability(customEvent.detail);
    });
    window.addEventListener("servewell-developer-mode-changed", (event) => {
      const enabled = Boolean(event.detail?.enabled);
      devTimeModule.available = enabled;
      if (enabled) {
        modules.activate("dev-time");
      } else if (modules.isActive("dev-time")) {
        modules.deactivate("dev-time");
      }
      modules.render();
    });
    if (onDemoPage) {
      modules.activate("demo");
      shell.appendDemoLine("Framework booted");
    }
    modules.activate("bible-nav");
    if (document.querySelector("main.chapter-page")) {
      modules.activate("verse-number-popover");
      modules.activate("selection-control");
      activateVerseHashHighlight();
    }
  }
  function activateVerseHashHighlight() {
    const styleId = "verse-highlight-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "@keyframes verseHighlight {",
        "  0%   { outline: 3px solid rgba(253, 224, 71, 0.9); background-color: rgba(254, 249, 195, 0.6); }",
        "  60%  { outline: 3px solid rgba(253, 224, 71, 0.9); background-color: rgba(254, 249, 195, 0.6); }",
        "  100% { outline: 3px solid rgba(253, 224, 71, 0); background-color: rgba(254, 249, 195, 0); }",
        "}",
        "@keyframes verseHighlightDark {",
        "  0%   { outline: 3px solid rgba(251, 191, 36, 0.6); background-color: rgba(251, 191, 36, 0.18); }",
        "  60%  { outline: 3px solid rgba(251, 191, 36, 0.6); background-color: rgba(251, 191, 36, 0.18); }",
        "  100% { outline: 3px solid rgba(251, 191, 36, 0); background-color: rgba(251, 191, 36, 0); }",
        "}",
        ".verse-highlight {",
        "  animation: verseHighlight 2.2s ease-out forwards;",
        "  border-radius: 4px;",
        "}",
        '[data-theme="dark"] .verse-highlight {',
        "  animation-name: verseHighlightDark;",
        "}"
      ].join("\n");
      document.head.appendChild(style);
    }
    function highlight() {
      const hash = window.location.hash;
      if (!hash) return;
      const verseRef = hash.slice(1);
      const match = /^(\d+)(?:-(\d+))?$/.exec(verseRef);
      if (!match) return;
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;
      const low = Math.min(start, end);
      const high = Math.max(start, end);
      if (high - low > 200) return;
      const targets = [];
      for (let verse = low; verse <= high; verse += 1) {
        const el = document.getElementById(String(verse));
        if (el && el.classList.contains("snippet-row")) {
          targets.push(el);
        }
      }
      if (targets.length === 0) return;
      targets[0].scrollIntoView({ block: "start" });
      targets.forEach((target) => {
        target.classList.remove("verse-highlight");
        void target.offsetWidth;
        target.classList.add("verse-highlight");
        target.addEventListener("animationend", () => {
          target.classList.remove("verse-highlight");
        }, { once: true });
      });
    }
    window.addEventListener("hashchange", highlight);
    highlight();
  }

  // src/phasingScripts/phase2To3/browserEntry.ts
  jsDomFramework();
})();
