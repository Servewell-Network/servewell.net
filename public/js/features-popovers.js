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
    },
    headerStatus: {
      title: 'Status',
      content: 'Feature state: <strong>Stable</strong> (production-ready), <strong>Experimental</strong> (in testing), <strong>At Risk</strong> (needs funding), or <strong>Deprecated</strong> (being phased out). Hover over status badge for details.'
    },
    statusStable: {
      title: 'Stable',
      content: 'Feature is production-ready, well-tested, and actively maintained.'
    },
    statusExperimental: {
      title: 'Experimental',
      content: 'Feature is under active development or testing. Behavior or UI may change. Feedback welcome!'
    },
    statusAtRisk: {
      title: 'At Risk',
      content: '<p>Feature maintenance is at risk due to funding or resource constraints. Support helps ensure continued operation.</p><p style="margin-top: 0.5rem;"><a href="/features#donate" style="color: var(--fg); text-decoration: underline;">Donate now</a> to keep this feature alive.</p>'
    },
    statusDeprecated: {
      title: 'Deprecated',
      content: 'Feature is being phased out. Plan to move to newer alternatives. See details for migration guidance.'
    }
  };

  const taskPopovers = {
    'feat-interlinear': {
      title: 'Interlinear and Transliteration Tools',
      content: 'Word-by-word original-language study tools that combine interlinear display with Hebrew and Greek transliteration support. Useful for deep study, language learning, and pronunciation.'
    },
    'feat-dark-mode': {
      title: 'Dark Mode',
      content: 'Eye-friendly dark color scheme available in menu. Reduces eye strain in low-light environments. Synced across all pages.'
    },
    'feat-bookmarks': {
      title: 'Bookmarks',
      content: 'Save favorite passages and track reading progress. Bookmarks sync in your browser and work across devices with an account.'
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

  // Status badge popovers
  document.querySelectorAll('.status-badge').forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const status = this.getAttribute('data-status');
      const key = 'status' + status.charAt(0).toUpperCase() + status.slice(1);
      const popoverData = popovers[key];
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

  // Why link popovers (cross-page navigation)
  document.querySelectorAll('.why-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.stopPropagation();
      const ref = this.getAttribute('data-ref');
      if (ref === 'whats-next') {
        window.location.href = '/whats-next';
      }
      // Local refs within Features page would be fragment jumps
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
