(function () {
  'use strict';

  function day(n) { return n.slice(0, 4) + '-' + n.slice(4, 6) + '-' + n.slice(6); }
  function dates(w) { return day(w.first_night) + ' to ' + day(w.last_night); }

  siteData('rubin_names').then(function (t) {
    var mount = document.querySelector('[data-rubin-chart]');
    if (!t) {
      mount.innerHTML = 'Could not load the rubin_names data';
      return;
    }
    var v = {};
    Object.keys(t.totals).forEach(function (k) { v[k] = t.totals[k].value; });
    v.ratio = '1 in ' + Math.round(v.first_detections / v.named_objects).toLocaleString('en-US');
    v.share = (v.named_objects / v.first_detections * 100).toFixed(3) + '%';
    v.gap = v.in_tns_alerts - v.in_tns_tag_rows;
    v.run_date = t.run_at.slice(0, 10);
    v.asked_dates = dates(t.totals.asked_window);
    v.counted_dates = dates(t.totals.nights_with_data);
    v.gap_night = t.rows.find(function (r) { return r[t.columns.indexOf('in_tns_tag_utc')] === 0; })[t.columns.indexOf('night')];
    document.querySelectorAll('[data-rubin]').forEach(function (el) {
      var k = el.getAttribute('data-rubin');
      if (!(k in v)) throw new Error('rubin_names: no figure ' + k);
      el.textContent = typeof v[k] === 'number' ? v[k].toLocaleString('en-US') : v[k];
    });
    mount.innerHTML = CFChart.render(t, { kind: 'column', label: ['night'], value: 'in_tns_stats',
      labelTitle: 'Night', valueTitle: 'TNS-flagged alerts', width: mount.clientWidth });
  });
})();
