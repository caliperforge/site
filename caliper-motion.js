/* =============================================================================
   caliper-motion.js
   Motion layer for the CaliperForge home + what-we-caught (reskin preview).

   Six effects, all gated behind prefers-reduced-motion:
     1. Scroll-reveal — section blocks fade in and rise ~16px on viewport entry
        (IntersectionObserver, ~450ms ease-out, fires once, threshold 0.15).
     2. Headline entrance — .cf-h1--entrance headlines animate their .cf-hline
        lines up + in with a 90ms stagger on first paint. Draws the eye
        top-to-bottom on the hero rather than presenting a solid wall of type.
     3. Count-up — every .cf-stat-num animates from 0 to its final value when
        the stat scrolls into view (rAF, ~900ms ease-out cubic; 1400ms for
        the .cf-stat--lead hero row so the big scale numbers get room to
        settle). For data-loaded stats the final value is read AFTER
        caliper-data.js has filled it. Numeric prefix is animated; a suffix
        like "%" is kept verbatim.
     4. Lead-stat underline draw — each .cf-stat--lead's ruled underline
        scales from 0 -> 100% width alongside the count-up, so the row reads
        as a caliper drawing a line under the number.
     5. Decision-ledger stagger + live pulse — each grid cell (gold / brick /
        navy) fades in with an 8ms cascade once the ledger scrolls into view;
        gold "caught" cells then continue a slow CSS pulse to signal the
        ledger is live rather than static.
     6. Catch-rate bar — the gold-caught / brick-missed grow widths animate
        from 0 to the loaded ratio.

   Accessibility:
     - All motion is gated behind @media (prefers-reduced-motion: no-preference)
       in CSS, and the JS short-circuits every entrance / reset when
       matchMedia reports reduced motion. The final, readable state is
       rendered with zero animation, and content is never gated behind an
       effect (reveals sit on already-rendered DOM, never display:none).

   Coupling: depends on caliper-data.js firing a `caliper:data-ready`
   CustomEvent after it has filled data-cf-key / data-stat spans, the
   ledger, and the bar. This event replaces the old paint-based timing so
   count-up can prime "0" placeholders synchronously with the data fill.
   ========================================================================== */
