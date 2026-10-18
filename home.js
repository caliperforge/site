(function () {
  function fill(key, text) {
    if (!text) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-home="' + key + '"]'), function (el) {
      el.textContent = text;
    });
  }

  function count(n) {
    return Number.isFinite(n) ? n.toLocaleString('en-US') : undefined;
  }

  function sum(table, column) {
    var i = table.columns.indexOf(column);
    return table.rows.reduce(function (total, row) { return total + row[i]; }, 0);
  }

  siteData('daily_activity').then(function (t) {
    if (!t) return;
    fill('runs', count(sum(t, 'runs')));
    if (!t.rows.length) return;
    var day = t.columns.indexOf('day');
    fill('first_day', t.rows[0][day]);
    if (!Number.isFinite(sum(t, 'total_tokens'))) return;
    var tokens = t.columns.indexOf('total_tokens');
    var since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    var recent = 0;
    var weeks = [];
    t.rows.forEach(function (r) {
      var d = new Date(r[day] + 'T00:00:00Z');
      var monday = new Date(d - (d.getUTCDay() + 6) % 7 * 86400000).toISOString().slice(0, 10);
      var last = weeks[weeks.length - 1];
      if (last && last[0] === monday) last[1] += r[tokens];
      else weeks.push([monday, r[tokens]]);
      if (r[day] >= since) recent += r[tokens];
    });
    fill('tokens', CFChart.format(recent));
    put('tokens_chart', CFChart.render({ metric: 'daily_activity', title: 'Tokens by week', columns: ['week', 'total_tokens'], rows: weeks },
      { kind: 'column', label: ['week'], value: 'total_tokens', labelTitle: 'Week starting Monday', valueTitle: 'Tokens', width: 300 }));
  });

  siteData('plan_outcomes').then(function (t) {
    if (!t) return;
    var template = t.columns.indexOf('template');
    var state = t.columns.indexOf('state');
    var row = t.rows.find(function (r) { return r[template] === 'pr_path' && r[state] === 'done'; });
    if (row) fill('plans', count(row[t.columns.indexOf('count')]));
  });

  siteData('org_stats').then(function (org) {
    if (!org || !org.launch_date) return;
    fill('days', count(Math.floor((Date.now() - Date.parse(org.launch_date)) / 86400000) + 1));
  });

  function label(x, y, cls, text) {
    return '<text' + (cls ? ' class="' + cls + '"' : '') + ' x="' + (x + 56) + '" y="' + y + '">' + text + '</text>';
  }

  function arrow(d) {
    return '<path d="' + d + '" marker-end="url(#home-arrow)"/>';
  }

  function put(key, html) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-home="' + key + '"]'), function (el) {
      el.innerHTML = html;
    });
  }

  function chart(loop, column, title, valueTitle, scale) {
    var week = loop.columns.indexOf('week');
    var i = loop.columns.indexOf(column);
    if (week < 0 || i < 0) return '<p>—</p>';
    var rows = loop.rows.map(function (r) { return [r[week], scale(r[i])]; });
    return CFChart.render({ metric: column, title: title, columns: ['week', column], rows: rows },
      { kind: 'column', label: ['week'], value: column, labelTitle: 'ISO week', valueTitle: valueTitle, width: 360 });
  }

  Promise.all([siteData('pipeline_counts'), siteData('loop_counts')]).then(function (data) {
    var t = data[0];
    var loop = data[1];
    if (loop) {
      put('loop_chart',
        chart(loop, 'refusals_per_landed', 'Refusals per landed job, by week', 'Refusals per landed job', function (x) { return Math.round(x * 10) / 10; }) +
        chart(loop, 'first_pass_share', 'First-pass share, by week', 'First-pass share (%)', function (x) { return Math.round(x * 100); }));
    }
    if (!t) return;
    var stage = t.columns.indexOf('stage');
    var n = t.columns.indexOf('count');
    var refused = t.columns.indexOf('refused');
    var unit = t.columns.indexOf('unit');
    var rows = t.rows.filter(function (r) { return !/ceo/i.test(r[stage]); });
    var gates = rows.map(function (r, i) { return [i * 132 + 56, r[refused]]; }).filter(function (g) { return g[1] !== null; });
    function mid(name) {
      return rows.findIndex(function (r) { return r[stage] === name; }) * 132 + 56;
    }
    var brief = mid('brief');
    var build = mid('build');
    var all = loop && loop.totals && loop.totals.all_time || {};
    var totals = [['fix_tickets_filed', 'fix tickets filed'], ['fix_tickets_landed', 'fix tickets landed'], ['language_notes', 'language notes']];
    var narrow = matchMedia('(max-width: 640px)');
    function draw() {
      var v = narrow.matches;
      var span = rows.length * 132 - 20;
      var w = v ? 376 + 12 * gates.length : span;
      var fix = v ? span + 30 : 140 + 24 * gates.length;
      var boxes = rows.map(function (r, i) {
        var x = v ? 24 : i * 132;
        var y = v ? i * 132 : 0;
        var gated = r[refused] !== null;
        var words = r[stage].toUpperCase().split(' ');
        var drop = v ? 18 * (words.length - 1) : 0;
        return '<rect' + (gated ? ' class="refused"' : '') + ' x="' + x + '" y="' + y + '" width="112" height="110"/>' +
          label(x, y + 24, 'stage', v ? words.map(function (word, j) { return j ? '<tspan x="' + (x + 56) + '" dy="18">' + word + '</tspan>' : word; }).join('') : words.join(' ')) +
          label(x, y + 58 + drop, 'count', count(r[n])) +
          label(x, y + 77 + drop, '', r[unit]) +
          (i < rows.length - 1 ? arrow(v ? 'M80 ' + (y + 112) + 'V' + (y + 131) : 'M' + (x + 114) + ' 55H' + (x + 131)) : '');
      });
      var back = gates.map(function (g, k) {
        var p = v ? 376 + 12 * k : 140 + 24 * k;
        return arrow(v ? 'M137 ' + g[0] + 'H' + p + 'V' + build + 'H137' : 'M' + g[0] + ' 112V' + p + 'H' + build + 'V111') +
          arrow('M' + (v ? p + ' ' + g[0] : g[0] + ' ' + p) + 'V' + (fix - 1)) +
          '<text class="back" x="' + (v ? 368 : build - 8) + '" y="' + (v ? g[0] - 6 : p + 4) + '">' + count(g[1]) + ' sent back with a reason</text>';
      });
      var outer = '<rect x="0" y="' + fix + '" width="' + w + '" height="96"/>' +
        label(w / 2 - 56, fix + 22, 'stage', 'THE MACHINE FIXES ITSELF') +
        totals.map(function (f, i) {
          var x = Math.round(w * (2 * i + 1) / 6) - 56;
          return label(x, fix + 56, 'count', count(all[f[0]]) || '—') + label(x, fix + 76, '', f[1]);
        }).join('') +
        arrow(v ? 'M8 ' + fix + 'V' + brief + 'H23' : 'M' + (brief - 44) + ' ' + fix + 'V111') +
        arrow(v ? 'M8 ' + fix + 'V' + build + 'H23' : 'M' + build + ' ' + fix + 'V111');
      put('pipeline', '<svg viewBox="0 0 ' + w + ' ' + (fix + 96) + '" role="img" aria-label="How a job travels">' +
        '<defs><marker id="home-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z"/></marker></defs>' +
        boxes.join('') + back.join('') + outer + '</svg><figcaption>' + t.caveat + '</figcaption>');
    }
    draw();
    narrow.addEventListener('change', draw);
  });
})();
