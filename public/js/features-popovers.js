/**
 * Features page popover system
 * Handles all interactive popovers for Task, Votes, Funds, Why, and Status columns
 * Only loads on Features, What's Next, and Home pages
 */

(function() {
  // Only load on specific pages
  const pathname = window.location.pathname.replace(/\.html$/, '');
  const allowedPages = ['/', '/features', '/whats-next'];
  if (!allowedPages.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return;
  }

  // --- Popover Management ---
  const popoverOverlay = document.getElementById('popoverOverlay');
  const popoverPanel = document.getElementById('popoverPanel');
  const popoverTitle = document.getElementById('popoverTitle');
  const popoverContent = document.getElementById('popoverContent');
  const popoverClose = document.getElementById('popoverClose');

  function closePopover() {
    if (popoverPanel) {
      popoverPanel.style.display = 'none';
      popoverOverlay?.classList.remove('active');
    }
  }

  function showPopover(title, content, x, y) {
    popoverTitle.innerHTML = title;
    popoverContent.innerHTML = content;
    popoverPanel.style.display = 'block';
    popoverOverlay?.classList.add('active');
    
    // Position popover near click point but keep within viewport
    let left = x - 190; // Center-ish positioning
    let top = y + 20;
    
    if (left + 380 > window.innerWidth) {
      left = window.innerWidth - 400;
    }
    if (left < 10) left = 10;
    
    if (top + (window.innerHeight * 0.7) > window.innerHeight) {
      top = Math.max(100, window.innerHeight - (window.innerHeight * 0.7) - 20);
    }
    
    popoverPanel.style.left = left + 'px';
    popoverPanel.style.top = top + 'px';
  }

  // --- Popover Content Definitions ---
  const popovers = {
    headerTask: {
      title: 'Task/Feature',
      content: 'Click on any task or feature name to see additional details, including why it exists and its current state.'
    },
    headerVotes: {
      title: 'Votes',
      content: '<p>Community votes on feature importance. First number is verified user votes. Second number (gray) is unverified votes, which may include spam.</p><div class="vote-buttons"><button class="vote-btn" id="voteUpBtn" type="button">👍 Upvote</button><button class="vote-btn" id="voteDownBtn" type="button">👎 Downvote</button></div><p class="vote-action-hint" id="voteActionHint" style="font-size: 0.85em; margin-top: 0.5rem;"></p><p style="font-size: 0.85em; margin-top: 0.5rem;">Total = Upvotes - Downvotes. Create an account for verified voting.</p>'
    },
    headerFunds: {
      title: 'Funds',
      content: '<p>Estimated cost to implement or maintain the feature. Values like "3K/5K" show (collected/needed). Click a funds cell to see donation options.</p><p style="margin-top: 0.5rem;">💡 Donation opportunities coming soon!</p>'
    },
    headerWhy: {
      title: 'Why',
      content: 'Parent task or reason this feature matters. Click linked items to jump to that task in What\'s Next or Features page.'
    }
  };

  const taskPopovers = {
    'feat-comparative-bible': {
      title: 'Comparative Bible',
      content: '<p><strong>Value</strong><br>A unified study environment where you can explore Scripture across Literal, Traditional, and Interlinear translation views — without switching apps or tabs. Navigation, bookmarks, and word popovers are shared across all views.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Use the Bible button in the top bar to open any chapter. Switch between Literal and Traditional using the mode selector at the top. Each chapter URL is shareable — click the address bar and copy it to share any passage.</p>'
    },
    'feat-literal': {
      title: 'Literal Translation',
      content: '<p><strong>Value</strong><br>Word-for-word rendering that stays as close as possible to the Greek or Hebrew source. Useful for studying translation choices and seeing what the original text says — without needing the original languages.</p><p><strong>Credit</strong><br>Builds on data from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">STEPBible.org</a> (CC BY). Huge thanks to so many who gave so much to make that available.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Open any chapter and select Literal view. Each ALL-CAPS English word corresponds to one original-language word. Tap any word to see its lemma, morphology, transliteration, and definition.</p>'
    },
    'feat-traditional': {
      title: 'Traditional Translation',
      content: '<p><strong>Value</strong><br>Readable, natural-English rendering suitable for devotional reading, study, and sharing. Based on established translation traditions.</p><p><strong>Credit</strong><br>Built on the <a href="https://berean.bible/licensing.htm" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">Berean Standard Bible</a> (BSB) — freely available public domain text. Huge thanks to so many who gave so much to make that available.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Open any chapter and select Traditional view. The BSB text appears verse by verse. Tap any word to see translator notes, the underlying original, and alternate renderings.</p>'
    },
    'feat-word-popover-literal': {
      title: 'Word Popover (Literal View)',
      content: '<p><strong>Value</strong><br>Tap any word in Literal view to see the original Greek or Hebrew source — lemma, morphology, transliteration, and definition — without leaving your reading flow. Closest thing to having a language tutor beside you.</p><p><strong>Status</strong><br>Experimental — coverage and data quality continue to improve.</p><p><strong>Steps</strong><br>In Literal view, tap or click any highlighted word. The popover shows: the original script, phonetic pronunciation, grammatical function (e.g. &ldquo;verb, aorist, third person plural&rdquo;), and core meaning. Dismiss with ✕ or tap elsewhere.</p>'
    },
    'feat-word-popover-traditional': {
      title: 'Word Popover (Traditional View)',
      content: '<p><strong>Value</strong><br>Tap any word in Traditional view to see the original-language word behind the English, how other traditions translate it, and why translators made specific choices. Understand the <em>why</em> behind the text, not just the <em>what</em>.</p><p><strong>Status</strong><br>Experimental — alternate renderings and translator notes are incrementally expanded.</p><p><strong>Steps</strong><br>In Traditional view, tap or click any word. The popover shows: the underlying Greek or Hebrew, alternate renderings, translator notes, and related cross-references. Dismiss with ✕ or tap elsewhere.</p>'
    },
    'feat-interlinear': {
      title: 'Interlinear Transliteration Tools',
      content: '<p><strong>Value</strong><br>Displays the original Greek or Hebrew text word-by-word with the English rendering directly beneath each word. Phonetic transliteration lets you approximate original pronunciation — no prior language knowledge required.</p><p><strong>Credit</strong><br>Builds on data from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">STEPBible.org</a> (CC BY).</p><p><strong>Status</strong><br>Experimental — layout and coverage are actively improving.</p><p><strong>Steps</strong><br>Open any chapter and enable Interlinear view from the mode selector. The original-language text appears above its English equivalent. Tap any word to open the full morphology popover.</p>'
    },
    'feat-bible-navigation': {
      title: 'Bible Navigation',
      content: '<p><strong>Value</strong><br>Move freely between books, chapters, and verses. Every passage has its own URL — copy and share it anytime. Navigation state is shared across Literal, Traditional, and Interlinear views so you stay in sync when switching.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Use the arrow buttons at the top of any chapter to move forward or back. Click a book or chapter name to jump directly. Copy the URL from your browser to share or bookmark any passage.</p>'
    },
    'feat-bookmarks': {
      title: 'Bookmarks for Reading Progress',
      content: '<p><strong>Value</strong><br>Save your reading position and favorite passages across the Bible. Bookmarks survive page refreshes and browser restarts.</p><p><strong>Status</strong><br>Stable — sync across devices is on the <a href="/whats-next" style="color:var(--fg);text-decoration:underline;">roadmap</a>.</p><p><strong>Steps</strong><br>While reading any chapter, tap the bookmark icon to save it. Access saved bookmarks from the bookmarks menu in the top bar. Tap a bookmark to return to that passage.</p>'
    },
    'feat-dark-mode': {
      title: 'Dark Mode',
      content: '<p><strong>Value</strong><br>Reduces eye strain in low-light environments. All pages — Bible, Features, and What&#39;s Next — respect your dark mode preference.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Tap the theme toggle in the top bar (sun/moon icon) to switch between light and dark mode. Your preference is saved and applied automatically on future visits.</p>'
    }
  };

  // --- Event Listeners ---
  
  if (popoverClose) {
    popoverClose.addEventListener('click', closePopover);
  }
  
  if (popoverOverlay) {
    popoverOverlay.addEventListener('click', closePopover);
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopover();
  });

  // Header popovers
  document.querySelectorAll('.features-table th').forEach(th => {
    th.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = this.id;
      const popoverData = popovers[id];
      if (popoverData) {
        const rect = this.getBoundingClientRect();
        showPopover(popoverData.title, popoverData.content, rect.left + rect.width / 2, rect.top + rect.height);
      }
    });
  });

  // Task name popovers
  document.querySelectorAll('.task-name').forEach(task => {
    task.addEventListener('click', function(e) {
      e.stopPropagation();
      const taskId = this.getAttribute('data-task-id');
      const popoverData = taskPopovers[taskId];
      if (popoverData) {
        const rect = this.getBoundingClientRect();
        showPopover(popoverData.title, popoverData.content, rect.left + rect.width / 2, rect.top + rect.height);
      }
    });
  });

  // Votes cell popovers (click to show voting UI)
  document.querySelectorAll('.votes-cell').forEach(cell => {
    cell.addEventListener('click', function(e) {
      e.stopPropagation();
      const featureId = this.getAttribute('data-feature-id');
      const popoverData = popovers.headerVotes;
      const rect = this.getBoundingClientRect();
      showPopover(popoverData.title, popoverData.content, rect.left + rect.width / 2, rect.top + rect.height);
      
      // Wire up vote buttons with feature ID context
      setTimeout(() => {
        const upBtn = document.getElementById('voteUpBtn');
        const downBtn = document.getElementById('voteDownBtn');
        renderVoteButtonState(featureId);
        if (upBtn) upBtn.addEventListener('click', () => handleVote(featureId, 'up'));
        if (downBtn) downBtn.addEventListener('click', () => handleVote(featureId, 'down'));
      }, 0);
    });
  });

  // Funds cell popovers
  document.querySelectorAll('.funds-cell').forEach(cell => {
    cell.addEventListener('click', function(e) {
      e.stopPropagation();
      const popoverData = popovers.headerFunds;
      const rect = this.getBoundingClientRect();
      showPopover(popoverData.title, popoverData.content, rect.left + rect.width / 2, rect.top + rect.height);
    });
  });

  // --- Filter Functionality ---
  const filterInput = document.getElementById('featureFilter');
  if (filterInput) {
    filterInput.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      document.querySelectorAll('.features-table tbody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  // --- Suggest Feature Button ---
  const suggestButton = document.getElementById('suggestButton');
  if (suggestButton) {
    suggestButton.addEventListener('click', function(e) {
      e.stopPropagation();
      // Phase 3: This will open a suggestion form or nav to a dedicated page
      showPopover('Suggest a Feature', '<p>Feature suggestion form coming soon!</p><p>In the meantime, suggestions welcome on <a href="https://github.com/Servewell-Network/servewell.net" style="color: var(--fg); text-decoration: underline;">GitHub</a>.</p>');
    });
  }

  // --- Vote Handler (Phase 2 integrates with server) ---
  // Track current votes to enable toggling - persisted to localStorage
  const userVotes = {}; // { [featureId]: 'up' | 'down' | null }

  // Load stored votes from localStorage
  try {
    const stored = localStorage.getItem('servewell-user-votes');
    if (stored) Object.assign(userVotes, JSON.parse(stored));
  } catch (e) {
    console.warn('Could not load stored votes');
  }

  function saveVotes() {
    localStorage.setItem('servewell-user-votes', JSON.stringify(userVotes));
  }

  function renderVoteButtonState(featureId) {
    const currentVote = userVotes[featureId] || null;
    const upBtn = document.getElementById('voteUpBtn');
    const downBtn = document.getElementById('voteDownBtn');
    const hint = document.getElementById('voteActionHint');

    if (!upBtn || !downBtn) {
      return;
    }

    const upActive = currentVote === 'up';
    const downActive = currentVote === 'down';

    upBtn.classList.toggle('active', upActive);
    downBtn.classList.toggle('active', downActive);
    upBtn.setAttribute('aria-pressed', String(upActive));
    downBtn.setAttribute('aria-pressed', String(downActive));
    upBtn.textContent = upActive ? '👍 Remove upvote' : '👍 Upvote';
    downBtn.textContent = downActive ? '👎 Remove downvote' : '👎 Downvote';

    if (hint) {
      hint.textContent = upActive || downActive
        ? 'Click the active button to remove your vote, or click the other button to switch sides.'
        : 'Choose upvote or downvote.';
    }
  }

  async function handleVote(featureId, direction) {
    try {
      // Direct voting: up always sets +1, down always sets -1.
      // Clicking the active vote removes it.
      const currentVote = userVotes[featureId] || null;
      
      // Clicking the currently active vote clears it.
      if (currentVote === direction) {
        direction = 'neutral';
      }

      const response = await fetch(`/api/vote/${featureId}/${direction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to record vote');
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Update vote display for this feature
        updateVoteDisplay(featureId, data.votes);
        
        // Track the vote state
        if (data.direction === 'neutral') {
          userVotes[featureId] = null;
        } else {
          userVotes[featureId] = data.direction;
        }
        saveVotes();
        
        closePopover();
        
        // Optionally show feedback
        if (data.direction === 'neutral') {
          console.log(`Removed vote for ${featureId}`);
        } else {
          console.log(`Voted ${data.direction} on ${featureId}`);
        }
      }
    } catch (e) {
      console.error('Vote error:', e);
      alert('Error recording vote: ' + e.message);
    }
  }

  // Update vote counts in the table
    function formatVoteDisplay(count) {
      if (count > 0) return `(+${count})`;
      if (count < 0) return `(${count})`;
      return `(+0)`;
    }

    function updateVoteDisplay(featureId, votes) {
    const votersCell = document.querySelector(`[data-feature-id="${featureId}"]`);
    if (votersCell) {
      const mainSpan = votersCell.querySelector('.votes-main');
      const unverifiedSpan = votersCell.querySelector('.votes-unverified');
      if (mainSpan) mainSpan.textContent = votes.main;
        if (unverifiedSpan) unverifiedSpan.textContent = formatVoteDisplay(votes.unverified);
    }
  }

  // Load initial vote counts from server
  async function loadVoteCounts() {
    try {
      const response = await fetch('/api/votes');
      if (!response.ok) return;

      const allVotes = await response.json();
      
      // Update all vote cells in the table
      document.querySelectorAll('.votes-cell').forEach(cell => {
        const featureId = cell.getAttribute('data-feature-id');
        const voteData = allVotes[featureId];
        if (voteData) {
          const main = voteData.verified_up - voteData.verified_down;
          const unverified = voteData.unverified_up - voteData.unverified_down;
          
          const mainSpan = cell.querySelector('.votes-main');
          const unverifiedSpan = cell.querySelector('.votes-unverified');
          if (mainSpan) mainSpan.textContent = main;
          if (unverifiedSpan) unverifiedSpan.textContent = formatVoteDisplay(unverified);
        }
      });
    } catch (e) {
      console.error('Error loading vote counts:', e);
    }
  }

  // Load votes when page initializes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadVoteCounts);
  } else {
    loadVoteCounts();
  }

  console.log('Features popovers initialized');
})();
