(function () {
  const statusEl = document.getElementById('suggestions-status');
  const listEl = document.getElementById('suggestions-list');

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return 'unknown date';
    return new Date(ms).toLocaleString();
  }

  function renderItems(items) {
    if (!listEl) return;
    if (!Array.isArray(items) || items.length === 0) {
      listEl.hidden = true;
      setStatus('No pending suggestions right now.');
      return;
    }

    listEl.hidden = false;
    setStatus(`${items.length} suggestion${items.length === 1 ? '' : 's'} pending.`);
    listEl.innerHTML = items.map((item) => {
      const cats = Array.isArray(item.categories) ? item.categories.join(', ') : '';
      const byLine = item.submitterName
        ? `${esc(item.submitterName)} (${esc(item.authorEmail || 'unknown')})`
        : esc(item.authorEmail || 'unknown');
      return [
        '<article class="queue-card">',
        `  <p class="queue-link" style="margin:0;font-weight:700;">${esc(item.title)}</p>`,
        `  <p class="queue-meta">Submitted ${esc(fmtDate(Number(item.createdAt || 0)))} by ${byLine}</p>`,
        `  <p class="queue-meta">Category: ${esc(cats)}</p>`,
        `  <p style="margin:0.5rem 0 0;white-space:pre-wrap;font-size:0.95rem;">${esc(item.description)}</p>`,
        '</article>'
      ].join('\n');
    }).join('\n');
  }

  async function load() {
    try {
      const response = await fetch('/api/moderation/suggestions/queue', {
        headers: { Accept: 'application/json' }
      });
      if (response.status === 403 || response.status === 401) {
        setStatus('');
        if (listEl) listEl.hidden = true;
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load suggestions');
      renderItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      if (listEl) listEl.hidden = true;
      setStatus(error instanceof Error ? error.message : 'Could not load suggestions');
    }
  }

  void load();
})();
