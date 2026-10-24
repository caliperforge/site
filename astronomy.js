(function () {
  var services = [['CADC', 'CADC'], ['IRSA', 'IRSA'], ['ARI', 'ARI Heidelberg'], ['MAST', 'MAST']];
  var states = { pass: 'merged', fail: 'open', 'not supported': 'closed' };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }

  function rows(t) {
    return t.rows.map(function (r) {
      var o = {};
      t.columns.forEach(function (c, i) { o[c] = r[i]; });
      return o;
    });
  }

  function unique(list) {
    return list.filter(function (x, i) { return list.indexOf(x) === i; });
  }

  function pill(r) {
    if (!r) return '—';
    var span = '<span class="pill pill--' + states[r.outcome] + '"' + (r.note ? ' title="' + esc(r.note) + '"' : '') + '>' + esc(r.outcome) + '</span>';
    return r.note ? '<details><summary>' + span + '</summary><p>' + esc(r.note) + '</p></details>' : span;
  }

  function strip(cells, today) {
    var end = Date.parse(today + 'T00:00:00Z');
    var rects = [];
    for (var i = 0; i < 30; i++) {
      var day = new Date(end - (29 - i) * 864e5).toISOString().slice(0, 10);
      var r = cells.find(function (c) { return c.day === day; });
      rects.push('<rect x="' + i * 4 + '" width="3" height="12" style="fill:var(--site-' + (r ? states[r.outcome] : 'rule') + ')"><title>' +
        day + ': ' + (r ? esc(r.outcome) : 'no run') + '</title></rect>');
    }
    return '<svg class="strip" role="img" aria-label="Last 30 days" viewBox="0 0 120 12">' + rects.join('') + '</svg>';
  }

  siteData('vo_conformance').then(function (t) {
    var el = document.querySelector('[data-astronomy="matrix"]');
    if (!t) {
      el.innerHTML = 'Could not load the vo_conformance results';
      return;
    }
    var all = rows(t);
    var today = all.map(function (r) { return r.day; }).sort().pop();
    var when = new Date(t.run_at).toLocaleString('en-GB', {
      timeZone: 'America/Guatemala', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    el.innerHTML = '<p class="def">Last run ' + when + ' Guatemala time · <a href="' + esc(t.source) + '">Raw results</a></p>' +
      unique(all.map(function (r) { return r.behaviour; })).map(function (b) {
        var mine = all.filter(function (r) { return r.behaviour === b; });
        var name = b.replace(/_/g, ' ');
        return '<section class="panel"><h2>' + esc(name.charAt(0).toUpperCase() + name.slice(1)) + '</h2>' +
          (t.behaviours[b] ? '<p class="def">' + esc(t.behaviours[b]) + '</p>' : '') +
          '<div class="table-scroll"><table class="data"><thead><tr><th>Client</th>' +
          services.map(function (s) { return '<th>' + s[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
          unique(mine.map(function (r) { return r.client; })).map(function (c) {
            return '<tr><td>' + esc(c) + '</td>' + services.map(function (s) {
              var cells = mine.filter(function (r) { return r.client === c && r.service === s[0]; });
              return '<td>' + pill(cells.find(function (r) { return r.day === today; })) + strip(cells, today) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div></section>';
      }).join('');
  });
})();
