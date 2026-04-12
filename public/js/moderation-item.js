(function () {
  const FIELDS = [
    {
      key: 'godAndPlan',
      heading: "God and God's Plan",
      instructions: "Give a short summary of what this verse or snippet illuminates about God and God's Plan and why that's important."
    },
    {
      key: 'examplesOfSuccess',
      heading: 'Examples of Success',
      instructions: "Give a short list of examples of how people can succeed in this part of God's plan."
    },
    {
      key: 'memoryHelps',
      heading: 'Memory Helps',
      instructions: 'Give a short summary of how this concept can be taught or remembered, such as concepts in the text that can be used as metaphors.'
    },
    {
      key: 'relatedTexts',
      heading: 'Related Texts',
      instructions: 'Give, if possible, references to a few texts that make this one more clear and a few texts that are more clear if you know this one.'
    }
  ];

  const titleEl = document.getElementById('moderation-title');
  const statusEl = document.getElementById('moderation-status');
  const formEl = document.getElementById('moderation-form');
  const fieldsEl = document.getElementById('moderation-fields');
  const publishButton = document.getElementById('publish-button');
  const rejectButton = document.getElementById('reject-button');
  const notesEl = document.getElementById('moderation-notes');
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id') || '';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function renderForm(item) {
    if (!fieldsEl || !formEl) return;
    const isRejected = item.status === 'rejected';
    if (titleEl) titleEl.textContent = `${isRejected ? 'Review Rejected Commentary' : 'Publish Verse Commentary'}: ${item.title}`;
    fieldsEl.innerHTML = FIELDS.map((field) => [
      '<section class="form-group">',
      `  <h2>${escapeHtml(field.heading)}</h2>`,
      `  <p class="form-help">${escapeHtml(field.instructions)}</p>`,
      `  <textarea data-commentary-key="${escapeHtml(field.key)}">${escapeHtml(item.entry && typeof item.entry[field.key] === 'string' ? item.entry[field.key] : '')}</textarea>`,
      '</section>'
    ].join('\n')).join('\n');
    if (notesEl) {
      notesEl.value = item.moderationNotes || '';
    }
    if (rejectButton) {
      rejectButton.disabled = isRejected;
      rejectButton.title = isRejected ? 'Already rejected' : '';
    }
    formEl.hidden = false;
    setStatus(isRejected
      ? `Reviewing rejected item ${item.title}. You can edit and publish it if desired.`
      : `Reviewing ${item.title}.`);
  }

  function readEntry() {
    const entry = {};
    FIELDS.forEach((field) => {
      const textarea = fieldsEl.querySelector(`textarea[data-commentary-key="${field.key}"]`);
      entry[field.key] = textarea ? textarea.value.trim() : '';
    });
    return entry;
  }

  async function loadItem() {
    if (!itemId) {
      setStatus('Missing moderation item id.');
      return;
    }

    try {
      const response = await fetch(`/api/moderation/verse-commentary/item?id=${encodeURIComponent(itemId)}`, {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load moderation item');
      }
      if (!data.item) {
        throw new Error('Moderation item not found');
      }
      renderForm(data.item);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load moderation item');
    }
  }

  formEl?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!itemId) return;
    const entry = readEntry();
    const moderationNotes = notesEl ? notesEl.value.trim() : '';

    try {
      if (publishButton) {
        publishButton.disabled = true;
        publishButton.textContent = 'Publishing...';
      }
      const response = await fetch('/api/moderation/verse-commentary/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, entry, moderationNotes })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not publish moderation item');
      }
      window.dispatchEvent(new CustomEvent('servewell-moderation-queue-changed'));
      window.location.href = '/list-to-moderate';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not publish moderation item');
    } finally {
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent = 'Publish';
      }
      if (rejectButton) rejectButton.disabled = false;
    }
  });

  rejectButton?.addEventListener('click', async () => {
    if (!itemId) return;
    const moderationNotes = notesEl ? notesEl.value.trim() : '';
    try {
      if (publishButton) publishButton.disabled = true;
      if (rejectButton) {
        rejectButton.disabled = true;
        rejectButton.textContent = 'Rejecting...';
      }
      const response = await fetch('/api/moderation/verse-commentary/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, moderationNotes })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reject moderation item');
      window.dispatchEvent(new CustomEvent('servewell-moderation-queue-changed'));
      window.location.href = '/list-to-moderate';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not reject moderation item');
    } finally {
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent = 'Publish';
      }
      if (rejectButton) {
        rejectButton.disabled = false;
        rejectButton.textContent = 'Reject';
      }
    }
  });

  void loadItem();
})();