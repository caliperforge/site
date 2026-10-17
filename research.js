(function () {
  'use strict';

  var CHARTS = {
    gate_verdicts: { kind: 'bar', label: ['gate', 'outcome'], value: 'count', labelTitle: 'Gate and outcome', valueTitle: 'Verdicts' },
    plan_outcomes: { kind: 'bar', label: ['template', 'state'], value: 'count', labelTitle: 'Template and state', valueTitle: 'Plans' },
    daily_activity: { kind: 'column', label: ['day'], value: 'total_tokens', labelTitle: 'Day (UTC)', valueTitle: 'Tokens' },
    runs_by_seat: { kind: 'bar', label: ['seat'], value: 'runs', labelTitle: 'Seat', valueTitle: 'Runs' },
    token_mix: { kind: 'bar', label: ['type'], value: 'tokens', labelTitle: 'Token type', valueTitle: 'Tokens' },
    tokens_per_landed_job: { kind: 'column', label: ['week'], value: 'mean_total_tokens', labelTitle: 'Week queued (Monday)', valueTitle: 'Tokens per landed job', compare: true },
    ceo_touches: { kind: 'column', label: ['day'], value: 'touches', labelTitle: 'Day (UTC)', valueTitle: 'CEO actions' },
    timeline: { kind: 'list' }
  };

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    n.textContent = text;
    return n;
  }

  function para(cls, text) {
    return node('p', cls, text);
  }

  function col(json, name) {
    var i = json.columns.indexOf(name);
    if (i < 0) throw new Error(json.metric + ': no column ' + name);
    return i;
  }

  function list(json) {
    var d = col(json, 'date'), v = col(json, 'version'), e = col(json, 'event'), n = col(json, 'note');
    var ol = node('ol', 'cf-timeline', '');
    json.rows.forEach(function (r) {
      var li = document.createElement('li'), ev = node('span', 'cf-event', '');
      ev.append(node('b', '', r[v]), node('span', '', r[e]));
      if (r[n]) ev.append(node('span', 'cf-flag', r[n]));
      li.append(node('time', '', r[d]), ev);
      ol.append(li);
    });
    return ol;
  }

  function compare(json, opts) {
    var w = col(json, opts.label[0]), v = col(json, opts.value);
    var a = json.rows[0], b = json.rows[json.rows.length - 1], change = b[v] / a[v] - 1;
    return 'First week (' + a[w] + '): ' + CFChart.format(a[v]) + ' tokens per landed job. Current week (' + b[w] + '): '
      + CFChart.format(b[v]) + '. ' + (change < 0 ? '−' : '+') + Math.round(Math.abs(change) * 100) + '%';
  }

  function draw(p) {
    var cs = getComputedStyle(p.section);
    var width = p.section.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (width <= 0 || width === p.width) return;
    p.width = width;
    var opts = CHARTS[p.key];
    if (opts.kind === 'list') {
      p.section.textContent = '';
      p.section.append(node('h4', '', p.json.title), list(p.json));
    } else {
      p.section.innerHTML = CFChart.render(p.json, Object.assign({ width: width }, opts));
      if (opts.compare) p.section.append(para('cf-compare', compare(p.json, opts)));
    }
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
