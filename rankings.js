(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  TH.views = TH.views || {};
  const state = { kind: 'players', sort: 'win' };

  function sortRows(rows) {
    return rows.slice().sort(function (a, b) {
      if (state.sort === 'rate') return b.winRate - a.winRate || b.played - a.played;
      if (state.sort === 'titles') return b.titles.length - a.titles.length || b.win - a.win;
      if (state.sort === 'points') return b.points - a.points || b.win - a.win;
      return b.win - a.win || b.winRate - a.winRate;
    });
  }

  TH.views.rankings = {
    render: function () {
      const boards = TH.stats.boards(TH.storage.get());
      const rows = sortRows(state.kind === 'players' ? boards.players : boards.teams);
      const sorts = [['win', 'Galibiyet'], ['rate', 'Oran'], ['titles', 'Şampiyonluk'], ['points', 'Puan']];
      return TH.ui.pageHead({
        eyebrow: 'Liderlik',
        title: 'Sıralamalar',
        lede: 'Puanlar oynanan maçlardan anlık hesaplanır. Beraberlik ve averaj tablolarda, burada seçtiğin ölçüt geçerlidir.'
      }) + '<div class="toolbar"><div class="segmented"><button type="button" data-action="kind" data-value="players" class="' + (state.kind === 'players' ? 'is-on' : '') + '">Oyuncular</button><button type="button" data-action="kind" data-value="teams" class="' + (state.kind === 'teams' ? 'is-on' : '') + '">Takımlar</button></div><div class="chips">' +
        sorts.map(function (item) { return '<button class="chip ' + (state.sort === item[0] ? 'is-on' : '') + '" type="button" data-action="sort" data-value="' + item[0] + '">' + item[1] + '</button>'; }).join('') +
        '</div></div>' + podium(rows) + '<section class="panel"><div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>İsim</th><th>O</th><th>G</th><th>B</th><th>M</th><th>Oran</th><th>Kupa</th><th>Puan</th></tr></thead><tbody>' +
        rows.map(function (row, index) {
          const href = state.kind === 'players' ? '#/player/' + row.ref.id : '#/team/' + row.ref.id;
          return '<tr class="' + (index < 3 ? 'is-me' : '') + '"><td>' + (index + 1) + '</td><td><a class="who" href="' + href + '">' + TH.personAvatar(row.person) + TH.esc(row.name) + '</a></td><td>' + row.played + '</td><td>' + row.win + '</td><td>' + row.draw + '</td><td>' + row.loss + '</td><td>' + row.winRate + '%</td><td>' + row.titles.length + '</td><td><strong>' + row.points + '</strong></td></tr>';
        }).join('') + '</tbody></table></div></section>';
    },
    bind: function (root) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'kind') state.kind = el.dataset.value;
        if (el.dataset.action === 'sort') state.sort = el.dataset.value;
        TH.app.render();
      });
    }
  };

  function podium(rows) {
    const top = rows.slice(0, 3);
    if (!top.length) return '';
    return '<div class="rank-podium">' + top.map(function (row, index) {
      return '<article class="podium"><div class="place">' + (index + 1) + '</div>' + TH.personAvatar(row.person) + '<strong>' + TH.esc(row.name) + '</strong><span class="muted">' + row.win + ' galibiyet · ' + row.winRate + '%</span></article>';
    }).join('') + '</div>';
  }
})();
