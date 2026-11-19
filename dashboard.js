(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  TH.views = TH.views || {};

  function tournamentCard(db, tournament) {
    const status = TH.statusMeta(tournament.status);
    const progress = TH.matches.progress(db, tournament);
    const kind = tournament.participantKind === 'team' ? 'takım' : 'oyuncu';
    return (
      '<a class="t-card" href="#/tournament/' + tournament.id + '/overview">' +
      '<div class="t-cover cover-' + TH.gameSlug(tournament.game) + '"' + (tournament.cover ? ' style="background-image:url(\'' + tournament.cover + '\')"' : '') + '>' +
      '<span class="badge ' + status.cls + '"><i class="dot"></i>' + status.label + '</span>' +
      '<span class="pill">' + TH.esc(tournament.game) + '</span></div>' +
      '<div class="t-body"><h3>' + TH.esc(tournament.name) + '</h3>' +
      '<p class="muted">' + TH.esc(TH.formatMeta(tournament.format).short) + ' · ' + TH.esc(TH.formatDay(tournament.startDate)) + '</p>' +
      '<div class="progress" aria-hidden="true"><span style="width:' + Math.round(progress.ratio * 100) + '%"></span></div>' +
      '<div class="t-meta"><span>' + tournament.participants.length + ' ' + kind + '</span><span>' + progress.done + '/' + progress.total + ' maç</span></div>' +
      '</div></a>'
    );
  }

  function matchRow(db, match) {
    const tournament = db.tournaments.find(function (t) { return t.id === match.tournamentId; });
    return (
      '<div class="list-row">' +
      '<div class="list-main"><strong>' + TH.esc(TH.entityName(db, match.a)) + ' · ' + TH.esc(TH.entityName(db, match.b)) + '</strong>' +
      '<span class="muted">' + TH.esc(tournament ? tournament.name : '') + ' · ' + TH.esc(match.name) + ' · ' + TH.esc(TH.formatShort(match.scheduledAt)) + '</span></div>' +
      (match.status === 'completed'
        ? '<strong>' + match.scoreA + ' - ' + match.scoreB + '</strong>'
        : '<button class="btn btn-primary btn-sm" type="button" data-action="score" data-id="' + match.id + '">Skor gir</button>') +
      '</div>'
    );
  }

  TH.widgets = {
    tournamentCard: tournamentCard,
    matchRow: matchRow
  };

  TH.views.dashboard = {
    render: function () {
      const db = TH.storage.get();
      const name = db.settings.profile.displayName || 'Ahmet';
      const active = db.tournaments.filter(function (t) { return t.status === 'active'; });
      const done = db.tournaments.filter(function (t) { return t.status === 'completed'; });
      const people = {};
      db.tournaments.forEach(function (t) {
        t.participants.forEach(function (p) { people[p.kind + p.id] = true; });
      });
      const upcoming = TH.matches.upcoming(db, 5);
      const recent = TH.matches.recent(db, 5);
      const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
      return (
        '<section class="welcome"><div><p class="eyebrow">' + TH.esc(today) + '</p><h1>Merhaba, ' + TH.esc(name.split(' ')[0]) + '</h1>' +
        '<p class="lede">' + (upcoming.length ? upcoming.length + ' yaklaşan maç var. Aktif kupaların fikstürü skor girdikçe ilerler.' : 'Yeni bir kupa açıp arkadaşlarınla eşleşmeleri başlatabilirsin.') + '</p></div>' +
        '<a class="btn btn-primary" href="#/tournaments/new">' + TH.icons.plus + ' Hızlı turnuva oluştur</a></section>' +
        '<section class="stat-grid">' +
        stat('Toplam turnuva', db.tournaments.length, TH.icons.trophy, '', db.tournaments.length + ' kayıt') +
        stat('Devam eden', active.length, TH.icons.spark, 'mint', 'Şu an oynanan') +
        stat('Tamamlanan', done.length, TH.icons.check, '', 'Şampiyonu belli') +
        stat('Katılımcı', Object.keys(people).length, TH.icons.users, 'warn', 'Benzersiz kayıt') +
        '</section>' +
        '<section class="dash-grid"><div class="stack">' +
        '<article class="panel"><div class="panel-head"><h2>Aktif turnuvalar</h2><a class="btn btn-ghost btn-sm" href="#/tournaments">Tümü</a></div>' +
        (active.length ? '<div class="card-grid">' + active.slice(0, 3).map(function (t) { return tournamentCard(db, t); }).join('') + '</div>' : TH.ui.empty({ title: 'Aktif turnuva yok', text: 'Bir kupa oluşturduğunda burada görünür.', action: 'create', actionLabel: 'Turnuva oluştur' })) +
        '</article>' +
        '<article class="panel"><div class="panel-head"><h2>Yaklaşan maçlar</h2><a class="btn btn-ghost btn-sm" href="#/calendar">Takvim</a></div>' +
        (upcoming.length ? '<div class="list">' + upcoming.map(function (m) { return matchRow(db, m); }).join('') + '</div>' : '<p class="muted">Planlanmış maç kalmadı.</p>') +
        '</article></div><aside class="stack">' +
        '<article class="panel"><div class="panel-head"><h2>Son aktiviteler</h2></div><div class="timeline">' +
        (db.activities.length ? db.activities.slice(0, 6).map(function (a, i) {
          return '<div class="time-item"><div class="time-rail"><i></i>' + (i === 5 ? '' : '<b></b>') + '</div><div><strong>' + TH.esc(a.text) + '</strong><p class="muted">' + TH.esc(TH.timeAgo(a.createdAt)) + '</p></div></div>';
        }).join('') : '<p class="muted">Henüz hareket yok.</p>') +
        '</div></article>' +
        '<article class="panel"><div class="panel-head"><h2>Son skorlar</h2></div>' +
        (recent.length ? '<div class="list">' + recent.map(function (m) { return matchRow(db, m); }).join('') + '</div>' : '<p class="muted">Girilmiş skor yok.</p>') +
        '</article>' +
        '<article class="panel"><div class="panel-head"><h2>Kısayollar</h2></div><div class="quick-grid">' +
        '<a href="#/players">' + TH.icons.user + '<strong>Oyuncu ekle</strong><span class="muted">Profil aç</span></a>' +
        '<a href="#/teams">' + TH.icons.users + '<strong>Takım kur</strong><span class="muted">Kadro bağla</span></a>' +
        '<a href="#/rankings">' + TH.icons.chart + '<strong>Sıralama</strong><span class="muted">Puanlar</span></a>' +
        '<a href="#/discover">' + TH.icons.compass + '<strong>Keşfet</strong><span class="muted">Açık kupalar</span></a>' +
        '</div></article></aside></section>'
      );
    },
    bind: function (root) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'create') location.hash = '#/tournaments/new';
        if (el.dataset.action === 'score') TH.actions.askScore(el.dataset.id);
      });
    }
  };

  function stat(label, value, icon, tone, foot) {
    return '<article class="stat-card"><div class="stat-icon ' + tone + '">' + icon + '</div><div><p class="stat-label">' + label + '</p><p class="stat-value">' + value + '</p><p class="stat-foot">' + foot + '</p></div></article>';
  }
})();
