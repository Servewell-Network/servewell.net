"use strict";
(() => {
  // src/phasingScripts/phase2To3/wordPageEntry.ts
  var BOOK_TO_DISPLAY_NAME = {
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
  var BOOK_ABBREV_ALIASES = {
    Ezk: "Eze",
    Jol: "Joe",
    Sng: "Sol",
    Nam: "Nah"
  };
  var BOOK_ORDER = {};
  Object.keys(BOOK_TO_DISPLAY_NAME).forEach((code, i) => {
    BOOK_ORDER[code] = i;
  });
  var GROUPBY_KEY = "ws-groupby";
  var DEFAULT_GROUPBY = "translation";
  var TRANS_PRONOUNS = /* @__PURE__ */ new Set(["I", "HE", "SHE", "IT", "THEY", "YOU", "WE", "THOU", "YE"]);
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatRef(ref) {
    const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    if (!m) return ref;
    const canon = BOOK_ABBREV_ALIASES[m[1]] ?? m[1];
    const book = BOOK_TO_DISPLAY_NAME[canon] ?? m[1];
    return `${book} ${m[2]}:${m[3]}`;
  }
  function refToUrl(ref) {
    const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    if (!m) return null;
    const canon = BOOK_ABBREV_ALIASES[m[1]] ?? m[1];
    const book = BOOK_TO_DISPLAY_NAME[canon];
    if (!book) return null;
    return `https://servewell.net/-/${book.replace(/\s+/g, "-")}/${m[2]}#${m[3]}`;
  }
  function wordLink(fileName, label) {
    return `<a href="https://words.servewell.net/${encodeURIComponent(fileName)}">${esc(label)}</a>`;
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function cleanRendering(r) {
    return r.replace(/<[^>]*>/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  var SKIP_HIGHLIGHT_WORDS = /* @__PURE__ */ new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "he",
    "her",
    "his",
    "i",
    "if",
    "in",
    "is",
    "it",
    "its",
    "my",
    "no",
    "not",
    "of",
    "on",
    "or",
    "our",
    "out",
    "she",
    "so",
    "that",
    "the",
    "their",
    "they",
    "this",
    "to",
    "up",
    "was",
    "we",
    "were",
    "what",
    "who",
    "will",
    "with",
    "you",
    "your"
  ]);
  function highlightTarget(rawText, rendering, isLit) {
    const cleaned = cleanRendering(rendering);
    if (!cleaned) return esc(rawText);
    if (!isLit) {
      const words = cleaned.toLowerCase().split(/\s+/);
      if (!words.some((w) => w.length > 2 && !SKIP_HIGHLIGHT_WORDS.has(w))) return esc(rawText);
    }
    const pattern = escapeRegex(cleaned);
    try {
      return esc(rawText).replace(new RegExp(`\\b(${pattern})\\b`, "gi"), '<mark class="ws-target">$1</mark>');
    } catch {
      return esc(rawText);
    }
  }
  function normalizeTrans(rendering) {
    const words = rendering.trim().split(/\s+/);
    const filtered = words.filter((w) => !TRANS_PRONOUNS.has(w.toUpperCase()));
    return filtered.length > 0 ? filtered.join(" ") : rendering;
  }
  function compareRefs(a, b) {
    const ma = a.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    const mb = b.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    if (!ma || !mb) return a.localeCompare(b);
    const ba = BOOK_ORDER[BOOK_ABBREV_ALIASES[ma[1]] ?? ma[1]] ?? 999;
    const bb = BOOK_ORDER[BOOK_ABBREV_ALIASES[mb[1]] ?? mb[1]] ?? 999;
    if (ba !== bb) return ba - bb;
    const ca = parseInt(ma[2]), cb = parseInt(mb[2]);
    if (ca !== cb) return ca - cb;
    return parseInt(ma[3]) - parseInt(mb[3]);
  }
  function renderByTranslation(slots, fileTotal) {
    const groups = /* @__PURE__ */ new Map();
    for (const slot of Object.values(slots)) {
      for (const [rendering, trans] of Object.entries(slot.translations)) {
        const norm = normalizeTrans(rendering);
        let g = groups.get(norm);
        if (!g) {
          g = { totalInstances: 0, instances: [] };
          groups.set(norm, g);
        }
        g.totalInstances += trans.totalInstances;
        g.instances.push(...trans.instances);
      }
    }
    const shouldCollapse = fileTotal > 30;
    return [...groups.entries()].sort((a, b) => b[1].totalInstances - a[1].totalInstances).map(([norm, g]) => {
      const trans = { totalInstances: g.totalInstances, instances: g.instances };
      return `<section class="ws-slot">${renderTranslation(norm, trans, shouldCollapse && g.totalInstances > 5)}</section>`;
    }).join("");
  }
  function renderByDocument(slots) {
    const flat = [];
    for (const slot of Object.values(slots)) {
      for (const [rendering, trans] of Object.entries(slot.translations)) {
        for (const inst of trans.instances) flat.push({ ...inst, rendering });
      }
    }
    flat.sort((a, b) => compareRefs(a.ref, b.ref));
    const books = /* @__PURE__ */ new Map();
    for (const inst of flat) {
      const m = inst.ref.match(/^([0-9]?[A-Za-z]+)/);
      const rawCode = m ? m[1] : "?";
      const canon = BOOK_ABBREV_ALIASES[rawCode] ?? rawCode;
      const bookName = BOOK_TO_DISPLAY_NAME[canon] ?? rawCode;
      let arr = books.get(bookName);
      if (!arr) {
        arr = [];
        books.set(bookName, arr);
      }
      arr.push(inst);
    }
    function instHtml(inst) {
      const url = refToUrl(inst.ref);
      const refHtml = url ? `<a class="ws-ref" href="${esc(url)}">${esc(formatRef(inst.ref))}</a>` : `<span class="ws-ref">${esc(formatRef(inst.ref))}</span>`;
      return [
        `<div class="ws-instance">`,
        refHtml,
        `<span class="ws-doc-rendering">${esc(inst.rendering)}</span>`,
        `<p class="ws-trad">${highlightTarget(inst.trad, inst.rendering, false)}</p>`,
        `<p class="ws-lit">${highlightTarget(inst.lit, inst.rendering, true)}</p>`,
        `</div>`
      ].join("");
    }
    const sections = [...books.entries()].map(([bookName, insts]) => {
      const countLabel = `${insts.length.toLocaleString()} instance${insts.length === 1 ? "" : "s"}`;
      const heading = `<h3 class="ws-rendering">${esc(bookName)} <span class="ws-count">(${countLabel})</span></h3>`;
      const [first, ...rest] = insts;
      if (rest.length === 0) {
        return `<section class="ws-slot"><div class="ws-translation">${heading}${instHtml(first)}</div></section>`;
      }
      return [
        `<section class="ws-slot"><div class="ws-translation">`,
        heading,
        instHtml(first),
        `<details class="ws-more">`,
        `<summary>${rest.length.toLocaleString()} more instance${rest.length === 1 ? "" : "s"}</summary>`,
        rest.map((i) => instHtml(i)).join(""),
        `</details>`,
        `</div></section>`
      ].join("");
    });
    return sections.join("");
  }
  function renderGroupByControl() {
    return [
      `<div class="ws-group-by" role="radiogroup" aria-label="Group word study page by" id="ws-group-by-form">`,
      `<span class="ws-group-by-label">Group word study page by</span>`,
      `<label><input type="radio" name="ws-group-by" value="translation"> translation</label>`,
      `<label><input type="radio" name="ws-group-by" value="grammar"> grammar</label>`,
      `<label><input type="radio" name="ws-group-by" value="document"> document</label>`,
      `</div>`
    ].join("");
  }
  function injectGroupByStyles() {
    const style = document.createElement("style");
    style.textContent = [
      `.ws-group-by{display:flex;flex-wrap:wrap;align-items:center;gap:.2rem 1.2rem;`,
      `margin:.2rem 0 .9rem;font-size:.9rem;}`,
      `.ws-group-by-label{color:var(--muted);font-weight:500;width:100%;}`,
      `@media(min-width:520px){.ws-group-by-label{width:auto;}}`,
      `.ws-group-by label{display:flex;align-items:center;gap:.3rem;cursor:pointer;}`,
      `.ws-group-by input[type="radio"]{cursor:pointer;accent-color:var(--link);}`,
      `.ws-doc-rendering{display:block;font-size:.78rem;font-weight:700;font-variant:small-caps;`,
      `letter-spacing:.02em;color:var(--muted);margin:.15rem 0 .1rem;}`
    ].join("");
    document.head.appendChild(style);
  }
  function wireGroupBy(data) {
    const slots = data.ancientWord.slots;
    const fileTotal = data.ancientWord._meta.totalInstances;
    const form = document.getElementById("ws-group-by-form");
    if (!form) return;
    function applyMode(mode) {
      const container = document.getElementById("ws-slots");
      if (!container) return;
      if (mode === "grammar") {
        const { html } = renderSlotsSection(slots, fileTotal);
        container.innerHTML = html;
      } else if (mode === "translation") {
        container.innerHTML = renderByTranslation(slots, fileTotal);
      } else {
        container.innerHTML = renderByDocument(slots);
      }
      wireExpandAll();
    }
    let saved = DEFAULT_GROUPBY;
    try {
      saved = localStorage.getItem(GROUPBY_KEY) ?? DEFAULT_GROUPBY;
    } catch {
    }
    const radio = form.querySelector(`input[value="${CSS.escape(saved)}"]`);
    if (radio) radio.checked = true;
    applyMode(saved);
    form.addEventListener("change", (e) => {
      const target = e.target;
      if (target.type !== "radio" || target.name !== "ws-group-by") return;
      try {
        localStorage.setItem(GROUPBY_KEY, target.value);
      } catch {
      }
      applyMode(target.value);
    });
  }
  function renderInstance(inst, rendering) {
    const url = refToUrl(inst.ref);
    const refHtml = url ? `<a class="ws-ref" href="${url}">${esc(formatRef(inst.ref))}</a>` : `<span class="ws-ref">${esc(formatRef(inst.ref))}</span>`;
    return [
      `<div class="ws-instance">`,
      refHtml,
      `<p class="ws-trad">${highlightTarget(inst.trad, rendering, false)}</p>`,
      `<p class="ws-lit">${highlightTarget(inst.lit, rendering, true)}</p>`,
      `</div>`
    ].join("");
  }
  function renderTranslation(rendering, trans, collapse) {
    const countLabel = `${trans.totalInstances.toLocaleString()} instance${trans.totalInstances === 1 ? "" : "s"}`;
    const heading = `<h3 class="ws-rendering">${esc(rendering)} <span class="ws-count">(${countLabel})</span></h3>`;
    if (!collapse || trans.instances.length <= 1) {
      return `<div class="ws-translation">${heading}${trans.instances.map((i) => renderInstance(i, rendering)).join("")}</div>`;
    }
    const [first, ...rest] = trans.instances;
    const hiddenCount = trans.totalInstances - 1;
    const notStoredCount = trans.totalInstances - 1 - rest.length;
    const overflowNote = notStoredCount > 0 ? `<p class="ws-overflow-note">${notStoredCount.toLocaleString()} additional instance${notStoredCount === 1 ? "" : "s"} are in overflow documents linked below.</p>` : "";
    return [
      `<div class="ws-translation">`,
      heading,
      renderInstance(first, rendering),
      `<details class="ws-more">`,
      `<summary>${hiddenCount.toLocaleString()} more instance${hiddenCount === 1 ? "" : "s"}</summary>`,
      rest.map((i) => renderInstance(i, rendering)).join(""),
      overflowNote,
      `</details>`,
      `</div>`
    ].join("");
  }
  function renderSlot(code, slot, fileTotal) {
    const shouldCollapse = fileTotal > 30;
    const sortedTranslations = Object.entries(slot.translations).sort((a, b) => b[1].totalInstances - a[1].totalInstances);
    const translationsHtml = sortedTranslations.map(([r, t]) => renderTranslation(r, t, shouldCollapse && t.totalInstances > 5)).join("");
    const grammarLabel = slot.grammarFull?.trim() || code;
    const statsLabel = `${slot.totalInstances.toLocaleString()} instance${slot.totalInstances === 1 ? "" : "s"} \xB7 ${slot.totalTranslations} translation${slot.totalTranslations === 1 ? "" : "s"}`;
    return [
      `<section class="ws-slot" data-grammar-code="${esc(code)}">`,
      `<h2 class="ws-grammar-full">${esc(grammarLabel)}</h2>`,
      `<p class="ws-slot-stats">${statsLabel}</p>`,
      translationsHtml,
      `</section>`
    ].join("");
  }
  function renderSlotsSection(slots, fileTotal) {
    const seen = /* @__PURE__ */ new Map();
    for (const [code, slot] of Object.entries(slots)) {
      const key = slot.grammarFull?.trim() || code;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, {
          representativeCode: code,
          merged: {
            grammarFull: slot.grammarFull,
            grammarFn: slot.grammarFn,
            totalInstances: slot.totalInstances,
            totalTranslations: slot.totalTranslations,
            translations: { ...slot.translations }
          }
        });
      } else {
        const m = existing.merged;
        for (const [rendering, trans] of Object.entries(slot.translations)) {
          if (!m.translations[rendering]) {
            m.translations[rendering] = { totalInstances: 0, instances: [] };
            m.totalTranslations++;
          }
          const t = m.translations[rendering];
          t.instances = [...t.instances, ...trans.instances];
          t.totalInstances += trans.totalInstances;
        }
        m.totalInstances += slot.totalInstances;
      }
    }
    const sorted = [...seen.values()].sort((a, b) => b.merged.totalInstances - a.merged.totalInstances);
    return {
      html: sorted.map(({ representativeCode, merged }) => renderSlot(representativeCode, merged, fileTotal)).join(""),
      mergedSlotCount: sorted.length
    };
  }
  function renderFooter(overflow, relatedFiles, crossRefs, meta) {
    const anchorHtml = relatedFiles?.length || crossRefs?.length ? `<span id="ws-related-anchor"></span>` : "";
    const parts = [];
    if (overflow && Object.keys(overflow).length > 0) {
      const items = Object.entries(overflow).map(([fn, label]) => `<li>${wordLink(fn, label)}</li>`).join("");
      parts.push(`<section class="ws-overflow-links"><h2>More Instances</h2><ul>${items}</ul></section>`);
    }
    if (relatedFiles?.length) {
      const selfLabel = meta.rootTranslation ? `${meta.rootTranslation} (${meta.lang}, ${meta.strongsId})` : `${meta.wordKey} (${meta.lang}, ${meta.strongsId})`;
      const allItems = [
        { n: meta.fileNumber, html: `<a href="#">${esc(selfLabel)}</a>` }
      ];
      for (const r of relatedFiles) {
        const m = r.fileName.match(/_(\d+)$/);
        const n = m ? parseInt(m[1]) : 2;
        const label = r.rootTranslation ? `${r.rootTranslation} (${r.lang}, ${r.strongsId})` : `${r.fileName} (${r.lang}, ${r.strongsId})`;
        allItems.push({ n, html: wordLink(r.fileName, label) });
      }
      allItems.sort((a, b) => a.n - b.n);
      const items = allItems.map((it) => `<li>${it.html}</li>`).join("");
      parts.push(
        `<section class="ws-related"><h2>Closely Related Pages</h2><p class="ws-section-desc">Pages about original language words with the same primary English translation</p><ol>${items}</ol></section>`
      );
    }
    if (crossRefs?.length) {
      const items = crossRefs.map((r) => {
        const label = r.rootTranslation ? `${r.rootTranslation} (${r.lang}, ${r.strongsId})` : `${r.wordKey} (${r.lang}, ${r.strongsId})`;
        return `<li>${wordLink(r.fileName, label)}</li>`;
      }).join("");
      parts.push(
        `<section class="ws-crossrefs"><h2>Loosely Related Pages</h2><p class="ws-section-desc">Pages about original language words that occasionally have the same English translation</p><ul>${items}</ul></section>`
      );
    }
    return parts.length ? `${anchorHtml}<div class="ws-footer">${parts.join("")}</div>` : "";
  }
  function renderMain(data, container) {
    const meta = data.ancientWord._meta;
    const hasRelatedSection = !!(data.relatedFiles?.length || data.crossRefs?.length);
    const isMultiPage = meta.fileNumber > 1 || hasRelatedSection;
    const suffix = isMultiPage ? ` (${meta.fileNumber})` : "";
    const displayWord = (meta.rootTranslation ?? meta.wordKey).toUpperCase();
    const hasAnyCollapse = meta.totalInstances > 30 && Object.values(data.ancientWord.slots).some((s) => Object.values(s.translations).some((t) => t.totalInstances > 5));
    const { html: slotsHtml, mergedSlotCount } = renderSlotsSection(data.ancientWord.slots, meta.totalInstances);
    const footer = renderFooter(data.ancientWord.overflow, data.relatedFiles, data.crossRefs, meta);
    let seeAlsoHref = "";
    if (isMultiPage) {
      if (hasRelatedSection) {
        seeAlsoHref = "#ws-related-anchor";
      } else {
        const primaryPath = location.pathname.replace(/_\d+$/, "");
        seeAlsoHref = `https://words.servewell.net${primaryPath}#ws-related-anchor`;
      }
    }
    const seeAlsoHtml = seeAlsoHref ? `<p class="ws-see-also">(See also <a href="${esc(seeAlsoHref)}">related pages</a>)</p>` : "";
    const subtitleParts = [
      ...meta.transliteration ? [esc(meta.transliteration)] : [],
      esc(meta.lemma),
      esc(meta.lang),
      esc(meta.strongsId)
    ];
    const expandBtn = hasAnyCollapse ? ` <button id="ws-expand-all" class="ws-expand-btn">Expand all</button>` : "";
    container.innerHTML = [
      `<h1>${esc(displayWord)}${esc(suffix)} <span class="ws-title-sub">\xB7 ${subtitleParts.join(" \xB7 ")}</span></h1>`,
      `<p class="ws-meta-stats">${meta.totalInstances.toLocaleString()} total instance${meta.totalInstances === 1 ? "" : "s"} \xB7 ${mergedSlotCount} grammar slot${mergedSlotCount === 1 ? "" : "s"}${expandBtn}</p>`,
      seeAlsoHtml,
      renderGroupByControl(),
      `<div id="ws-slots">${slotsHtml}</div>`,
      footer
    ].join("");
  }
  function renderOverflow(data, container) {
    const meta = data.ancientWord._meta;
    const hasAnyCollapse = meta.totalInstances > 30 && Object.values(data.ancientWord.slots).some((s) => Object.values(s.translations).some((t) => t.totalInstances > 5));
    const backLink = `<a class="ws-back-link" href="https://words.servewell.net/${encodeURIComponent(data.overflowFrom)}">&#8592; Back to ${esc(meta.wordKey)}</a>`;
    const expandBtn = hasAnyCollapse ? ` <button id="ws-expand-all" class="ws-expand-btn">Expand all</button>` : "";
    const { html: slotsHtml } = renderSlotsSection(data.ancientWord.slots, meta.totalInstances);
    container.innerHTML = [
      `<div class="ws-meta">`,
      backLink,
      `<span class="ws-meta-info">${esc(data.label)}</span>`,
      ` \xB7 <span class="ws-meta-info">${esc(meta.lang)}</span>`,
      ` \xB7 <span class="ws-meta-info">${esc(meta.strongsId)}</span>`,
      `<p class="ws-meta-stats">${meta.totalInstances.toLocaleString()} instance${meta.totalInstances === 1 ? "" : "s"} in this section${expandBtn}</p>`,
      `</div>`,
      `<div id="ws-slots">${slotsHtml}</div>`
    ].join("");
  }
  function wireExpandAll() {
    const allDetails = document.querySelectorAll("details.ws-more");
    const btn = document.getElementById("ws-expand-all");
    if (!btn) return;
    if (!allDetails.length) {
      btn.hidden = true;
      return;
    }
    function updateBtn() {
      const anyCollapsed = Array.from(allDetails).some((d) => !d.open);
      btn.textContent = anyCollapsed ? "Expand all" : "Collapse most";
    }
    updateBtn();
    allDetails.forEach((d) => d.addEventListener("toggle", updateBtn));
    btn.addEventListener("click", () => {
      const anyCollapsed = Array.from(allDetails).some((d) => !d.open);
      allDetails.forEach((d) => {
        d.open = anyCollapsed;
      });
      updateBtn();
    });
  }
  function handleFragmentScroll() {
    const hash = window.location.hash;
    if (!hash || typeof CSS === "undefined" || !CSS.escape) return;
    const m = hash.match(/[#&?]grammar=([^&]+)/);
    if (!m) return;
    const code = decodeURIComponent(m[1]);
    const container = document.getElementById("ws-slots");
    if (!container) return;
    const target = container.querySelector(`[data-grammar-code="${CSS.escape(code)}"]`);
    if (target && target.parentNode === container) {
      container.insertBefore(target, container.firstChild);
      target.classList.add("ws-slot-highlighted");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  (function init() {
    const dataEl = document.getElementById("ws-data");
    const renderEl = document.getElementById("ws-render");
    if (!dataEl || !renderEl) return;
    let data;
    try {
      data = JSON.parse(dataEl.textContent ?? "");
    } catch {
      renderEl.innerHTML = '<p style="color:red">Failed to parse word data.</p>';
      return;
    }
    if (data.type === "overflow") {
      renderOverflow(data, renderEl);
    } else {
      renderMain(data, renderEl);
    }
    injectGroupByStyles();
    wireExpandAll();
    handleFragmentScroll();
    if (!(data.type === "overflow")) {
      wireGroupBy(data);
    }
  })();
})();
