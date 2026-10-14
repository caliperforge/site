/* =============================================================================
   caliper-data.js
   Live-data loader for CaliperForge home + what-we-caught (reskin preview).
   Runtime feeds: /data/org_stats.json + /data/caught_public.json (generated
   projections of the ops/qa_verdicts + ops/catch_corpus SoT; do NOT hand-edit).

   Binding contract: every published number on the reskin lives inside a span
   carrying a `data-cf-key="<KEY>"` attribute (see STATS map below for the
   authoritative key list). The span's inner text is the static fallback that
   ships in the HTML, kept in sync by
     - scripts/ops/regen_caught_static_fallbacks.py  (catch record keys)
     - scripts/ops/homepage_stats_refresh.py          (org-stats keys, live root)
   and enforced by scripts/qa/caught_public_drift_check.py at deploy time.

   Runtime fills every data-cf-key span from the live JSON so the page shows
   the current numbers on the first paint after JS runs; if JS is disabled,
   the static fallback (rewritten daily by the ops scripts above) is what the
   visitor / crawler sees. Either way, no hand-typed numbers on the page.

   Legacy support: the older `data-stat="src.key"` binding pattern is still
   filled from the same feeds for any preview file that has not yet migrated,
   but new work should use `data-cf-key` exclusively.

   Also renders:
     - the decision ledger (data-ledger)
     - the catch-rate bar (data-bar="catch")
     - the misses list (data-misses-list)

   Coupling: motion layer subscribes to the `caliper:data-ready` CustomEvent
   fired after all binding has completed, so count-up / stagger / bar-fill
   can prime themselves against the freshly-loaded numbers.
   ========================================================================== */
