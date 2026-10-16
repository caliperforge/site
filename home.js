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
})();
