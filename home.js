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
    var tokens = sum(t, 'total_tokens');
    if (Number.isFinite(tokens)) fill('tokens', Math.round(tokens / 1e6).toLocaleString('en-US') + 'M');
    if (t.rows.length) fill('first_day', t.rows[0][t.columns.indexOf('day')]);
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

  siteData('pipeline_counts').then(function (t) {
    if (!t) return;
    var stage = t.columns.indexOf('stage');
    var n = t.columns.indexOf('count');
    var refused = t.columns.indexOf('refused');
    var unit = t.columns.indexOf('unit');
    var rows = t.rows.filter(function (r) { return !/ceo/i.test(r[stage]); });
    var narrow = matchMedia('(max-width: 640px)');
    function draw() {
      var v = narrow.matches;
      var span = rows.length * 132 - 20;
      var boxes = rows.map(function (r, i) {
        var x = v ? 0 : i * 132;
        var y = v ? i * 132 : 0;
        var gated = r[refused] !== null;
        return '<rect' + (gated ? ' class="refused"' : '') + ' x="' + x + '" y="' + y + '" width="112" height="110"/>' +
          label(x, y + 24, 'stage', r[stage].toUpperCase()) +
          label(x, y + 58, 'count', count(r[n])) +
          label(x, y + 77, '', r[unit]) +
          (gated ? label(x, y + 96, 'refused', count(r[refused]) + ' refused') : '') +
          (i < rows.length - 1 ? '<path d="' + (v ? 'M56 ' + (y + 112) + 'V' + (y + 131) : 'M' + (x + 114) + ' 55H' + (x + 131)) + '" marker-end="url(#home-arrow)"/>' : '');
      });
      var html = '<svg viewBox="0 0 ' + (v ? '112 ' + span : span + ' 110') + '" role="img" aria-label="How a job travels">' +
        '<defs><marker id="home-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z"/></marker></defs>' +
        boxes.join('') + '</svg><figcaption>' + t.caveat + '</figcaption>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-home="pipeline"]'), function (el) {
        el.innerHTML = html;
      });
    }
    draw();
    narrow.addEventListener('change', draw);
  });
})();
