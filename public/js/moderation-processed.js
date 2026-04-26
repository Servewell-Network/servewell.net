(function () {
  const statusEl = document.getElementById('rejected-status');
  const listEl = document.getElementById('rejected-list');

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

  function render(items) {
    if (!listEl) return;
    if (!Array.isArray(items) || items.length === 0) {
      listEl.hidden = true;
      setStatus('No processed moderation items found.');
      return;
    }

    setStatus(`${items.length} processed item${items.length === 1 ? '' : 's'}.`);
    listEl.hidden = false;
    listEl.innerHTML = items.map((item) => {
      const href = `/moderate-verse-commentary?id=${encodeURIComponent(item.id)}`;
      const notes = item.moderationNotes && item.moderationNotes.trim()
        ? item.moderationNotes
        : 'No moderation notes were saved.';
      return [
        '<article class="card">',
        `  <h2><a class="rejected-link" href="${href}">${esc(item.title || `${item.book} ${item.chapter}:${item.verse}`)}</a></h2>`,
        `  <p class="meta">Rejected ${esc(fmtDate(Number(item.updatedAt || 0)))}</p>`,
        `  <p class="notes">${esc(notes)}</p>`,
        '</article>'
      ].join('\n');
    }).join('\n');
  }

  async function load() {
    try {
      const response = await fetch('/api/moderation/verse-commentary/processed', {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load processed moderation items');
      render(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      if (listEl) listEl.hidden = true;
      setStatus(error instanceof Error ? error.message : 'Could not load processed moderation items');
    }
  }

  void load();
})();