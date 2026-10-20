(function () {
  'use strict';

  var GATES = { pre_review: 'Automatic checks', review: 'Code review', senior_review: 'Senior review', blind_review: 'Blind review', ready: 'Final proof' };
  var OUTCOMES = [['pass', 'Passed'], ['refuse', 'Sent back'], ['needs_ceo', 'Passed to the CEO']];
  var MIX = { cache_read: 'Re-read from cache', input: 'New input', cache_write: 'Written to cache', output: 'Written by agents' };
  var SEATS = { brief_writer: 'Brief writer', senior_review: 'Senior reviewer', code_quality: 'Code reviewer', text_review: 'Text reviewer',
    blind_review: 'Blind reviewer', coo_lite: 'Operations lead', fizz_generator: 'Fuzz test writer', web_specialist: 'Web builder',
    outside_specialist: 'Outside-project builder', design: 'Designer' };
  var VERSION = { v1: 'First version', v2: 'Current version' };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function count(n) { return Number.isFinite(n) ? n.toLocaleString('en-US') : '—'; }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function seat(s) {
    if (SEATS[s]) return SEATS[s];
    var m = /^(\w+)_specialist$/.exec(s);
    if (m) return { typescript: 'TypeScript', php: 'PHP' }[m[1]] ? { typescript: 'TypeScript', php: 'PHP' }[m[1]] + ' builder' : m[1].charAt(0).toUpperCase() + m[1].slice(1) + ' builder';
    s = s.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function rows(t) {
    return t.rows.map(function (r) { var o = {}; t.columns.forEach(function (c, i) { o[c] = r[i]; }); return o; });
  }
  function plot(key) { return document.querySelector('[data-panel="' + key + '"] .plot'); }
  function width(el) { return el.clientWidth; }

  function loopWeeks(loop, value, sub) {
    return rows(loop).filter(function (o) { return /^\d{4}-/.test(o.period); }).map(function (o) {
      return { week: o.period, value: value(o), sub: sub ? sub(o) : undefined };
    });
  }

  function table(head, body) {
    return '<div class="table-scroll"><table class="data"><thead><tr>' + head.map(function (h, i) { return '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body.map(function (r) {
        return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + (i ? count(c) : esc(c)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  var draws = [];
  function on(fn) { draws.push(fn); fn(); }

  Promise.all(['loop_counts', 'daily_activity', 'gate_verdicts', 'tokens_per_landed_job', 'token_mix', 'runs_by_seat', 'ceo_touches', 'timeline']
    .map(function (n) { return siteData(n); })).then(function (d) {
    var loop = d[0], daily = d[1], gates = d[2], perJob = d[3], mix = d[4], seats = d[5], ceo = d[6], timeline = d[7];
    var first = daily && daily.rows.length ? daily.rows[0][0] : null;
    var last = daily && daily.rows.length ? daily.rows[daily.rows.length - 1][0] : null;

    if (loop && first) {
      on(function () {
        plot('jobs').innerHTML = CFChart.weekly(loopWeeks(loop, function (o) { return o.landed; }, function (o) { return pct(o.first_pass_share) + ' first time'; }),
          { title: 'Jobs finished each week', yTitle: 'Jobs finished', firstDay: first, lastDay: last, width: width(plot('jobs')), fmt: count });
        plot('sentback').innerHTML = CFChart.weekly(loopWeeks(loop, function (o) { return Math.round(o.refusals_per_landed * 100) / 100; }),
          { title: 'Times sent back per finished job', yTitle: 'Times sent back per job', firstDay: first, lastDay: last, width: width(plot('sentback')),
            fmt: function (v) { return v.toFixed(v % 1 ? 2 : 0); } });
      });
    }

    if (gates) {
      var by = {};
      rows(gates).forEach(function (o) { (by[o.gate] = by[o.gate] || {})[o.outcome] = o.count; });
      plot('reviews').innerHTML = table(['Review'].concat(OUTCOMES.map(function (o) { return o[1]; })),
        Object.keys(GATES).filter(function (g) { return by[g]; }).map(function (g) {
          return [GATES[g]].concat(OUTCOMES.map(function (o) { return by[g][o[0]] || 0; }));
        }));
    }

    if (daily && first) {
      on(function () {
        plot('tokens').innerHTML = CFChart.weekly(CFChart.byWeek(daily, 'total_tokens'),
          { title: 'Tokens used each week', yTitle: 'Tokens', firstDay: first, lastDay: last, width: width(plot('tokens')) });
      });
    }

    if (perJob && first) {
      on(function () {
        plot('perjob').innerHTML = CFChart.weekly(rows(perJob).map(function (o) { return { week: o.week, value: o.mean_total_tokens, sub: o.jobs + ' jobs' }; }),
          { title: 'Tokens per finished job', note: 'Under each week: jobs queued that week and finished', yTitle: 'Tokens per job',
            firstDay: first, lastDay: last, width: width(plot('perjob')) });
      });
    }

    function bars(key, metric, data, labelTitle, valueTitle) {
      on(function () {
        plot(key).innerHTML = CFChart.render({ metric: metric, title: '', columns: ['name', 'value'], rows: data },
          { kind: 'bar', label: ['name'], value: 'value', labelTitle: labelTitle, valueTitle: valueTitle, width: width(plot(key)) });
      });
    }
    if (mix) bars('mix', 'token_mix', rows(mix).sort(function (a, b) { return b.tokens - a.tokens; }).map(function (o) { return [MIX[o.type] || o.type, o.tokens]; }), 'Kind of token', 'Tokens');
    if (seats) bars('seats', 'runs_by_seat', rows(seats).map(function (o) { return [seat(o.seat), o.runs]; }), 'Role', 'Runs');

    if (ceo && ceo.rows.length) {
      var cFirst = ceo.rows[0][0], cLast = ceo.rows[ceo.rows.length - 1][0];
      on(function () {
        plot('ceo').innerHTML = CFChart.weekly(CFChart.byWeek(ceo, 'touches'),
          { title: 'Times the CEO stepped in, each week', yTitle: 'CEO actions', firstDay: cFirst, lastDay: cLast, width: width(plot('ceo')), fmt: count });
      });
    }

    if (timeline) {
      plot('timeline').innerHTML = '<ol class="timeline">' + rows(timeline).map(function (o) {
        return '<li><time>' + CFChart.short(o.date) + ' ' + o.date.slice(0, 4) + '</time><span><b>' + esc(VERSION[o.version] || o.version) + '</b> ' + esc(o.event) +
          (o.note ? ' <em>' + esc(o.note === 'earlier measurement' ? 'measured under the first version' : o.note) + '</em>' : '') + '</span></li>';
      }).join('') + '</ol>';
    }

    var t;
    addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { draws.forEach(function (f) { f(); }); }, 150); });
  });
})();
