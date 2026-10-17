(function () {
  function put(key, html) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-output="' + key + '"]'), function (el) {
      el.innerHTML = html;
    });
  }

  var states = [
    ['merged', 'r="12"', 'merged upstream'],
    ['approved', 'r="8" stroke-width="8"', 'open, approved by a maintainer'],
    ['open', 'r="11" stroke-width="2"', 'open, not yet approved'],
    ['closed', 'r="12"', 'closed']
  ];

  function dot(s, x, y) {
    return '<circle class="' + s[0] + '" cx="' + x + '" cy="' + y + '" ' + s[1] + '/>';
  }

  siteData('outside_prs').then(function (t) {
    if (!t) return;
    var state = t.columns.indexOf('state');
    var cls = t.columns.indexOf('class');
    function tally(rows, name) {
      return rows.filter(function (r) { return r[state] === name; }).length;
    }
    var narrow = matchMedia('(max-width: 640px)');
    function draw() {
      var per = narrow.matches ? 10 : 20;
      var top = Math.ceil(t.rows.length / per) * 30 + 10;
      var dots = t.rows.map(function (r, i) {
        return dot(states.find(function (s) { return s[0] === r[state]; }), i % per * 30 + 15, Math.floor(i / per) * 30 + 15);
      });
      var legend = states.map(function (s, k) {
        var y = top + k * 30 + 15;
        return dot(s, 15, y) + '<text x="36" y="' + (y + 4) + '">' + tally(t.rows, s[0]) + ' ' + s[2] + '</text>';
      });
      put('grid', '<svg viewBox="0 0 ' + per * 30 + ' ' + (top + 120) + '" role="img" aria-label="' + t.rows.length + ' pull requests by state">' +
        dots.join('') + legend.join('') + '</svg><figcaption>' + t.caveat + '</figcaption>');
    }
    draw();
    narrow.addEventListener('change', draw);
    var classes = t.rows.map(function (r) { return r[cls]; }).filter(function (c, i, all) { return all.indexOf(c) === i; });
    put('classes', '<ul>' + classes.map(function (c) {
      var rows = t.rows.filter(function (r) { return r[cls] === c; });
      return '<li>' + c + ': ' + tally(rows, 'merged') + ' merged, ' + tally(rows, 'approved') + ' approved</li>';
    }).join('') + '</ul>');
  });

  siteData('plan_outcomes').then(function (t) {
    if (!t) return;
    var template = t.columns.indexOf('template');
    var state = t.columns.indexOf('state');
    var n = t.columns.indexOf('count');
    put('shipped', '<ul>' + t.rows.filter(function (r) { return r[state] === 'done'; }).map(function (r) {
      return '<li>' + r[n].toLocaleString('en-US') + ' ' + r[template] + ' plans done</li>';
    }).join('') + '</ul>');
  });
})();
