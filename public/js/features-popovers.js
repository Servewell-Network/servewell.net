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
      content: '<p>Funds show donations tracked for that specific feature row. If there is just one value, it is how much has been donated for that feature.</p><p>Parent features and subfeatures are tracked separately. A parent row only reflects donations for the general parent feature, and does not include donations given to subfeatures.</p><p style="margin-top: 0.5rem;">💡 Donation opportunities coming soon!</p>'
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
    'task-wcag-aa': {
      title: 'WCAG AA Compliance',
      content: '<p><strong>Value</strong><br>Ensures ServeWell.Net meets the WCAG 2.1 AA standard — a well-recognized benchmark that covers color contrast, keyboard access, screen-reader compatibility, and more. Passing it means a much wider range of people can use the site without workarounds.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Audit existing pages against WCAG 2.1 AA criteria, fix contrast ratios in light and dark themes, add proper ARIA labels and landmark roles, and verify with common screen readers and keyboard-only navigation.</p>'
    },
    'feat-dark-mode': {
      title: 'Dark Mode',
      content: '<p><strong>Value</strong><br>Reduces eye strain in low-light environments. All pages — Bible, Features, and What&#39;s Next — respect your dark mode preference.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Tap the theme toggle in the top bar (sun/moon icon) to switch between light and dark mode. Your preference is saved and applied automatically on future visits.</p>'
    },
    'feat-cc0-public-domain-license': {
      title: 'CC0 Public Domain License',
      content: '<p><strong>Value</strong><br>Makes feature content openly reusable without legal friction, so people can copy, adapt, and redistribute material to serve others more freely under <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">CC0 public domain dedication</a>.</p><p><strong>Status</strong><br>Experimental</p><p><strong>Steps</strong><br>Go to the <a href="https://github.com/Servewell-Network/servewell.net" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">ServeWell GitHub repository</a>, open the LICENSE file, and review the CC0 wording there so you can confirm exactly what is covered.</p>'
    },
    'task-search-all': {
      title: 'Search Across All Chapters',
      content: '<p><strong>Value</strong><br>Find verses, names, and themes quickly across the full Bible corpus instead of searching chapter by chapter.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Build an indexed backend query path, expose relevance-ranked results, and link every result directly to a verse anchor in the chapter pages.</p>'
    },
    'task-basic-search': {
      title: 'Basic Search',
      content: '<p><strong>Value</strong><br>Simple, fast lookup that supports the immediate reading flow and validates search UX before advanced indexing.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Ship a scoped query mode first (book/chapter), then layer in highlighting, keyboard navigation, and relevance tuning.</p>'
    },
    'task-settings-in-links': {
      title: 'Settings in Links',
      content: '<p><strong>Value</strong><br>Lets people share links that preserve meaningful on-screen settings so friends can open the same passage and immediately see the same important context.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Define which settings are safe and useful to encode in URLs, add copy-link controls that include those settings, and ensure incoming links restore view state predictably across supported pages.</p>'
    },
    'task-reliability': {
      title: 'Reliability',
      content: '<p><strong>Value</strong><br>Readers need to trust that core features keep working every day. Reliable behavior protects study momentum and prevents avoidable frustration.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Define reliability targets for key journeys (chapter loading, navigation, voting, and popovers), monitor regressions, and prioritize fixes that reduce breakage risk.</p>'
    },
    'task-automated-tests': {
      title: 'Automated Tests',
      content: '<p><strong>Value</strong><br>Creates a safety net that catches regressions before deployment and strengthens confidence when shipping changes quickly.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Expand unit and integration coverage for critical flows, add targeted end-to-end checks for chapter navigation and feature tables, and run tests automatically in pre-deploy workflows.</p>'
    },
    'task-clarified-bible-column': {
      title: 'Clarified Bible Column',
      content: '<p><strong>Value</strong><br>Adds a companion reading column focused on plain-language clarification so readers can quickly grasp meaning without losing connection to the underlying text.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Design the column layout, define how clarifications are anchored to verses, and establish editorial guidelines to keep explanations faithful, clear, and concise.</p>'
    },
    'task-clarified-bible-snippets': {
      title: 'Clarified Bible Snippets',
      content: '<p><strong>Value</strong><br>Provides short, verse-level clarifications that are easy to scan, share, and revisit during study conversations.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Create snippet authoring workflow, attach snippets to verse references, and expose them in the Clarified Bible column with consistent formatting and source traceability.</p>'
    },
    'task-comparison-view': {
      title: 'Comparison View (2+ Translations)',
      content: '<p><strong>Value</strong><br>Place multiple translations side by side so readers can compare wording, theology-adjacent nuances, and readability in one workspace.</p><p><strong>Status</strong><br>In progress</p><p><strong>Steps</strong><br>Align verses across selected translations, preserve shared navigation state, and add quick toggle controls for mobile/desktop layouts.</p>'
    },
    'task-bookmark-sync': {
      title: 'Bookmark Sync Across Devices',
      content: '<p><strong>Value</strong><br>Keeps reading progress consistent across phone, tablet, and desktop so users can resume instantly.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Add authenticated bookmark storage, conflict-safe merge behavior, and transparent sync indicators in the Bible navigation UI.</p>'
    },
    'task-offline': {
      title: 'Offline Mode',
      content: '<p><strong>Value</strong><br>Ensures Scripture remains usable in low-connectivity settings, travel, and constrained regions.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Cache core reading assets and selected books, provide clear offline availability badges, and gracefully queue non-critical writes.</p>'
    },
    'task-mobile-app': {
      title: 'Mobile App for iOS / Android',
      content: '<p><strong>Value</strong><br>Improves daily engagement with native navigation, notifications, and stronger offline behavior.</p><p><strong>Status</strong><br>Backlog</p><p><strong>Steps</strong><br>Stabilize web capabilities first, define shared APIs, then choose native or hybrid implementation based on performance and maintenance cost.</p>'
    },
    'task-audio': {
      title: 'Audio Narrations',
      content: '<p><strong>Value</strong><br>Helps people absorb Scripture while commuting, walking, or resting, and supports learners who retain more through listening than reading alone.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Create per-chapter narration tracks with timestamp alignment to verses, provide simple playback controls in chapter view, and keep audio synchronized with shared verse links and navigation.</p>'
    },
    'task-accessibility': {
      title: 'Accessibility Improvements',
      content: '<p><strong>Value</strong><br>ServeWell.Net should be usable by everyone, regardless of ability or device. That means clear layouts, readable text, keyboard-friendly navigation, and enough contrast so nothing gets lost in the design.</p><p><strong>Status</strong><br>In progress</p><p><strong>Steps</strong><br>Identify and fix the most impactful barriers first — focus management, contrast, touch target size — and continue improving from there based on real user feedback.</p>'
    },
    'task-inspire-equip': {
      title: 'Inspire and Equip',
      content: '<p><strong>Value</strong><br>Resources and tools that help people encourage, teach, and build up those around them — turning personal study into something that can be shared, taught, and multiplied.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Start with verse-level commentaries as the first building block. Expand to include other formats that support teaching, small groups, and mentoring.</p>'
    },
    'task-footnotes': {
      title: 'Verse-level Commentaries',
      content: '<p><strong>Value</strong><br>Short, encouraging, and practical mini-articles attached to individual verses — easy to share with a friend, or use as the foundation for a class or lesson. The goal is insight that fits the moment without requiring a full commentary reading.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Build a submission form for drafting and editing commentary articles. Once published, an article — and the form to contribute a new one — will be accessible by tapping on the verse number in any chapter view.</p>'
    },
    'task-topical-index': {
      title: 'Topical Index Generation',
      content: '<p><strong>Value</strong><br>Lets readers discover related passages by theme (for example forgiveness, hope, justice, prayer) without needing to know exact references in advance.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Generate a curated topic map tied to verse references, expose topic browsing and search, and connect each indexed topic to chapter links that open directly at the relevant verse.</p>'
    },
    'task-annotations': {
      title: 'Community Edits',
      content: '<p><strong>Value</strong><br>Allows the community to improve commentary quality over time by suggesting fixes, clarifications, and additions directly where readers are already studying.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Introduce a moderation workflow where submitted edits are reviewed before publication. Start with simple approval controls and auditing, then refine the moderation process over time as contributor patterns and quality needs become clearer.</p>'
    },
    'task-logins': {
      title: 'Logins',
      content: '<p><strong>Value</strong><br>Account-based logins make community editing safer and more accountable by tying submissions and moderation actions to identifiable users.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Implement sign-in and session management, add role-aware permissions for contributors and moderators, and connect edit history to user identities for transparent review and rollback.</p>'
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
  function buildFallbackTaskPopover(taskEl) {
    const row = taskEl.closest('tr');
    if (!row) return null;

    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return null;

    const task = (cells[0].textContent || '').trim();
    const votes = (cells[1].textContent || '').trim();
    const funds = (cells[2].textContent || '').trim();
    const whyCell = cells[3];
    const whyLink = whyCell.querySelector('a');
    const whyText = whyLink ? whyLink.textContent.trim() : (whyCell.textContent || '').trim();
    const whyHref = whyLink ? whyLink.getAttribute('href') : null;

    const whyHtml = whyHref
      ? `<a href="${whyHref}" style="color:var(--fg);text-decoration:underline;">${whyText}</a>`
      : whyText;

    return {
      title: task || 'Task/Feature',
      content:
        `<p><strong>Value</strong><br>${task || 'Roadmap item in progress.'}</p>` +
        `<p><strong>Votes</strong><br>${votes || '(+0)'}</p>` +
        `<p><strong>Funds</strong><br>${funds || '$0'}</p>` +
        `<p><strong>Why</strong><br>${whyHtml || 'Roadmap alignment.'}</p>`
    };
  }

  document.querySelectorAll('.task-name').forEach(task => {
    task.addEventListener('click', function(e) {
      e.stopPropagation();
      const taskId = this.getAttribute('data-task-id');
      const popoverData = taskPopovers[taskId] || buildFallbackTaskPopover(this);
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
