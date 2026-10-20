(function () {
  'use strict';

  function put(key, html) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-work="' + key + '"]'), function (el) { el.innerHTML = html; });
  }

  siteData('outside_pr_list').then(function (t) {
    var prs = CFPrs.records(t);
    if (!prs.length) return;
    var field = null;
    function draw() {
      var shown = field ? prs.filter(function (p) { return p.field === field; }) : prs;
      put('tally', CFPrs.tally(shown));
      put('prs', CFPrs.table(shown));
    }
    put('fields', '<li><button type="button" data-field="" aria-pressed="true">All<b>' + prs.length + '</b></button></li>' + CFPrs.fields(prs, true));
    document.querySelector('[data-work="fields"]').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      field = b.dataset.field || null;
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      draw();
    });
    draw();
  });
})();