(function () {
  'use strict';

  var FEEDS = {
    org:    '/data/org_stats.json',
    caught: '/data/caught_public.json'
  };

  // --- formatters ---------------------------------------------------------
  function formatInt(n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    return Number(n).toLocaleString();
  }
  function passthrough(v) {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  // --- unified key registry ----------------------------------------------
  // data-cf-key -> [source, dotted-path, formatter]. Keys mirror the
  // canonical maps in scripts/qa/caught_public_drift_check.py and
  // scripts/ops/homepage_stats_refresh.py so the runtime fill and the
  // static fallback stay in lockstep with the same key namespace.
  var STATS = {
    // ---------- catch record (caught_public.json) ----------
    'tp':                          ['caught', 'metrics.tp',                          formatInt],
    'fp':                          ['caught', 'metrics.fp',                          formatInt],
    'fn':                          ['caught', 'metrics.fn',                          formatInt],
    'tn':                          ['caught', 'metrics.tn',                          formatInt],
    'adjudicated':                 ['caught', 'metrics.adjudicated',                 formatInt],
    'catch_rate_display':          ['caught', 'metrics.catch_rate_display',          passthrough],
    'precision_display':           ['caught', 'metrics.precision_display',           passthrough],
    'false_positive_rate_display': ['caught', 'metrics.false_positive_rate_display', passthrough],
    'window_start':                ['caught', 'window_start',                        passthrough],
    'window_end':                  ['caught', 'window_end',                          passthrough],
    'last_updated':                ['caught', 'last_updated',                        passthrough],
    'gate_4a_tp':                  ['caught', 'metrics.by_public_gate.content_qa_4a.tp',   formatInt],
    'gate_4a_fp':                  ['caught', 'metrics.by_public_gate.content_qa_4a.fp',   formatInt],
    'gate_4a_tn':                  ['caught', 'metrics.by_public_gate.content_qa_4a.tn',   formatInt],
    'gate_4a_fn':                  ['caught', 'metrics.by_public_gate.content_qa_4a.fn',   formatInt],
    'gate_4b_tp':                  ['caught', 'metrics.by_public_gate.code_quality_4b.tp', formatInt],
    'gate_4b_fp':                  ['caught', 'metrics.by_public_gate.code_quality_4b.fp', formatInt],
    'gate_4b_tn':                  ['caught', 'metrics.by_public_gate.code_quality_4b.tn', formatInt],
    'gate_4b_fn':                  ['caught', 'metrics.by_public_gate.code_quality_4b.fn', formatInt],

    // ---------- org scale (org_stats.json) ----------
    'specialized_agents':          ['org', 'specialized_agents',        formatInt],
    'logged_agent_decisions':      ['org', 'logged_agent_decisions',    formatInt],
    'gate_reviews':                ['org', 'gate_reviews',              formatInt],
    'agent_dispatches':            ['org', 'agent_dispatches',          formatInt],
    'days_running':                ['org', 'days_running',              formatInt],
    'as_of':                       ['org', 'as_of',                     passthrough],
    'launch_date':                 ['org', 'launch_date',               passthrough]
  };

  // --- legacy `data-stat="src.key"` map for un-migrated markup -----------
  // Same feeds, older key syntax (e.g. "caught.tp", "org.days_running").
  // Retained so files not yet moved to data-cf-key still resolve.
  var LEGACY_STATS = {
    'caught.tp':           ['caught', 'metrics.tp',                       formatInt],
    'caught.fn':           ['caught', 'metrics.fn',                       formatInt],
    'caught.fp':           ['caught', 'metrics.fp',                       formatInt],
    'caught.tn':           ['caught', 'metrics.tn',                       formatInt],
    'caught.adjudicated':  ['caught', 'metrics.adjudicated',              formatInt],
    'caught.catch_rate':   ['caught', 'metrics.catch_rate_display',       passthrough],
    'caught.precision':    ['caught', 'metrics.precision_display',        passthrough],
    'caught.fp_rate':      ['caught', 'metrics.false_positive_rate_display', passthrough],
    'caught.window_start': ['caught', 'window_start',                     passthrough],
    'caught.window_end':   ['caught', 'window_end',                       passthrough],
    'org.days_running':            ['org', 'days_running',            formatInt],
    'org.specialized_agents':      ['org', 'specialized_agents',      formatInt],
    'org.logged_agent_decisions':  ['org', 'logged_agent_decisions',  formatInt],
    'org.gate_reviews':            ['org', 'gate_reviews',            formatInt],
    'org.agent_dispatches':        ['org', 'agent_dispatches',        formatInt]
  };

  function dottedGet(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce(function (acc, part) {
      return (acc && acc[part] !== undefined) ? acc[part] : undefined;
    }, obj);
  }

  // Live-compute days_running from launch_date. Runs on every page load so
  // the counter is always current regardless of when org_stats.json was
  // last regenerated. Convention: launch_date IS day 1 (inclusive), so
  //   days = floor((now - launch)/86400000) + 1
  // Source-of-truth for the +1 rule: site/data/org_stats.json.sources.days_running.
  // Falls back to the JSON value only when launch_date is missing/unparseable.
  // Ticket: T-site-staleness-durable-fix-2026-07-14.
  function computeDaysRunning(orgFeed) {
    if (!orgFeed) return undefined;
    var launch = orgFeed.launch_date;
    if (!launch) return orgFeed.days_running;
    var launchMs = Date.parse(launch);
    if (isNaN(launchMs)) return orgFeed.days_running;
    var diff = Date.now() - launchMs;
    if (diff < 0) return orgFeed.days_running;
    return Math.floor(diff / 86400000) + 1;
  }

  function fillOne(el, spec, feeds) {
    var src = feeds[spec[0]];
    if (!src) return;
    var raw = dottedGet(src, spec[1]);
    var out = spec[2](raw);
    if (out !== '' && out !== undefined && out !== null) el.textContent = out;
  }

  function fillStats(feeds) {
    // days_running is live-computed client-side (see computeDaysRunning above)
    // so the counter is always current even when org_stats.json is stale.
    // Overlay the computed value onto the org feed BEFORE binding runs — every
    // key that resolves days_running (cf-key + legacy data-stat) picks it up.
    if (feeds.org) {
      var computed = computeDaysRunning(feeds.org);
      if (computed !== undefined && computed !== null) {
        feeds.org.days_running = computed;
      }
    }
    // Primary: data-cf-key (single-SoT covered by drift check).
    Array.prototype.forEach.call(document.querySelectorAll('[data-cf-key]'), function (el) {
      var spec = STATS[el.getAttribute('data-cf-key')];
      if (spec) fillOne(el, spec, feeds);
    });
    // Legacy: data-stat, for any preview file not yet migrated.
    Array.prototype.forEach.call(document.querySelectorAll('[data-stat]'), function (el) {
      var spec = LEGACY_STATS[el.getAttribute('data-stat')];
      if (spec) fillOne(el, spec, feeds);
    });
  }

  // --- decision ledger: render tp gold + fn brick + tn navy ---------------
  function fillLedgers(caught) {
    if (!caught || !caught.metrics) return;
    var tp = Number(caught.metrics.tp) || 0;
    var fn = Number(caught.metrics.fn) || 0;
    var tn = Number(caught.metrics.tn) || 0;
    Array.prototype.forEach.call(document.querySelectorAll('[data-ledger]'), function (container) {
      var html = '';
      for (var i = 0; i < tp; i++) html += '<span class="cf-ledger-cell cf-ledger-cell--caught"></span>';
      for (var j = 0; j < fn; j++) html += '<span class="cf-ledger-cell cf-ledger-cell--missed"></span>';
      for (var k = 0; k < tn; k++) html += '<span class="cf-ledger-cell cf-ledger-cell--clean"></span>';
      container.innerHTML = html;
    });
  }

  // --- catch-rate bar: scale .cf-bar__caught / .cf-bar__missed by tp / fn -
  function fillBars(caught) {
    if (!caught || !caught.metrics) return;
    var tp = Number(caught.metrics.tp) || 0;
    var fn = Number(caught.metrics.fn) || 0;
    Array.prototype.forEach.call(document.querySelectorAll('[data-bar="catch"]'), function (bar) {
      var c = bar.querySelector('.cf-bar__caught');
      var m = bar.querySelector('.cf-bar__missed');
      if (c) c.style.flex = String(tp);
      if (m) m.style.flex = String(fn);
    });
  }

  // --- escape helpers for safe text-in-HTML insertion ---------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --- misses list: render from caught_public.misses[] -------------------
  function fillMisses(caught) {
    if (!caught || !Array.isArray(caught.misses)) return;
    var host = document.querySelector('[data-misses-list]');
    if (!host) return;
    var html = caught.misses.map(function (m, i) {
      var idx = String(i + 1).padStart(2, '0');
      var gate = m.gate_missed ? 'MISS ' + idx + ' · ' + esc(m.gate_missed) : 'MISS ' + idx + ' · DOCUMENTED';
      var meta = [];
      if (m.caught_by)  meta.push('caught by ' + esc(m.caught_by));
      if (m.caught_iso) meta.push(esc(m.caught_iso));
      if (m.fix_ref)    meta.push(esc(m.fix_ref));
      var metaLine = meta.length ? meta.join(' · ') : 'Logged, reproduced, and corrected.';
      var headline = esc(m.headline || 'Logged, reproduced, and corrected.');
      var bodyText = '';
      if (m.frame) {
        var raw = String(m.frame).replace(/<[^>]+>/g, ''); // strip any inline HTML
        var firstSentence = raw.split(/\.\s|\."\s|\.\)\s/)[0];
        if (firstSentence && firstSentence.length > 240) firstSentence = firstSentence.slice(0, 237) + '…';
        bodyText = esc(firstSentence) + (firstSentence && !/[.!?…]$/.test(firstSentence) ? '.' : '');
      }
      var writeup = m.writeup_url
        ? '<a href="' + esc(m.writeup_url) + '" class="cf-link-gold--deep">Read the write-up &rarr;</a>'
        : '<span class="cf-link-gold--deep" style="opacity:.55;cursor:default;">Write-up in the ledger</span>';
      return ''
        + '<div class="cf-card cf-card--miss">'
        +   '<div class="cf-card__eyebrow cf-card__eyebrow--miss">' + gate + '</div>'
        +   '<div class="cf-card__title cf-card__title--miss">' + headline + '</div>'
        +   '<p class="cf-card__body cf-card__body--miss">' + bodyText + '</p>'
        +   '<div class="cf-card__foot cf-card__foot--miss"><span>' + metaLine + '</span></div>'
        + '</div>';
    }).join('');
    host.innerHTML = html;
  }

  // --- fetch + dispatch ---------------------------------------------------
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  // Read launch_date from the static fallback span in the DOM. Used as a
  // last-resort source for the client-side days_running compute when the
  // org_stats.json fetch fails (page offline, CDN glitch, etc.). Keeps the
  // date counter self-healing.
  function domLaunchDate() {
    var el = document.querySelector('[data-cf-key="launch_date"]');
    return el ? el.textContent.trim() : '';
  }

  function fillDaysRunningFromDom() {
    var launch = domLaunchDate();
    if (!launch) return;
    var launchMs = Date.parse(launch);
    if (isNaN(launchMs)) return;
    var diff = Date.now() - launchMs;
    if (diff < 0) return;
    var days = Math.floor(diff / 86400000) + 1;
    Array.prototype.forEach.call(document.querySelectorAll('[data-cf-key="days_running"], [data-stat="org.days_running"]'), function (el) {
      el.textContent = formatInt(days);
    });
  }

  function run() {
    // Live-compute the day counter immediately from the DOM launch_date so
    // the number is right on first paint even before the fetch resolves —
    // and stays right even if the fetch fails outright.
    fillDaysRunningFromDom();
    Promise.all([
      fetchJSON(FEEDS.org).catch(function (e) { console.warn('[caliper-data]', e); return null; }),
      fetchJSON(FEEDS.caught).catch(function (e) { console.warn('[caliper-data]', e); return null; })
    ]).then(function (results) {
      var feeds = { org: results[0], caught: results[1] };
      fillStats(feeds);
      fillLedgers(feeds.caught);
      fillBars(feeds.caught);
      fillMisses(feeds.caught);
      try {
        document.dispatchEvent(new CustomEvent('caliper:data-ready', { detail: feeds }));
      } catch (_) { /* CustomEvent unsupported — motion just stays static */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
