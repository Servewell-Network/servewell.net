(function () {
  const statusEl = document.getElementById('moderation-status');
  const listEl = document.getElementById('moderation-list');

  function formatDate(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return 'unknown date';
    return new Date(ms).toLocaleString();
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function renderItems(items) {
    if (!listEl) return;
    if (!Array.isArray(items) || items.length === 0) {
      listEl.hidden = true;
      setStatus('Nothing is waiting in the moderation queue right now.');
      return;
    }

    listEl.hidden = false;
    setStatus(`${items.length} item${items.length === 1 ? '' : 's'} waiting for moderation.`);
    listEl.innerHTML = items.map((item) => {
      const href = `/moderate-verse-commentary?id=${encodeURIComponent(item.id)}`;
      return [
        '<article class="queue-card">',
        `  <a class="queue-link" href="${href}">${escapeHtml(item.title || `${item.book} ${item.chapter}:${item.verse}`)}</a>`,
        `  <p class="queue-meta">Submitted ${escapeHtml(formatDate(Number(item.submittedAt || 0)))}</p>`,
        '</article>'
      ].join('\n');
    }).join('\n');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadQueue() {
    try {
      const response = await fetch('/api/moderation/verse-commentary/queue', {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load moderation queue');
      }
      renderItems(Array.isArray(data.items) ? data.items : []);
      window.dispatchEvent(new CustomEvent('servewell-moderation-queue-changed'));
    } catch (error) {
      if (listEl) listEl.hidden = true;
      setStatus(error instanceof Error ? error.message : 'Could not load moderation queue');
    }
  }

  void loadQueue();
})();