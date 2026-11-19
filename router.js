(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});

  function parse() {
    const raw = (location.hash || '#/dashboard').replace(/^#/, '');
    const bits = raw.split('?');
    const path = bits[0];
    let params = {};
    if (bits[1]) {
      bits[1].split('&').forEach(function (pair) {
        const parts = pair.split('=');
        params[decodeURIComponent(parts[0] || '')] = decodeURIComponent(parts[1] || '');
      });
    }
    const parts = path.split('/').filter(Boolean).map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    });
    return { parts: parts, params: params };
  }

  function match(parsed) {
    const p = parsed.parts;
    if (!p.length || p[0] === 'dashboard') return { name: 'dashboard', nav: 'dashboard', params: {} };
    if (p[0] === 'tournaments' && p[1] === 'new') return { name: 'wizard', nav: 'tournaments', params: {} };
    if (p[0] === 'tournaments') return { name: 'tournaments', nav: 'tournaments', params: {} };
    if (p[0] === 'tournament' && p[1]) return { name: 'tournament', nav: 'tournaments', params: { id: p[1], tab: p[2] || 'overview' } };
    if (p[0] === 'discover') return { name: 'discover', nav: 'discover', params: {} };
    if (p[0] === 'teams' && p[1]) return { name: 'team', nav: 'teams', params: { id: p[1] } };
    if (p[0] === 'teams') return { name: 'teams', nav: 'teams', params: {} };
    if (p[0] === 'players' && p[1]) return { name: 'player', nav: 'players', params: { id: p[1] } };
    if (p[0] === 'players') return { name: 'players', nav: 'players', params: {} };
    if (p[0] === 'calendar') return { name: 'calendar', nav: 'calendar', params: {} };
    if (p[0] === 'rankings') return { name: 'rankings', nav: 'rankings', params: {} };
    if (p[0] === 'notifications') return { name: 'notifications', nav: 'notifications', params: {} };
    if (p[0] === 'settings') return { name: 'settings', nav: 'settings', params: {} };
    if (p[0] === 'search') return { name: 'search', nav: '', params: { q: p.slice(1).join('/') } };
    return { name: 'dashboard', nav: 'dashboard', params: {} };
  }

  TH.router = {
    parse: parse,
    match: match,
    current: function () { return match(parse()); }
  };
})();
