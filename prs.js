var CFPrs = (function () {
  'use strict';

  var STATES = ['merged', 'approved', 'open', 'closed'];
  var LABEL = { merged: 'merged', approved: 'approved', open: 'open', closed: 'closed without merging' };
  var FIELDS = ['payments', 'developer tools', 'astronomy', 'genomics'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }

  function day(iso) {
    var p = iso.split('-');
    return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0];
  }

  // Conventional-commit prefixes ("fix(mpp): ") mean nothing to a reader outside the repo.
  function plain(title) {
    var t = title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function icon(field) {
    return '<svg class="field-icon" aria-hidden="true"><use href="#f-' + field.replace(' ', '-') + '"/></svg>';
  }

  function records(table) {
    if (!table || !table.rows) return [];
    var c = {};
    table.columns.forEach(function (name, i) { c[name] = i; });
    return table.rows.map(function (r) {
      return { repo: r[c.repo], number: r[c.number], title: r[c.title], url: r[c.url], state: r[c.state],
        opened: r[c.opened], merged: r[c.merged], field: r[c.field], about: r[c.repo_description] };
    });
  }

  function groups(prs) {
    var by = {};
    prs.forEach(function (p) { (by[p.repo] = by[p.repo] || []).push(p); });
    return Object.keys(by).map(function (repo) {
      var list = by[repo].sort(function (a, b) { return b.opened < a.opened ? -1 : b.opened > a.opened ? 1 : b.number - a.number; });
      return { repo: repo, field: list[0].field, about: list[0].about, prs: list };
    }).sort(function (a, b) { return a.prs[0].opened < b.prs[0].opened ? 1 : -1; });
  }

  function count(list, key, value) {
    return list.filter(function (p) { return p[key] === value; }).length;
  }

  function tally(prs) {
    var cells = '<div><b>' + prs.length + '</b><span>pull requests to ' + groups(prs).length + ' projects</span></div>';
    STATES.forEach(function (s) {
      cells += '<div><b>' + count(prs, 'state', s) + '</b><span><i class="dot--' + s + '"></i>' + LABEL[s] + '</span></div>';
    });
    return cells;
  }

  function fields(prs, asButtons) {
    return FIELDS.filter(function (f) { return count(prs, 'field', f); }).map(function (f) {
      var inner = icon(f) + '<span>' + f.charAt(0).toUpperCase() + f.slice(1) + '</span><b>' + count(prs, 'field', f) + '</b>';
      return asButtons ? '<li><button type="button" data-field="' + f + '" aria-pressed="false">' + inner + '</button></li>' : '<li>' + inner + '</li>';
    }).join('');
  }

  function row(p, hidden) {
    var when = p.state === 'merged' && p.merged ? 'merged ' + day(p.merged) : day(p.opened);
    return '<tr class="pr"' + (hidden ? ' hidden' : '') + '>' +
      '<td class="what"><a href="' + esc(p.url) + '">' + esc(plain(p.title)) + '<span>#' + p.number + '</span></a></td>' +
      '<td class="state"><span class="pill pill--' + p.state + '">' + LABEL[p.state] + '</span></td>' +
      '<td class="when">' + when + '</td></tr>';
  }

  function table(prs, opts) {
    var keep = opts && opts.collapseAfter || Infinity;
    var body = groups(prs).map(function (g, gi) {
      var name = g.repo.split('/')[1];
      var states = STATES.filter(function (s) { return count(g.prs, 'state', s); })
        .map(function (s) { return count(g.prs, 'state', s) + ' ' + s; }).join(' · ');
      var head = '<tr class="group"><th colspan="3" scope="rowgroup"><span class="group-head">' +
        '<a href="https://github.com/' + esc(g.repo) + '">' + esc(g.repo) + '</a>' +
        '<span class="group-field">' + icon(g.field) + esc(g.field) + '</span></span>' +
        '<span class="group-desc">' + esc(g.about) + (states ? ' · ' + states : '') + '</span></th></tr>';
      var rows = g.prs.map(function (p, i) { return row(p, i >= keep); }).join('');
      var more = g.prs.length > keep
        ? '<tr class="more"><td colspan="3"><button type="button" data-group="' + gi + '">Show ' + (g.prs.length - keep) + ' more from ' + esc(name) + '</button></td></tr>'
        : '';
      return '<tbody data-field="' + g.field + '">' + head + rows + more + '</tbody>';
    }).join('');
    return '<table class="prs"><thead><tr><th scope="col">What it does</th><th scope="col">Status</th><th scope="col">Date</th></tr></thead>' + body + '</table>';
  }

  function wire(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.more button');
      if (!b) return;
      var tbody = b.closest('tbody');
      Array.prototype.forEach.call(tbody.querySelectorAll('tr.pr[hidden]'), function (tr) { tr.hidden = false; });
      b.closest('tr').remove();
    });
  }

  return { records: records, groups: groups, tally: tally, fields: fields, table: table, wire: wire, plain: plain, day: day };
})();
