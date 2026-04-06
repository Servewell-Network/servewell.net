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
  const taskHeaderLabel = pathname === '/whats-next' ? 'Next Task/Feature' : 'Feature';

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

  let authState = { authenticated: false, email: '' };

  function getVotesIntroHtml() {
    if (authState.authenticated) {
      const emailLine = authState.email
        ? `<p style="font-size:0.9em;margin-top:0.35rem;">Signed in as ${authState.email}.</p>`
        : '';
      return `<p style="font-size:1.05rem;font-weight:600;margin-top:0;">Your votes count as verified.</p>${emailLine}`;
    }

    return '<p style="font-size:1.05rem;font-weight:600;margin-top:0;">Sign in so your votes count as verified.</p><p><button id="headerVotesSignInBtn" type="button" style="border:1px solid var(--border,#d9d9de);border-radius:0.35rem;padding:0.4rem 0.65rem;background:var(--bar,#f4f4f5);color:var(--fg);cursor:pointer;">Sign in</button></p>';
  }

  function getHeaderVotesContent() {
    return `${getVotesIntroHtml()}<p>Community votes on feature importance. The first number is verified user votes. The second number (gray) is unverified votes, which may include spam.</p><p style="font-size:0.9em;margin-bottom:0;">Total = Upvotes - Downvotes.</p>`;
  }

  function getVoteActionsContent() {
    return `${getVotesIntroHtml()}<p>Use upvote or downvote for this row. Clicking an active vote removes it.</p><div class="vote-buttons"><button class="vote-btn" id="voteUpBtn" type="button">👍 Upvote</button><button class="vote-btn" id="voteDownBtn" type="button">👎 Downvote</button></div><p class="vote-action-hint" id="voteActionHint" style="font-size: 0.85em; margin-top: 0.5rem;"></p>`;
  }

  async function refreshVoteAuthState() {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Could not refresh vote auth state');
      }
      const data = await response.json();
      authState = {
        authenticated: Boolean(data.authenticated),
        email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
      };
    } catch (error) {
      console.warn('Could not refresh vote auth state', error);
      authState = { authenticated: false, email: '' };
    }
  }

  // --- Popover Content Definitions ---
  const popovers = {
    headerTask: {
      title: taskHeaderLabel,
      content: 'Click on any task or feature name to see additional details, including why it exists and its current state.'
    },
    headerVotes: {
      title: 'Votes',
      content: ''
    },
    voteActions: {
      title: 'Vote on this item',
      content: ''
    },
    headerFunds: {
      title: 'Funds',
      content: '<p>Funds show donations tracked for that specific feature row. If there is just one value, it is how much has been donated for that feature.</p><p>Parent features and subfeatures are tracked separately. A parent row only reflects donations for the general parent feature, and does not include donations given to subfeatures.</p><p style="margin-top: 0.5rem;">💡 Donation opportunities coming soon!</p>'
    },
    headerWhy: {
      title: 'Why',
      content: 'Parent task or reason this feature matters. Click linked items to jump to that task in What\'s Next or Features page. Top level features have Bible passage links as their "Why."'
    }
  };

  const taskPopovers = {
    'need-comparative-bible': {
      title: 'Comparative Bible',
      content: '<p><strong>Value</strong><br>A unified study environment where you can explore Scripture across Literal, Traditional, and Interlinear translation views — without switching apps or tabs. Navigation, bookmarks, and word popovers are shared across all views.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Use the Bible button in the top bar to open any chapter. Switch between Literal and Traditional using the mode selector at the top. Each chapter URL is shareable — click the address bar and copy it to share any passage.</p>'
    },
    'need-literal': {
      title: 'Literal translation',
      content: '<p><strong>Value</strong><br>Word-for-word rendering that stays as close as possible to the Greek or Hebrew source. Useful for studying translation choices and seeing what the original text says — without needing the original languages.</p><p><strong>Credit</strong><br>Builds on data from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">STEPBible.org</a> (CC BY). Huge thanks to so many who gave so much to make that available.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Open any chapter and select Literal view. Each ALL-CAPS English word corresponds to one original-language word. Tap any word to see its lemma, morphology, transliteration, and definition.</p>'
    },
    'need-traditional': {
      title: 'Traditional translation',
      content: '<p><strong>Value</strong><br>Readable, natural-English rendering suitable for devotional reading, study, and sharing. Based on established translation traditions.</p><p><strong>Credit</strong><br>Built on the <a href="https://berean.bible/licensing.htm" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">Berean Standard Bible</a> (BSB) — freely available public domain text. Huge thanks to so many who gave so much to make that available.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Open any chapter and select Traditional view. The BSB text appears verse by verse. Tap any word to see translator notes, the underlying original, and alternate renderings.</p>'
    },
    'need-word-popover-literal': {
      title: 'Word popover (Literal)',
      content: '<p><strong>Value</strong><br>Tap any word in Literal view to see the original Greek or Hebrew source — lemma, morphology, transliteration, and definition — without leaving your reading flow. Closest thing to having a language tutor beside you.</p><p><strong>Status</strong><br>Experimental — coverage and data quality continue to improve.</p><p><strong>Steps</strong><br>In Literal view, tap or click any highlighted word. The popover shows: the original script, phonetic pronunciation, grammatical function (e.g. &ldquo;verb, aorist, third person plural&rdquo;), and core meaning. Dismiss with ✕ or tap elsewhere.</p>'
    },
    'need-word-popover-traditional': {
      title: 'Word popover (Traditional)',
      content: '<p><strong>Value</strong><br>Tap any word in Traditional view to see the original-language word behind the English, how other traditions translate it, and why translators made specific choices. Understand the <em>why</em> behind the text, not just the <em>what</em>.</p><p><strong>Status</strong><br>Experimental — alternate renderings and translator notes are incrementally expanded.</p><p><strong>Steps</strong><br>In Traditional view, tap or click any word. The popover shows: the underlying Greek or Hebrew, alternate renderings, translator notes, and related cross-references. Dismiss with ✕ or tap elsewhere.</p>'
    },
    'need-interlinear': {
      title: 'Interlinear transliteration',
      content: '<p><strong>Value</strong><br>Optionally displays the original Greek or Hebrew word directly beneath each English word. Colors help to correlate traditional words with literal words and to notice when there\'s a one-to-many match or no match. Phonetic transliteration lets you approximate original pronunciation — no prior language knowledge required.</p><p><strong>Credit</strong><br>Builds on data from <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">STEPBible.org</a> (CC BY).</p><p><strong>Status</strong><br>Experimental — layout and coverage are actively improving.</p><p><strong>Steps</strong><br>Tap the three-stroke hamburger menu in the top left corner and select the checkbox that says "Show transliteration beneath each word"</p>'
    },
    'need-bible-navigation': {
      title: 'Bible navigation',
      content: '<p><strong>Value</strong><br>Move freely between books, chapters, and verses. Every passage has its own URL — copy and share it anytime. Navigation state is shared across Literal, Traditional, and Interlinear views so you stay in sync when switching.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Use the arrow buttons at the top of any chapter to move forward or back. Click a book or chapter name to jump directly. Copy the URL from your browser to share or bookmark any passage.</p>'
    },
    'need-bookmarks': {
      title: 'Bookmarks for reading progress',
      content: '<p><strong>Value</strong><br>Save your reading position and favorite passages across the Bible. Bookmarks survive page refreshes and browser restarts.</p><p><strong>Status</strong><br>Stable — sync across devices is on the <a href="/whats-next" style="color:var(--fg);text-decoration:underline;">roadmap</a>.</p><p><strong>Steps</strong><br>While reading any chapter, tap the bookmark icon to save it. Access saved bookmarks from the bookmarks menu in the top bar. Tap a bookmark to return to that passage.</p>'
    },
    'need-wcag-aa': {
      title: 'WCAG AA compliance',
      content: '<p><strong>Value</strong><br>Ensures ServeWell.Net meets the WCAG 2.1 AA standard — a well-recognized benchmark that covers color contrast, keyboard access, screen-reader compatibility, and more. Passing it means a much wider range of people can use the site without workarounds.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Audit existing pages against WCAG 2.1 AA criteria, fix contrast ratios in light and dark themes, add proper ARIA labels and landmark roles, and verify with common screen readers and keyboard-only navigation.</p>'
    },
    'need-dark-mode': {
      title: 'Dark mode',
      content: '<p><strong>Value</strong><br>Reduces eye strain in low-light environments. All pages — Bible, Features, and What&#39;s Next — respect your dark mode preference.</p><p><strong>Status</strong><br>Stable</p><p><strong>Steps</strong><br>Tap the theme toggle in the top bar (sun/moon icon) to switch between light and dark mode. Your preference is saved and applied automatically on future visits.</p>'
    },
    'need-cc0-public-domain-license': {
      title: 'CC0 public domain license',
      content: '<p><strong>Value</strong><br>Makes feature content openly reusable without legal friction, so people can copy, adapt, and redistribute material to serve others more freely under <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">CC0 public domain dedication</a>.</p><p><strong>Status</strong><br>Experimental</p><p><strong>Steps</strong><br>Go to the <a href="https://github.com/Servewell-Network/servewell.net" target="_blank" rel="noopener noreferrer" style="color:var(--fg);text-decoration:underline;">ServeWell GitHub repository</a>, open the LICENSE file, and review the CC0 wording there so you can confirm exactly what is covered.</p>'
    },
    'need-community-edits': {
      title: 'Community edits',
      content: '<p><strong>Value</strong><br>Creates an early path for the community to help shape what gets built and improved, instead of leaving product direction isolated to one person or one moment.</p><p><strong>Status</strong><br>Experimental</p><p><strong>Steps</strong><br>Use voting to signal which features matter most. Use GitHub when you want to suggest a specific change, explain a problem, or discuss implementation details. Over time, those two paths can expand into richer contribution and moderation workflows.</p>'
    },
    'need-task-feature-voting': {
      title: 'Task/feature voting',
      content: '<p><strong>Value</strong><br>Lets people register support or concern directly on Features and What\'s Next items, making product direction more visible and easier to prioritize together.</p><p><strong>Status</strong><br>Experimental</p><p><strong>Steps</strong><br>Open the Votes cell for any row, cast an upvote or downvote, and sign in if you want your vote counted as verified.</p>'
    },
    'need-logins': {
      title: 'Magic-link logins',
      content: '<p><strong>Value</strong><br>Account sign-in now makes verified voting possible without requiring passwords, while leaving room to evolve the account model later if contribution workflows grow more complex.</p><p><strong>Status</strong><br>Experimental</p><p><strong>Steps</strong><br>Click Sign in in the top bar, enter your email, and use your magic link. Verified votes then appear in the main vote count.</p>'
    },
    'need-new-feature-marker': {
      title: 'New feature marker',
      content: '<p><strong>Value</strong><br>As features (existing and next) become more numerous, it becomes difficult to see which ones are new versus which ones have already been seen. A new feature marker makes it easy to find which features are new since last reading.</p><p><strong>Status</strong><br>Experimental</p><p><strong>Steps to use</strong><br>When you scroll a feature into view and pause for more than five seconds, that feature is saved in your browser (localStorage). On your next visit to Features or What\'s Next, any features you haven\'t yet viewed appear with a bright blue &ldquo;New&rdquo; label, making recently added content easy to spot.</p>'
    },
    'need-search-all': {
      title: 'Search across all chapters',
      content: '<p><strong>Value</strong><br>Find verses, names, and themes quickly across the full Bible corpus instead of searching chapter by chapter.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Build an indexed backend query path, expose relevance-ranked results, and link every result directly to a verse anchor in the chapter pages.</p>'
    },
    'need-basic-search': {
      title: 'Basic search',
      content: '<p><strong>Value</strong><br>Simple, fast lookup that supports the immediate reading flow and validates search UX before advanced indexing.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Ship a scoped query mode first (book/chapter), then layer in highlighting, keyboard navigation, and relevance tuning.</p>'
    },
    'need-settings-in-links': {
      title: 'Settings in links',
      content: '<p><strong>Value</strong><br>Lets people share links that preserve meaningful on-screen settings so friends can open the same passage and immediately see the same important context.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Define which settings are safe and useful to encode in URLs, add copy-link controls that include those settings, and ensure incoming links restore view state predictably across supported pages.</p>'
    },
    'need-reliability': {
      title: 'Reliability',
      content: '<p><strong>Value</strong><br>Readers need to trust that core features keep working every day. Reliable behavior protects study momentum and prevents avoidable frustration.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Define reliability targets for key journeys (chapter loading, navigation, voting, and popovers), monitor regressions, and prioritize fixes that reduce breakage risk.</p>'
    },
    'need-automated-tests': {
      title: 'Automated tests',
      content: '<p><strong>Value</strong><br>Creates a safety net that catches regressions before deployment and strengthens confidence when shipping changes quickly.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Expand unit and integration coverage for critical flows, add targeted end-to-end checks for chapter navigation and feature tables, and run tests automatically in pre-deploy workflows.</p>'
    },
    'need-clarified-bible-column': {
      title: 'Clarified Bible column',
      content: '<p><strong>Value</strong><br>Adds a companion reading column focused on plain-language clarification so readers can quickly grasp meaning without losing connection to the underlying text.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Design the column layout, define how clarifications are anchored to verses, and establish editorial guidelines to keep explanations faithful, clear, and concise.</p>'
    },
    'need-clarified-bible-snippets': {
      title: 'Clarified Bible snippets',
      content: '<p><strong>Value</strong><br>Provides short, verse-level clarifications that are easy to scan, share, and revisit during study conversations.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Create snippet authoring workflow, attach snippets to verse references, and expose them in the Clarified Bible column with consistent formatting and source traceability.</p>'
    },
    'need-comparison-view': {
      title: 'Comparison view (2+ translations)',
      content: '<p><strong>Value</strong><br>Place multiple translations side by side so readers can compare wording, theology-adjacent nuances, and readability in one workspace.</p><p><strong>Status</strong><br>In progress</p><p><strong>Steps</strong><br>Align verses across selected translations, preserve shared navigation state, and add quick toggle controls for mobile/desktop layouts.</p>'
    },
    'need-bookmark-sync': {
      title: 'Bookmark sync across devices',
      content: '<p><strong>Value</strong><br>Keeps reading progress consistent across phone, tablet, and desktop so users can resume instantly.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Add authenticated bookmark storage, conflict-safe merge behavior, and transparent sync indicators in the Bible navigation UI.</p>'
    },
    'need-offline': {
      title: 'Offline mode',
      content: '<p><strong>Value</strong><br>Ensures Scripture remains usable in low-connectivity settings, travel, and constrained regions.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Cache core reading assets and selected books, provide clear offline availability badges, and gracefully queue non-critical writes.</p>'
    },
    'need-mobile-app': {
      title: 'Mobile app for iOS / Android',
      content: '<p><strong>Value</strong><br>Improves daily engagement with native navigation, notifications, and stronger offline behavior.</p><p><strong>Status</strong><br>Backlog</p><p><strong>Steps</strong><br>Stabilize web capabilities first, define shared APIs, then choose native or hybrid implementation based on performance and maintenance cost.</p>'
    },
    'need-audio': {
      title: 'Audio narrations',
      content: '<p><strong>Value</strong><br>Helps people absorb Scripture while commuting, walking, or resting, and supports learners who retain more through listening than reading alone.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Create per-chapter narration tracks with timestamp alignment to verses, provide simple playback controls in chapter view, and keep audio synchronized with shared verse links and navigation.</p>'
    },
    'need-accessibility': {
      title: 'Reasonable accessibility',
      content: '<p><strong>Value</strong><br>ServeWell.Net should be usable by everyone, regardless of ability or device. That means clear layouts, readable text, keyboard-friendly navigation, and enough contrast so nothing gets lost in the design.</p><p><strong>Status</strong><br>In progress</p><p><strong>Steps</strong><br>Identify and fix the most impactful barriers first — focus management, contrast, touch target size — and continue improving from there based on real user feedback.</p>'
    },
    'need-inspire-equip': {
      title: 'Inspire and equip',
      content: '<p><strong>Value</strong><br>Resources and tools that help people encourage, teach, and build up those around them — turning personal study into something that can be shared, taught, and multiplied.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Start with verse-level commentaries as the first building block. Expand to include other formats that support teaching, small groups, and mentoring.</p>'
    },
    'need-friend-list': {
      title: 'Friend list',
      content: '<p><strong>Value</strong><br>Part of the goal of ServeWell.Net is to help people focus on service, and helping them remember others contributes to that goal. None of us has a perfect memory. As we meet new people or get to know people better, we need a place to write notes to ourselves about those people. One way to use these notes is as a prayer list.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Create a place in the menu to enter the friends list, a form including strengths with indicators of sensitivity, a way to search the information such that sensitive information will not show up unless it is searched for, and even then it can be hidden behind a password. When reading an article in the site about desirable qualities that match with the strengths of a friend, it can remind the user to thank God for that person.</p>'
    },
    'need-footnotes': {
      title: 'Verse-level Commentaries',
      content: '<p><strong>Value</strong><br>Short, encouraging, and practical mini-articles attached to individual verses — easy to share with a friend, or use as the foundation for a class or lesson. The goal is insight that fits the moment without requiring a full commentary reading.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Build a submission form for drafting and editing commentary articles. Once published, an article — and the form to contribute a new one — will be accessible by tapping on the verse number in any chapter view.</p>'
    },
    'need-topical-index': {
      title: 'Topical index generation',
      content: '<p><strong>Value</strong><br>Lets readers discover related passages by theme (for example forgiveness, hope, justice, prayer) without needing to know exact references in advance.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Generate a curated topic map tied to verse references, expose topic browsing and search, and connect each indexed topic to chapter links that open directly at the relevant verse.</p>'
    },
    'need-literal-consistency': {
      title: 'Literal consistency',
      content: '<p><strong>Value</strong><br>Currently, the literal translation is not consistent enough to reveal at a glance whether two English words represent the same original word or different original words.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Coordinating with the concordance word studies effort that needs the same thing, we should build index pages of how the original words are translated into English, including context. Then we should use that to narrow the variance to a minimum and disambiguate the literal glosses, probably using optional ruby text. We should improve how we build the literal version so that improving the translation of a word happens in one place.</p>'
    },
    'need-compare-popular-translations': {
      title: 'Compare popular translations',
      content: '<p><strong>Value</strong><br>Comparing different translations is helpful by providing deeper insight into the text and into our faith heritage, but it can be labor intensive, so the goal is to save people time and provide quick snapshots of a few popular traditional renderings of Bible words and sentences.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Compare popular translations of the Bible with the traditional translation provided, and provide alternate renderings for each word that can be found in the popover or optionally displayed under each word. Either way, there should be attribution to its source. When there are significant sentence rearrangements that cannot be compared word for word, those can be accessed by tapping on the verse number. There would need to be checks in place to ensure that we do not plagiarize. The shorthand attributions should be links to the full copyright information required by law.</p>'
    },
    'need-divide-some-verses': {
      title: 'Divide some verses',
      content: '<p><strong>Value</strong><br>The original texts generally did not have verse divisions. They were added later and became popular, but those that created them did not always do the best job. Subdividing some verses can alleviate the problem. Sometimes it allows the early part of the verse to be associated with what came before, and the latter part with what comes after. Sometimes it helps commentary to address one theme in an earlier part and another theme in a later part. It also allows us to get some distance from the term "verse," which can be misleading to a person coming from a background where "verse" means a section of a song that is much longer than a typical Bible verse.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Start by analyzing traditional translation(s) that are already giving indication of the problems with current verse markings by putting verse numbers in the middle of sentences or by putting paragraph breaks in the middle of certain verses. Provide the basic infrastructure so that later community edits can build on it to separate even more verses if necessary. Find some term like "snippet" that can be a clear and helpful way to refer to these improved segments.</p>'
    },
    'need-ability-to-donate': {
      title: 'Ability to donate',
      content: '<p><strong>Value</strong><br>Sometimes people want to participate by contributing financially, especially when they or their loved ones have been helped. This allows the love of Christ to spread more rapidly, and that is what the world needs.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>There should be the ability to donate from the dollar estimate on each feature. Within the donation form there should be the ability to select all or multiple or zero features. If there is no nonprofit status, then there should be a question asking how much they would give if there were nonprofit status. There should also be an explanation that giving does not guarantee that the feature will be everything they want. We should also give people the option to allow us to spend the money on other features if we need to do so. The total income estimate for a feature should immediately go up for all users as soon as someone contributes to that feature. This provides some accountability to those that run the website. There should be an animation to emphasize this and make it somewhat tangible and satisfying. There should also be a way of reporting how much of that money is used and how long the total is likely to last at the current rate of spending.</p>'
    },
    'need-recent-settings': {
      title: 'Recent settings',
      content: '<p><strong>Value</strong><br>Often after someone tries a feature, the next thing they want to do is try a different setting. The goal is to make that easy. Sometimes people do not realize that they accidentally turned a feature on or off, and they have no idea why things suddenly changed, so this helps provide awareness and the ability to undo unwanted changes.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>When someone toggles or uses a feature from the menu, that feature should have a small button, often including a checkbox, that appears in a well-defined part of the top bar. This should provide a fast way to undo or reuse that feature.</p>'
    },
    'need-better-use-of-space': {
      title: 'Better use of space',
      content: '<p><strong>Value</strong><br>Currently there are two significant space issues. One is that to keep the translations aligned, we have to introduce space between the verses, which is misleading because the original text did not even have the concept of verses. The other is that on a narrow screen it is better to divide the screen horizontally rather than vertically.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Both of these issues can theoretically be solved by a nuanced scrolling mechanism. The idea is to dynamically adjust the scrolling speed of each column to keep parallel content aligned.</p>'
    },
    'need-improve-page-load-performance': {
      title: 'Improve page load performance',
      content: '<p><strong>Value</strong><br>Reducing the size of the underlying page data can help people in countries where internet data is monitored and expensive. It can also help Bible search to be faster and better as index pages are loaded in the background.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Much of the page bulk is in information that is not revealed on page load, so it can be transferred more purely as data without all of the bulky HTML that currently surrounds it. Then that HTML can be quickly recreated after the page is displayed.</p>'
    },
    'need-swn-swan-logo': {
      title: 'SWN swan logo',
      content: '<p><strong>Value</strong><br>Adding a swan logo with the letters SWN inside it can make the site more interesting and memorable, and it can also make it easier to find because when people search the internet for something in the Bible, they should be able to append the acronym "swn" and be more likely to find our site.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Create an SVG that is fairly lightweight for performance and easy to scale to any size, starting with the sizes that are needed for the web and for progressive web apps. Keep it fairly simple so it is adaptable to different backgrounds. If there is a place to provide more info, perhaps we should call it Swen the Swan.</p>'
    },
    'need-concordance-word-studies': {
      title: 'Concordance word studies',
      content: '<p><strong>Value</strong><br>One of the best ways to discover the meaning of a word is to look at the different places where it is used. This needs to be an option in the popover of every Bible word, to take us to a page that lists places where that word is used.</p><p><strong>Status</strong><br>On the roadmap</p><p><strong>Steps</strong><br>Coordinating with the literal consistency effort that needs the same thing, we should build index pages of how the original words are translated into English, including context.</p>'
    },

  };

  function wireSignInCta() {
    const signInBtn = document.getElementById('headerVotesSignInBtn');
    if (!signInBtn) return;
    signInBtn.addEventListener('click', function() {
      closePopover();
      const authButton = document.querySelector('[data-auth-button]');
      if (authButton instanceof HTMLButtonElement) {
        authButton.click();
      }
    });
  }

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
    th.addEventListener('click', async function(e) {
      e.stopPropagation();
      const id = this.id;
      const popoverData = popovers[id];
      if (popoverData) {
        if (id === 'headerVotes') {
          await refreshVoteAuthState();
        }
        const rect = this.getBoundingClientRect();
        const content = id === 'headerVotes' ? getHeaderVotesContent() : popoverData.content;
        showPopover(popoverData.title, content, rect.left + rect.width / 2, rect.top + rect.height);
        if (id === 'headerVotes') {
          setTimeout(wireSignInCta, 0);
        }
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
      title: task || taskHeaderLabel,
      content:
        `<p><strong>Value</strong><br>${task || 'Roadmap item in progress.'}</p>` +
        `<p><strong>Votes</strong><br>${votes || '(+0)'}</p>` +
        `<p><strong>Funds</strong><br>${funds || '$0'}</p>` +
        `<p><strong>Why</strong><br>${whyHtml || 'Roadmap alignment.'}</p>`
    };
  }

  function applyStepsLabel(content, taskId) {
    if (!content) return content;
    const stepsLabel = pathname === '/whats-next'
      ? 'Steps to implement'
      : 'Steps to use';
    return content.replace(/<strong>Steps<\/strong>/g, `<strong>${stepsLabel}</strong>`);
  }

  document.querySelectorAll('.task-name').forEach(task => {
    task.addEventListener('click', function(e) {
      e.stopPropagation();
      const taskId = this.getAttribute('data-task-id');
      const popoverData = taskPopovers[taskId] || buildFallbackTaskPopover(this);
      if (popoverData) {
        const rect = this.getBoundingClientRect();
        showPopover(popoverData.title, applyStepsLabel(popoverData.content, taskId), rect.left + rect.width / 2, rect.top + rect.height);
      }
    });
  });

  // Votes cell popovers (click to show voting UI)
  document.querySelectorAll('.votes-cell').forEach(cell => {
    cell.addEventListener('click', async function(e) {
      e.stopPropagation();
      const featureId = this.getAttribute('data-feature-id');
      const popoverData = popovers.voteActions;
      await refreshVoteAuthState();
      const rect = this.getBoundingClientRect();
      showPopover(popoverData.title, getVoteActionsContent(), rect.left + rect.width / 2, rect.top + rect.height);
      
      // Wire up vote buttons with feature ID context
      setTimeout(() => {
        wireSignInCta();
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
  let voteStorageKey = 'servewell-user-votes:anon';

  function loadStoredVotes() {
    Object.keys(userVotes).forEach(key => {
      delete userVotes[key];
    });

    try {
      const stored = localStorage.getItem(voteStorageKey);
      if (stored) Object.assign(userVotes, JSON.parse(stored));
    } catch (e) {
      console.warn('Could not load stored votes');
    }
  }

  loadStoredVotes();

  function saveVotes() {
    localStorage.setItem(voteStorageKey, JSON.stringify(userVotes));
  }

  window.addEventListener('servewell-auth-changed', (event) => {
    const email = event.detail && typeof event.detail.email === 'string'
      ? event.detail.email.trim().toLowerCase()
      : '';
    authState = {
      authenticated: Boolean(event.detail && event.detail.authenticated),
      email
    };
    voteStorageKey = email ? `servewell-user-votes:${email}` : 'servewell-user-votes:anon';
    loadStoredVotes();
  });

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
    document.addEventListener('DOMContentLoaded', () => {
      void refreshVoteAuthState();
      loadVoteCounts();
    });
  } else {
    void refreshVoteAuthState();
    loadVoteCounts();
  }

  window.addEventListener('focus', () => {
    void refreshVoteAuthState();
  });

  window.addEventListener('pageshow', () => {
    void refreshVoteAuthState();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void refreshVoteAuthState();
    }
  });

  console.log('Features popovers initialized');

  // --- New Feature Marker Tracking ---
  // Track when features have been viewed (in viewport for 5+ seconds)
  // and mark newly added features with a bright blue "New" badge

  const VIEWED_FEATURES_KEY = `servewell-viewed-features:${pathname || '/'}`;
  const VISIBILITY_THRESHOLD_MS = 5000; // 5 seconds
  
  // Track active visibility timers per feature row
  const visibilityTimers = new Map();

  function getViewedFeatures() {
    try {
      const stored = localStorage.getItem(VIEWED_FEATURES_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      console.warn('Could not load viewed features', e);
      return new Set();
    }
  }

  function saveViewedFeatures(featureSet) {
    try {
      localStorage.setItem(VIEWED_FEATURES_KEY, JSON.stringify(Array.from(featureSet)));
    } catch (e) {
      console.warn('Could not save viewed features', e);
    }
  }

  function addNewBadge(taskEl) {
    // Check if badge already exists
    if (taskEl.querySelector('.new-badge')) return;
    
    const badge = document.createElement('span');
    badge.className = 'new-badge';
    badge.textContent = 'New';
    taskEl.insertBefore(badge, taskEl.firstChild);
  }

  function initializeNewFeatureMarkers() {
    // Get all feature rows from the table
    const taskNameElements = Array.from(document.querySelectorAll('.task-name'));
    const currentTaskIds = taskNameElements
      .map((taskEl) => taskEl.getAttribute('data-task-id'))
      .filter((taskId) => Boolean(taskId));

    // First load on this page should establish a baseline of "already known" items.
    // This prevents marking everything as New when this page has no prior viewed list yet.
    const hasStoredList = localStorage.getItem(VIEWED_FEATURES_KEY) !== null;
    let viewed = getViewedFeatures();
    if (!hasStoredList || viewed.size === 0) {
      viewed = new Set(currentTaskIds);
      saveViewedFeatures(viewed);
    }
    
    // Set up Intersection Observer to track visibility
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const taskEl = entry.target;
        const taskId = taskEl.getAttribute('data-task-id');
        if (!taskId) return;
        
        if (entry.isIntersecting) {
          // Element is visible - start timer if not already running
          if (!visibilityTimers.has(taskId)) {
            const timer = setTimeout(() => {
              // Mark as viewed in localStorage, but don't update UI
              viewed.add(taskId);
              saveViewedFeatures(viewed);
              visibilityTimers.delete(taskId);
            }, VISIBILITY_THRESHOLD_MS);
            visibilityTimers.set(taskId, timer);
          }
        } else {
          // Element is not visible - clear timer if running
          const timer = visibilityTimers.get(taskId);
          if (timer) {
            clearTimeout(timer);
            visibilityTimers.delete(taskId);
          }
        }
      });
    }, {
      threshold: 0.5 // Element must be at least 50% visible
    });

    // Initialize badges based on localStorage and set up observers
    taskNameElements.forEach(taskEl => {
      const taskId = taskEl.getAttribute('data-task-id');
      if (!taskId) return;
      
      // Badge decisions happen only during page initialization.
      if (!viewed.has(taskId)) {
        addNewBadge(taskEl);
      }
      
      // Start observing this element for visibility
      observer.observe(taskEl);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNewFeatureMarkers);
  } else {
    initializeNewFeatureMarkers();
  }
})();
