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

  return { render: render, format: format };
})();
