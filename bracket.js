(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});

  function slot(db, match, ref, score) {
    const done = match.status === 'completed';
    const win = done && match.winner && ref && TH.sameRef(match.winner, ref);
    const loss = done && TH.isReal(ref) && match.winner && !win;
    return (
      '<div class="bslot ' + (win ? 'is-win' : loss ? 'is-loss' : '') + '">' +
      TH.avatarHTML(db, ref) +
      '<span class="bname">' + TH.esc(TH.entityName(db, ref)) + '</span>' +
      '<span class="bscore">' + (done && score != null ? TH.esc(score) : '') + '</span></div>'
    );
  }

  function matchCard(db, match) {
    return (
      '<button class="bmatch" type="button" data-action="score" data-id="' + TH.esc(match.id) + '">' +
      slot(db, match, match.a, match.scoreA) +
      slot(db, match, match.b, match.scoreB) +
      '<div class="bmeta">' + TH.esc(match.scheduledAt ? TH.formatShort(match.scheduledAt) : match.name) +
      (match.held ? ' · İlerleme bekliyor' : '') + '</div></button>'
    );
  }

  function grouped(matches, phase) {
    const map = {};
    matches.filter(function (m) { return m.phase === phase && m.status !== 'cancelled'; }).forEach(function (m) {
      if (!map[m.round]) map[m.round] = [];
      map[m.round].push(m);
    });
    return Object.keys(map).sort(function (a, b) { return Number(a) - Number(b); }).map(function (key) {
      return map[key].sort(function (a, b) { return a.index - b.index; });
    });
  }

  function columns(db, rounds) {
    return rounds.map(function (round) {
      return (
        '<section class="bracket-round"><div class="round-label">' + TH.esc(round[0].name) + '</div><div class="bracket-col">' +
        round.map(function (m) { return matchCard(db, m); }).join('') +
        '</div></section>'
      );
    }).join('');
  }

  function board(html) {
    return '<div class="bracket-scroll"><div class="bracket">' + html + '</div></div>';
  }

  function champion(db, tournament) {
    const ref = tournament.championId ? { id: tournament.championId, kind: tournament.championKind } : null;
    return (
      '<section class="bracket-round champion-col"><div class="round-label">Şampiyon</div><div class="panel champion-card">' +
      TH.icons.trophy +
      (ref ? TH.avatarHTML(db, ref) + '<strong>' + TH.esc(TH.entityName(db, ref)) + '</strong>' : '<p class="muted">Henüz belli değil</p>') +
      '</div></section>'
    );
  }

  function render(db, tournament) {
    const matches = db.matches.filter(function (m) { return m.tournamentId === tournament.id; });
    if (!matches.length) return TH.ui.empty({ title: 'Ağaç yok', text: 'Katılımcılar eklenince fikstür oluşur.' });
    if (tournament.format === 'robin' || tournament.format === 'league' || tournament.format === 'swiss') {
      const phase = tournament.format === 'swiss' ? 'swiss' : tournament.format;
      const rounds = grouped(matches, phase);
      return rounds.length ? board(columns(db, rounds)) : TH.ui.empty({ title: 'Tur yok', text: 'Eşleşmeler burada listelenir.' });
    }
    if (tournament.format === 'group') {
      const rounds = grouped(matches, 'knockout');
      const waiting = '<div class="panel" style="margin-bottom:12px"><p class="muted">Grup aşaması bitmeden eleme ağacı açılmaz. Fikstür sekmesinden grup skorlarını girebilirsin.</p></div>';
      return rounds.length ? waiting.replace('bitmeden eleme ağacı açılmaz. Fikstür sekmesinden grup skorlarını girebilirsin.', 'bitti. Eleme turu hazır.') + board(columns(db, rounds) + champion(db, tournament)) : waiting;
    }
    if (tournament.format === 'double') {
      const reset = matches.find(function (m) { return m.phase === 'reset' && (m.status === 'scheduled' || m.status === 'completed'); });
      return (
        '<div class="section-block"><h3>Üst tablo</h3>' + board(columns(db, grouped(matches, 'winners'))) + '</div>' +
        '<div class="section-block"><h3>Alt tablo</h3>' + board(columns(db, grouped(matches, 'losers'))) + '</div>' +
        '<div class="section-block"><h3>Final</h3>' + board(columns(db, grouped(matches, 'grand')) + (reset ? '<section class="bracket-round"><div class="round-label">Rövanş</div>' + matchCard(db, reset) + '</section>' : '') + champion(db, tournament)) + '</div>'
      );
    }
    return board(columns(db, grouped(matches, 'winners')) + champion(db, tournament));
  }

  TH.bracket = { render: render, card: matchCard };
})();
