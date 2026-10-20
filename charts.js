var CFChart = (function () {
  'use strict';

  var CHAR = 7;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }

  function format(n) {
    var m = Math.round(n / 1e5) / 10, k = Math.round(n / 1e3);
    if (m >= 1000) return (n / 1e9).toFixed(1) + 'B';
    if (k >= 1000) return m.toFixed(1) + 'M';
    if (n >= 1e4) return k + 'K';
    return n.toLocaleString('en-US');
  }

  function col(metric, name) {
    var i = metric.columns.indexOf(name);
    if (i < 0) throw new Error(metric.metric + ': no column ' + name);
    return i;
  }

  function widest(texts) {
    return CHAR * Math.max.apply(null, texts.map(function (t) { return String(t).length; }));
  }

  function el(tag, cls, at, body) {
    var s = '<' + tag + ' class="' + cls + '"';
    Object.keys(at).forEach(function (k) {
      s += ' ' + k + '="' + (typeof at[k] === 'number' ? +at[k].toFixed(1) : at[k]) + '"';
    });
    return body === undefined ? s + '/>' : s + '>' + esc(body) + '</' + tag + '>';
  }

  function rotated(x, y, s) {
    return el('text', 'cf-axis', { transform: 'translate(' + x + ',' + y + ') rotate(-90)', 'text-anchor': 'middle' }, s);
  }

  function scale(max, len, room) {
    var k = Math.floor(Math.log10(max / 4));
    for (var i = 0; ; i++) {
      var step = [1, 2, 5][i % 3] * Math.pow(10, k + Math.floor(i / 3)), ticks = [];
      for (var t = 0; t <= Math.ceil(max / step); t++) ticks.push(t * step);
      if (step >= max / 4 && (ticks.length < 3 || len / (ticks.length - 1) >= room(ticks))) return ticks;
    }
  }

  function bars(rows, opts, w, max) {
    var catW = widest(rows.map(function (d) { return d.cat; })) + 8;
    var labW = widest(rows.map(function (d) { return d.lab; })) + 8;
    var inline = catW <= (w - labW) / 2, pitch = inline ? 26 : 40;
    var left = inline ? catW : 8, right = w - labW;
    var top = 44, bottom = top + pitch * rows.length;
    var ticks = scale(max, right - left, function (t) { return widest(t.map(format)) + 12; });
    var x = function (v) { return left + (right - left) * v / ticks[ticks.length - 1]; };
    var s = ticks.map(function (t) {
      return el('line', 'cf-grid', { x1: x(t), y1: top, x2: x(t), y2: bottom })
        + el('text', 'cf-tick', { x: x(t), y: bottom + 16, 'text-anchor': 'middle' }, format(t));
    }).join('');
    rows.forEach(function (d, i) {
      var y = top + pitch * (i + 1) - 22;
      s += el('rect', 'cf-bar', { x: left, y: y, width: x(d.v) - left, height: 18 })
        + el('text', 'cf-cat', inline ? { x: left - 8, y: y + 13, 'text-anchor': 'end' } : { x: left, y: y - 4 }, d.cat)
        + el('text', 'cf-label', { x: x(d.v) + 6, y: y + 13 }, d.lab);
    });
    s += el('text', 'cf-axis', { x: 0, y: top - 12 }, opts.labelTitle)
      + el('text', 'cf-axis', { x: (left + right) / 2, y: bottom + 40, 'text-anchor': 'middle' }, opts.valueTitle);
    return { height: bottom + 52, body: s };
  }

  function columns(rows, opts, w, max) {
    var top = 44, bottom = 264;
    var ticks = scale(max, bottom - top, function () { return 18; });
    var left = 30 + widest(ticks.map(format)), right = w - 4, slot = (right - left) / rows.length;
    if (slot < widest(rows.map(function (d) { return d.lab; })) + 8) return null;
    var y = function (v) { return bottom - (bottom - top) * v / ticks[ticks.length - 1]; };
    var s = ticks.map(function (t) {
      return el('line', 'cf-grid', { x1: left, y1: y(t), x2: right, y2: y(t) })
        + el('text', 'cf-tick', { x: left - 8, y: y(t) + 4, 'text-anchor': 'end' }, format(t));
    }).join('');
    rows.forEach(function (d, i) {
      var cx = left + slot * (i + 0.5);
      s += el('rect', 'cf-bar', { x: cx - slot * 0.35, y: y(d.v), width: slot * 0.7, height: bottom - y(d.v) })
        + el('text', 'cf-label', { x: cx, y: y(d.v) - 4, 'text-anchor': 'middle' }, d.lab)
        + el('text', 'cf-cat', { x: cx, y: bottom + 14, 'text-anchor': 'end', transform: 'rotate(-45 ' + +cx.toFixed(1) + ' ' + (bottom + 14) + ')' }, d.cat);
    });
    s += rotated(14, (top + bottom) / 2, opts.valueTitle)
      + el('text', 'cf-axis', { x: (left + right) / 2, y: bottom + 84, 'text-anchor': 'middle' }, opts.labelTitle);
    return { height: bottom + 96, body: s };
  }


  var DAY = 86400000, MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function utc(iso) { return Date.parse(iso + 'T00:00:00Z'); }
  function short(iso) { var d = new Date(utc(iso)); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
  function monday(iso) { var d = new Date(utc(iso)); return new Date(d - (d.getUTCDay() + 6) % 7 * DAY).toISOString().slice(0, 10); }

  // Sums a per-day column into Monday-start weeks.
  function byWeek(table, value) {
    var di = col(table, 'day'), vi = col(table, value), out = [];
    table.rows.forEach(function (r) {
      var m = monday(r[di]), last = out[out.length - 1];
      if (last && last.week === m) last.value += r[vi]; else out.push({ week: m, value: r[vi] });
    });
    return out;
  }

  // Columns per Monday week; a week the data covers only in part is hatched and labelled.
  // weeks: [{week, value, sub?}]; opts: {title, note, yTitle, firstDay, lastDay, width, fmt}
  function weekly(weeks, opts) {
    var width = Math.max(300, Math.floor(opts.width)), narrow = width < 560, fmt = opts.fmt || format;
    var subs = weeks.some(function (w) { return w.sub; });
    var H = (narrow ? 300 : 310) + (subs ? 16 : 0), right = width - 8, top = opts.note ? 56 : 40, bottom = H - (subs ? 88 : 72);
    var max = Math.max.apply(null, weeks.map(function (w) { return w.value; })) || 1;
    var ticks = scale(max, bottom - top, function () { return 18; });
    var left = 34 + widest(ticks.map(fmt));
    var y = function (v) { return bottom - (bottom - top) * v / ticks[ticks.length - 1]; };
    var slot = (right - left) / weeks.length;
    var fit = function (v) {
      var t = fmt(v);
      if (t.length * (narrow ? 7.2 : 9) <= slot - 4 || v < 1e6) return t;
      return v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : Math.round(v / 1e6) + 'M';
    };
    var id = 'hatch-' + Math.random().toString(36).slice(2, 8);
    var s = '<defs><pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="6" height="6" class="cf-hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="cf-hatch-line"/></pattern></defs>' +
      el('text', 'cf-title', { x: 0, y: 16 }, opts.title) + (opts.note ? el('text', 'cf-tick', { x: 0, y: 34 }, opts.note) : '');
    ticks.forEach(function (t) {
      s += el('line', 'cf-grid', { x1: left, x2: right, y1: y(t), y2: y(t) }) +
        el('text', 'cf-tick', { x: left - 8, y: y(t) + 4, 'text-anchor': 'end' }, fmt(t));
    });
    weeks.forEach(function (w, i) {
      var cx = left + slot * (i + 0.5), bw = Math.min(slot * 0.6, 64);
      var start = Math.max(utc(w.week), utc(opts.firstDay)), end = Math.min(utc(w.week) + 6 * DAY, utc(opts.lastDay));
      var days = Math.round((end - start) / DAY) + 1, partial = days < 7, line = bottom + 18;
      s += '<rect class="cf-bar" x="' + +(cx - bw / 2).toFixed(1) + '" y="' + +y(w.value).toFixed(1) + '" width="' + +bw.toFixed(1) + '" height="' + +(bottom - y(w.value)).toFixed(1) + '"' +
        (partial ? ' style="fill:url(#' + id + ')" data-partial="' + days + '"' : '') + '/>' +
        el('text', narrow ? 'cf-label cf-label--sm' : 'cf-label', { x: cx, y: y(w.value) - 7, 'text-anchor': 'middle' }, fit(w.value)) +
        el('text', 'cf-cat', { x: cx, y: line, 'text-anchor': 'middle' }, short(w.week));
      if (w.sub) { line += 16; s += el('text', 'cf-share', { x: cx, y: line, 'text-anchor': 'middle' }, narrow ? w.sub.split(' ')[0] : w.sub); }
      if (partial) s += el('text', 'cf-partial', { x: cx, y: line + 16, 'text-anchor': 'middle' }, (narrow ? '' : 'partial: ') + days + ' of 7 days');
    });
    s += rotated(14, (top + bottom) / 2, opts.yTitle) +
      el('text', 'cf-axis', { x: (left + right) / 2, y: H - 6, 'text-anchor': 'middle' }, 'Week starting Monday');
    return '<svg viewBox="0 0 ' + width + ' ' + H + '" width="' + width + '" height="' + H + '" role="img" aria-label="' + esc(opts.title) + '">' + s + '</svg>';
  }

  function render(metric, opts) {
    var vi = col(metric, opts.value);
    var li = opts.label.map(function (name) { return col(metric, name); });
    var rows = metric.rows.map(function (r) {
      return { cat: li.map(function (i) { return r[i]; }).join(' · '), v: r[vi], lab: format(r[vi]) };
    });
    var max = Math.max.apply(null, rows.map(function (d) { return d.v; })) || 1;
    var w = Math.floor(opts.width);
    var c = opts.kind === 'column' && columns(rows, opts, w, max) || bars(rows, opts, w, max);
    return '<svg width="' + w + '" height="' + c.height + '" viewBox="0 0 ' + w + ' ' + c.height
      + '" role="img" aria-label="' + esc(metric.title) + '">'
      + el('text', 'cf-title', { x: 0, y: 14 }, metric.title) + c.body + '</svg>';
  }

  return { render: render, format: format, weekly: weekly, byWeek: byWeek, short: short };
})();
