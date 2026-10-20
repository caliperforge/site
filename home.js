(function () {
  'use strict';

  var DAY = 86400000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function all(key) { return Array.prototype.slice.call(document.querySelectorAll('[data-home="' + key + '"]')); }
  function fill(key, text) { if (text !== undefined && text !== null) all(key).forEach(function (el) { el.textContent = text; }); }
  function put(key, html) { all(key).forEach(function (el) { el.innerHTML = html; }); }
  function count(n) { return Number.isFinite(n) ? n.toLocaleString('en-US') : undefined; }
  function pct(x) { return Number.isFinite(x) ? Math.round(x * 100) + '%' : undefined; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function utc(iso) { return Date.parse(iso + 'T00:00:00Z'); }
  function short(iso) { var d = new Date(utc(iso)); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }

  function row(table, key) {
    if (!table) return null;
    var i = table.columns.indexOf(key[0]);
    var r = table.rows.find(function (x) { return x[i] === key[1]; });
    if (!r) return null;
    var o = {};
    table.columns.forEach(function (c, j) { o[c] = r[j]; });
    return o;
  }

  // Outside contributions
  siteData('outside_pr_list').then(function (t) {
    var prs = CFPrs.records(t);
    if (!prs.length) return;
    put('tally', CFPrs.tally(prs));
    put('fields', CFPrs.fields(prs));
    put('prs', CFPrs.table(prs, { collapseAfter: 4 }));
    fill('outside', count(prs.length));
    all('prs').forEach(CFPrs.wire);
  });

  siteData('org_stats').then(function (org) {
    if (!org || !org.launch_date) return;
    fill('days', count(Math.floor((Date.now() - utc(org.launch_date)) / DAY) + 1));
  });

  // Weekly chart: a week is partial when the data does not cover all seven of its days.
  function chart(loop, firstDay, lastDay, width) {
    var weeks = loop.rows.filter(function (r) { return /^\d{4}-/.test(r[0]); }).map(function (r) {
      var o = {};
      loop.columns.forEach(function (c, j) { o[c] = r[j]; });
      var start = Math.max(utc(o.period), utc(firstDay)), end = Math.min(utc(o.period) + 6 * DAY, utc(lastDay));
      o.days = Math.round((end - start) / DAY) + 1;
      return o;
    });
    if (!weeks.length) return '';
    var narrow = width < 560;
    var H = narrow ? 330 : 340, left = 52, right = width - 8, top = 52, bottom = H - (narrow ? 92 : 86);
    var max = Math.max.apply(null, weeks.map(function (w) { return w.landed; }));
    var step = [50, 100, 200, 500].find(function (s) { return max / s <= 5; }) || 1000;
    var ticks = [];
    for (var t = 0; t <= Math.ceil(max / step) * step; t += step) ticks.push(t);
    var y = function (v) { return bottom - (bottom - top) * v / ticks[ticks.length - 1]; };
    var slot = (right - left) / weeks.length;
    var s = '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="6" height="6" fill="var(--site-sheet)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--site-ink)" stroke-width="2"/></pattern></defs>' +
      '<text class="cf-title" x="0" y="16">Jobs finished each week</text>' +
      '<text class="cf-tick" x="0" y="34">' + (narrow ? 'Under each week: share passed first time' : 'Under each week: the share that passed every review first time') + '</text>';
    ticks.forEach(function (v) {
      s += '<line class="cf-grid" x1="' + left + '" x2="' + right + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="cf-tick" text-anchor="end" x="' + (left - 8) + '" y="' + (y(v) + 4) + '">' + count(v) + '</text>';
    });
    weeks.forEach(function (w, i) {
      var cx = left + slot * (i + 0.5), bw = Math.min(slot * 0.6, 64), partial = w.days < 7;
      s += '<rect class="cf-bar' + (partial ? ' cf-bar--partial' : '') + '" x="' + (cx - bw / 2) + '" y="' + y(w.landed) + '" width="' + bw + '" height="' + (bottom - y(w.landed)) + '"/>' +
        '<text class="cf-label" text-anchor="middle" x="' + cx + '" y="' + (y(w.landed) - 7) + '">' + count(w.landed) + '</text>' +
        '<text class="cf-cat" text-anchor="middle" x="' + cx + '" y="' + (bottom + 18) + '">' + short(w.period) + '</text>' +
        '<text class="cf-share" text-anchor="middle" x="' + cx + '" y="' + (bottom + 34) + '">' + pct(w.first_pass_share) + (narrow ? '' : ' first time') + '</text>' +
        (partial ? '<text class="cf-partial" text-anchor="middle" x="' + cx + '" y="' + (bottom + 50) + '">' + (narrow ? w.days + ' of 7 days' : 'partial: ' + w.days + ' of 7 days') + '</text>' : '');
    });
    s += '<text class="cf-axis" transform="translate(14,' + ((top + bottom) / 2) + ') rotate(-90)" text-anchor="middle">Jobs finished</text>' +
      '<text class="cf-axis" text-anchor="middle" x="' + ((left + right) / 2) + '" y="' + (H - 6) + '">Week starting Monday</text>';
    return '<svg viewBox="0 0 ' + width + ' ' + H + '" width="' + width + '" height="' + H + '" role="img" aria-label="Jobs finished each week">' + s + '</svg>';
  }

  // How a job travels, drawn as a loop: refusals return to the builder, repeated ones become rules.
  var STAGES = [
    ['Written task', 'what to change, and why', null],
    ['Built', 'by a specialist in the language', null],
    ['Automatic checks', 'run on every change', 'rails'],
    ['Code review', 'a separate agent', 'code review'],
    ['Senior review', 'a second reviewer', 'senior review'],
    ['Final proof', 'checked against the task', 'ready'],
    ['Shipped', 'merged here, or a pull request', null]
  ];

  function marker(id) {
    return '<marker id="' + id + '" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z"/></marker>';
  }

  function loopSvg(refused, fixFiled, fixLanded, narrow) {
    var defs = '<defs>' + marker('arrow-ink') + marker('arrow-rust') + '</defs>';
    var s = '';
    function role(cx, y, text, w, end) {
      if (text.length * 6.2 < w - 12) return '<text class="role' + end + '" x="' + cx + '" y="' + y + '">' + text + '</text>';
      var words = text.split(' '), cut = Math.ceil(words.length / 2);
      return '<text class="role' + end + '" x="' + cx + '" y="' + y + '">' + words.slice(0, cut).join(' ') +
        '<tspan x="' + cx + '" dy="14">' + words.slice(cut).join(' ') + '</tspan></text>';
    }
    function box(x, y, w, h, st, i) {
      var cls = i === STAGES.length - 1 ? 'box box--end' : st[2] ? 'box box--gate' : 'box';
      var end = i === STAGES.length - 1 ? ' end-text' : '';
      return '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2"/>' +
        '<text class="stage' + end + '" x="' + (x + w / 2) + '" y="' + (y + h / 2 - (narrow ? 3 : 8)) + '">' + st[0] + '</text>' +
        role(x + w / 2, y + h / 2 + 14, st[1], w, end);
    }
    var gates = STAGES.map(function (st, i) { return [i, st[2] && refused[st[2]]]; }).filter(function (g) { return g[1]; });
    var rule = 'Repeated refusals become fix tickets: ';
    if (!narrow) {
      var W = 1040, bw = 136, gap = 12.6, by = 10, bh = 84;
      var cx = function (i) { return i * (bw + gap) + bw / 2; };
      STAGES.forEach(function (st, i) {
        s += box(i * (bw + gap), by, bw, bh, st, i);
        if (i < STAGES.length - 1) s += '<path class="flow" marker-end="url(#arrow-ink)" d="M' + (i * (bw + gap) + bw + 2) + ' ' + (by + bh / 2) + 'H' + ((i + 1) * (bw + gap) - 3) + '"/>';
      });
      gates.forEach(function (g, k) {
        var ly = by + bh + 26 + k * 26, gx = cx(g[0]) + 20, bx = cx(1) + 36 - k * 22;
        s += '<path class="back" marker-end="url(#arrow-rust)" d="M' + gx + ' ' + (by + bh) + 'V' + ly + 'H' + bx + 'V' + (by + bh + 3) + '"/>' +
          '<text class="back-label" text-anchor="end" x="' + (gx - 8) + '" y="' + (ly - 5) + '">' + count(g[1]) + ' sent back</text>';
      });
      var ry = by + bh + 26 + gates.length * 26 + 18;
      s += '<rect class="rule" x="0" y="' + ry + '" width="' + W + '" height="46" rx="2"/>' +
        '<text class="rule-label" x="' + (W / 2) + '" y="' + (ry + 28) + '" text-anchor="middle">' + rule +
        '<tspan class="n">' + count(fixFiled) + '</tspan> filed, <tspan class="n">' + count(fixLanded) + '</tspan> landed as new rules and checks</text>' +
        '<path class="rule" marker-end="url(#arrow-rust)" d="M' + cx(0) + ' ' + ry + 'V' + (by + bh + 3) + '"/>';
      return '<svg viewBox="0 0 ' + W + ' ' + (ry + 48) + '" role="img" aria-label="How a job travels">' + defs + s + '</svg>';
    }
    var NW = 360, nbw = 236, nbh = 52, ngap = 24;
    STAGES.forEach(function (st, i) {
      var yy = i * (nbh + ngap);
      s += box(28, yy, nbw, nbh, st, i);
      if (i < STAGES.length - 1) s += '<path class="flow" marker-end="url(#arrow-ink)" d="M' + (28 + nbw / 2) + ' ' + (yy + nbh + 2) + 'V' + (yy + nbh + ngap - 3) + '"/>';
    });
    var buildY = (nbh + ngap) + nbh / 2;
    gates.forEach(function (g, k) {
      var gy = g[0] * (nbh + ngap) + nbh / 2, lx = 28 + nbw + 14 + k * 14;
      s += '<path class="back" marker-end="url(#arrow-rust)" d="M' + (28 + nbw) + ' ' + gy + 'H' + lx + 'V' + (buildY + 6 + k * 4) + 'H' + (28 + nbw + 3) + '"/>' +
        '<text class="back-label" text-anchor="end" x="' + (28 + nbw - 8) + '" y="' + (gy + nbh / 2 + 14) + '">' + count(g[1]) + ' sent back</text>';
    });
    var ry2 = STAGES.length * (nbh + ngap) + 6;
    s += '<rect class="rule" x="0" y="' + ry2 + '" width="' + NW + '" height="62" rx="2"/>' +
      '<text class="rule-label" x="' + (NW / 2) + '" y="' + (ry2 + 25) + '" text-anchor="middle">' + rule + '</text>' +
      '<text class="rule-label" x="' + (NW / 2) + '" y="' + (ry2 + 47) + '" text-anchor="middle"><tspan class="n">' + count(fixFiled) + '</tspan> filed, <tspan class="n">' + count(fixLanded) + '</tspan> landed as new rules</text>' +
      '<path class="rule" marker-end="url(#arrow-rust)" d="M10 ' + ry2 + 'V' + (nbh / 2) + 'H25"/>';
    return '<svg viewBox="0 0 ' + NW + ' ' + (ry2 + 64) + '" role="img" aria-label="How a job travels">' + defs + s + '</svg>';
  }

  Promise.all([siteData('loop_counts'), siteData('daily_activity'), siteData('pipeline_counts')]).then(function (d) {
    var loop = d[0], daily = d[1], pipe = d[2];
    var total = row(loop, ['period', 'all']), week = row(loop, ['period', 'last_7_days']);
    if (total) {
      fill('jobs', count(total.landed));
      fill('per_job', Number.isFinite(total.refusals_per_landed) ? total.refusals_per_landed.toFixed(2) : undefined);
      fill('first_pass', pct(total.first_pass_share));
    }
    if (week) fill('first_pass_week', pct(week.first_pass_share));
    var narrow = matchMedia('(max-width: 640px)');
    function draw() {
      if (loop && daily && daily.rows.length) {
        all('chart').forEach(function (el) {
          el.innerHTML = chart(loop, daily.rows[0][0], daily.rows[daily.rows.length - 1][0], Math.max(300, el.clientWidth));
        });
        fill('data_start', short(daily.rows[0][0]));
      }
      if (pipe && total) {
        var refused = {}, si = pipe.columns.indexOf('stage'), ri = pipe.columns.indexOf('refused');
        pipe.rows.forEach(function (r) { refused[r[si]] = r[ri]; });
        put('loop', loopSvg(refused, total.fix_tickets, total.fix_tickets_landed, narrow.matches));
      }
    }
    draw();
    narrow.addEventListener('change', draw);
    var t;
    addEventListener('resize', function () { clearTimeout(t); t = setTimeout(draw, 150); });
  });

  // The three newest log entries, read from the log page itself so the publisher stays the only writer.
  fetch('/blog/index.html', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
    if (!html) return;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var cards = Array.prototype.slice.call(doc.querySelectorAll('article.cf-blog-card'), 0, 3);
    if (!cards.length) return;
    put('latest', cards.map(function (c) {
      var a = c.querySelector('h2 a'), date = c.querySelector('.dateline'), sum = c.querySelector('p.summary');
      var href = a.getAttribute('href');
      if (!/^\//.test(href)) href = '/blog/' + href;
      return '<article><p class="dateline">' + esc(date ? date.textContent : '') + '</p><h3><a href="' + esc(href) + '">' + esc(a.textContent) + '</a></h3>' +
        (sum && sum.textContent ? '<p>' + esc(sum.textContent) + '</p>' : '') + '</article>';
    }).join(''));
  }).catch(function () {});
})();
