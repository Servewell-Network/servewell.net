(function () {
  const statusEl = document.getElementById('settings-status');
  const formEl = document.getElementById('settings-form');
  const notifySuggestionsInput = document.getElementById('notify-suggestions');
  const messageEl = document.getElementById('settings-message');

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setMessage(text, tone) {
    if (!messageEl) return;
    messageEl.hidden = false;
    messageEl.textContent = text;
    messageEl.dataset.tone = tone || '';
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.hidden = true;
    messageEl.textContent = '';
    delete messageEl.dataset.tone;
  }

  async function load() {
    try {
      const response = await fetch('/api/notification-preferences', {
        headers: { Accept: 'application/json' }
      });
      if (response.status === 401) {
        setStatus('Sign in to manage your notification preferences.');
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load preferences');

      if (notifySuggestionsInput) {
        notifySuggestionsInput.checked = data.notifySuggestions !== false;
      }

      setStatus('');
      if (formEl) formEl.hidden = false;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load notification preferences');
    }
  }

  if (formEl) {
    formEl.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearMessage();

      const submitBtn = formEl.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      try {
        const response = await fetch('/api/notification-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notifySuggestions: notifySuggestionsInput ? notifySuggestionsInput.checked : true
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not save preferences');
        setMessage('Preferences saved.', 'success');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save preferences', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save preferences';
        }
      }
    });
  }

  void load();
})();
