(function () {
  'use strict';

  var CHARTS = {
    gate_verdicts: { kind: 'bar', label: ['gate', 'outcome'], value: 'count', labelTitle: 'Gate and outcome', valueTitle: 'Verdicts' },
    plan_outcomes: { kind: 'bar', label: ['template', 'state'], value: 'count', labelTitle: 'Template and state', valueTitle: 'Plans' },
    daily_activity: { kind: 'column', label: ['day'], value: 'total_tokens', labelTitle: 'Day (UTC)', valueTitle: 'Tokens' },
    runs_by_seat: { kind: 'bar', label: ['seat'], value: 'runs', labelTitle: 'Seat', valueTitle: 'Runs' },
    token_mix: { kind: 'bar', label: ['type'], value: 'tokens', labelTitle: 'Token type', valueTitle: 'Tokens' },
    tokens_per_landed_job: { kind: 'column', label: ['week'], value: 'mean_total_tokens', labelTitle: 'Week queued (Monday)', valueTitle: 'Tokens per landed job' }
  };

  function para(cls, text) {
    var p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  }

  function draw(p) {
    var cs = getComputedStyle(p.section);
    var width = p.section.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (width <= 0 || width === p.width) return;
    p.width = width;
    p.section.innerHTML = CFChart.render(p.json, Object.assign({ width: width }, CHARTS[p.key]));
    p.section.append(para('cf-def', p.json.definition), para('cf-caveat', p.json.caveat));
  }

  document.querySelectorAll('section.cf-panel[data-metric]').forEach(function (section) {
    var key = section.dataset.metric;
    fetch('/data/' + key + '.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (json) {
      var p = { section: section, key: key, json: json };
      new ResizeObserver(function () { draw(p); }).observe(section);
    }).catch(function () {
      section.textContent = 'Could not load data/' + key + '.json';
    });
  });
})();
