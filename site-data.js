var siteData = (function () {
  var loads = {};
  return function (name) {
    if (!loads[name]) {
      loads[name] = fetch('/data/' + name + '.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return loads[name];
  };
})();