(function () {
  'use strict';

  // --- capability + preference checks ------------------------------------
  if (!('IntersectionObserver' in window) || !window.requestAnimationFrame) {
    return; // no supported scroll API — leave the page in its final state
  }
  var REDUCE = (typeof window.matchMedia === 'function')
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- shared IntersectionObserver factory --------------------------------
  function onceVisible(el, threshold, cb) {
    var obs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          obs.disconnect();
          cb(entries[i].target);
          return;
        }
      }
    }, { threshold: threshold, rootMargin: '0px 0px -40px 0px' });
    obs.observe(el);
  }

  // ============================================================
  // 1. SCROLL REVEAL
  // ============================================================
  function setupReveal() {
    if (REDUCE) return;
    var candidates = document.querySelectorAll('section .cf-shell > *');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.classList.contains('cf-ledger')) continue;
      el.classList.add('cf-reveal');
      onceVisible(el, 0.15, function (t) { t.classList.add('cf-revealed'); });
    }
  }

  // ============================================================
  // 2. HEADLINE ENTRANCE (per-line stagger)
  // ============================================================
  function setupHeadlineEntrance() {
    if (REDUCE) return;
    var heads = document.querySelectorAll('.cf-h1--entrance');
    for (var i = 0; i < heads.length; i++) {
      var head = heads[i];
      var lines = head.querySelectorAll('.cf-hline');
      for (var j = 0; j < lines.length; j++) {
        // 90ms stagger — restrained enough to feel like a single settle,
        // fast enough that the whole headline is in place before the eye
        // has time to notice a delay on the last line.
        lines[j].style.transitionDelay = (j * 90) + 'ms';
      }
      // Delay one frame so the initial (opacity:0, translateY) state paints
      // before we flip the "in" class and the transition can pick it up.
      (function (h) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { h.classList.add('cf-hline-in'); });
        });
      })(head);
    }
  }

  // ============================================================
  // 3. COUNT-UP
  // ============================================================
  // Parse a stat text "74%" -> { target:74, suffix:"%", isInt:true }.
  function parseStat(text) {
    var m = String(text).match(/^([\d][\d,]*(?:\.\d+)?)(.*)$/);
    if (!m) return null;
    var num = Number(m[1].replace(/,/g, ''));
    if (!isFinite(num)) return null;
    return { target: num, suffix: m[2] || '', isInt: m[1].indexOf('.') === -1 };
  }

  function animateNum(el, parsed, finalText, durationMs, onDone) {
    var dur = durationMs || 900;
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var t = (now - start) / dur;
      if (t >= 1) {
        el.textContent = finalText;
        if (onDone) onDone();
        return;
      }
      var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      var val = parsed.target * eased;
      el.textContent = (parsed.isInt
        ? Math.round(val).toLocaleString()
        : val.toFixed(1)
      ) + parsed.suffix;
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }

  // The lead stats block (the hero SCALE row) is the CEO-priority moment —
  // longer duration + trigger the underline draw when the count-up starts.
  function findLeadHost(el) {
    var host = el;
    while (host && host !== document.body) {
      if (host.classList && host.classList.contains('cf-stat--lead')) return host;
      host = host.parentNode;
    }
    return null;
  }

  function primeAndObserveCount(el) {
    if (el.dataset.cfCounted === '1') return;
    var textContainer = el.querySelector('[data-cf-key], [data-stat]') || el;
    var finalText = textContainer.textContent;
    if (!finalText || !finalText.trim()) return; // empty: data not yet filled
    var parsed = parseStat(finalText);
    if (!parsed) return; // non-numeric (e.g. a date) — leave it alone
    el.dataset.cfCounted = '1';
    var lead = findLeadHost(el);
    if (REDUCE) {
      // Reduced motion: skip the animation, but still trigger the lead
      // underline reveal so the layout doesn't look half-finished.
      if (lead) lead.classList.add('cf-underline-in');
      return;
    }
    var dur = lead ? 1400 : 900;
    // Reset to "0" placeholder synchronously so no flash of final value.
    textContainer.textContent = (parsed.isInt ? '0' : '0.0') + parsed.suffix;
    onceVisible(el, 0.4, function () {
      if (lead) lead.classList.add('cf-underline-in');
      animateNum(textContainer, parsed, finalText, dur);
    });
  }

  function setupCountUpHardcoded() {
    // Pass 1: stat numbers hardcoded in the HTML (no binding attribute).
    var els = document.querySelectorAll('.cf-stat-num');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // If the stat has a bound child, defer to pass 2 so we see the
      // filled value.
      if (el.querySelector('[data-cf-key], [data-stat]')) continue;
      if (el.hasAttribute('data-cf-key') || el.hasAttribute('data-stat')) continue;
      primeAndObserveCount(el);
    }
  }

  function setupCountUpDataLoaded() {
    // Pass 2: stat numbers filled by caliper-data.js. Fires on data-ready
    // so the "0" placeholder replaces the final text in the same task.
    var els = document.querySelectorAll('.cf-stat-num');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.querySelector('[data-cf-key], [data-stat]')
          || el.hasAttribute('data-cf-key')
          || el.hasAttribute('data-stat')) {
        primeAndObserveCount(el);
      }
    }
  }

  // ============================================================
  // 4. LEAD-STAT UNDERLINE
  //    (triggered inside primeAndObserveCount when the count-up starts)
  // ============================================================

  // ============================================================
  // 5. DECISION-LEDGER STAGGER (live pulse is pure CSS)
  // ============================================================
  function setupLedger() {
    if (REDUCE) return;
    var ledgers = document.querySelectorAll('[data-ledger]');
    for (var i = 0; i < ledgers.length; i++) {
      var ledger = ledgers[i];
      if (ledger.dataset.cfStaggered === '1') continue;
      var cells = ledger.querySelectorAll('.cf-ledger-cell');
      if (!cells.length) continue;
      ledger.dataset.cfStaggered = '1';
      ledger.classList.add('cf-ledger-anim');
      for (var k = 0; k < cells.length; k++) {
        cells[k].style.transitionDelay = (k * 8) + 'ms';
      }
      (function (lg) {
        onceVisible(lg, 0.1, function () { lg.classList.add('cf-ledger-played'); });
      })(ledger);
    }
  }

  // ============================================================
  // 6. CATCH-RATE BAR FILL
  // ============================================================
  function setupBar() {
    if (REDUCE) return;
    var bars = document.querySelectorAll('[data-bar="catch"]');
    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i];
      if (bar.dataset.cfBar === '1') continue;
      var c = bar.querySelector('.cf-bar__caught');
      var m = bar.querySelector('.cf-bar__missed');
      if (!c || !m) continue;
      var cTarget = c.style.flex;
      var mTarget = m.style.flex;
      if (!cTarget && !mTarget) continue;
      bar.dataset.cfBar = '1';
      c.style.flex = '0';
      m.style.flex = '0';
      bar.classList.add('cf-bar-anim');
      void bar.offsetWidth; // force layout so the transition picks up 0->target
      (function (cEl, mEl, cVal, mVal, b) {
        onceVisible(b, 0.3, function () {
          cEl.style.flex = cVal;
          mEl.style.flex = mVal;
        });
      })(c, m, cTarget, mTarget, bar);
    }
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  function onReady() {
    setupReveal();
    setupHeadlineEntrance();
    setupCountUpHardcoded();
  }

  function onDataReady() {
    setupCountUpDataLoaded();
    setupLedger();
    setupBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
  document.addEventListener('caliper:data-ready', onDataReady);
})();
