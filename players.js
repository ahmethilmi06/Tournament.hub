(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  TH.views = TH.views || {};
  const state = { q: '', sort: 'win' };

  function rows() {
    const data = TH.storage.get();
    return TH.stats.boards(data).players.filter(function (row) {
      return !state.q || TH.norm(row.name + ' ' + row.username).indexOf(TH.norm(state.q)) !== -1;
    }).sort(sorter);
  }

  function sorter(a, b) {
    if (state.sort === 'rate') return b.winRate - a.winRate || b.win - a.win;
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'tr');
    return b.win - a.win || b.points - a.points;
  }

  TH.views.players = {
    render: function () {
      const list = rows();
      return TH.ui.pageHead({
        eyebrow: 'Kadro',
        title: 'Oyuncular',
        lede: 'Profiller, maç geçmişi ve kazanma oranı tek yerde.',
        actions: '<button class="btn btn-primary" type="button" data-action="create">' + TH.icons.plus + ' Oyuncu ekle</button>'
      }) + '<div class="toolbar"><label class="search"><input id="pq" value="' + TH.esc(state.q) + '" placeholder="Oyuncu ara">' + TH.icons.search + '</label><select id="ps"><option value="win"' + (state.sort === 'win' ? ' selected' : '') + '>Galibiyet</option><option value="rate"' + (state.sort === 'rate' ? ' selected' : '') + '>Oran</option><option value="name"' + (state.sort === 'name' ? ' selected' : '') + '>İsim</option></select></div><div id="plist">' + playerList(list) + '</div>';
    },
    bind: function (root) {
      const paint = function () {
        root.querySelector('#plist').innerHTML = playerList(rows());
      };
      const search = root.querySelector('#pq');
      if (search) search.addEventListener('input', function (event) { state.q = event.target.value; paint(); });
      const sort = root.querySelector('#ps');
      if (sort) sort.addEventListener('change', function (event) { state.sort = event.target.value; paint(); });
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'create') openPlayer();
      });
    }
  };

  function playerList(list) {
    if (!list.length) return TH.ui.empty({ title: 'Oyuncu yok', text: 'Aramayı değiştir veya yeni profil oluştur.', action: 'create', actionLabel: 'Oyuncu ekle' });
    return '<div class="entity-grid">' + list.map(card).join('') + '</div>';
  }

  function card(row) {
    return '<a class="entity-card" href="#/player/' + row.ref.id + '"><div class="entity-top">' + TH.personAvatar(row.person) + '<div><strong>' + TH.esc(row.name) + '</strong><span class="muted">@' + TH.esc(row.username) + '</span></div></div><div class="stat-pills"><span class="pill is-win">' + row.win + ' G</span><span class="pill is-loss">' + row.loss + ' M</span><span class="pill">' + row.winRate + '%</span><span class="pill">' + row.titles.length + ' kupa</span></div></a>';
  }

  TH.views.player = {
    render: function (params) {
      const data = TH.storage.get();
      const player = data.players.find(function (p) { return p.id === params.id; });
      if (!player) return TH.ui.empty({ title: 'Oyuncu bulunamadı', text: 'Bu profil silinmiş olabilir.' });
      const row = TH.stats.entity(data, { id: player.id, kind: 'player' });
      const teams = data.teams.filter(function (t) { return t.memberIds.indexOf(player.id) !== -1; });
      return '<a class="btn btn-ghost btn-sm" href="#/players">← Oyuncular</a><section class="panel" style="margin-top:12px"><div class="entity-top">' +
        TH.personAvatar(player) + '<div class="list-main"><h1>' + TH.esc(player.displayName) + '</h1><p class="muted">@' + TH.esc(player.username) + (player.bio ? ' · ' + TH.esc(player.bio) : '') + '</p></div>' +
        '<button class="btn btn-ghost" type="button" data-action="edit">Düzenle</button><button class="btn btn-danger" type="button" data-action="delete">Sil</button></div>' +
        '<div class="stat-grid" style="margin-top:16px">' + stat('Galibiyet', row.win) + stat('Mağlubiyet', row.loss) + stat('Beraberlik', row.draw) + stat('Oran', row.winRate + '%') + '</div></section>' +
        '<section class="detail-grid" style="margin-top:16px"><article class="panel"><h2>Maçlar</h2>' + history(data, row) + '</article><article class="panel"><h2>Turnuvalar</h2>' +
        (row.joined.length ? row.joined.map(function (t) { return '<a class="list-row" href="#/tournament/' + t.id + '/overview"><span class="list-main">' + TH.esc(t.name) + '</span><span class="badge ' + TH.statusMeta(t.status).cls + '">' + TH.statusMeta(t.status).label + '</span></a>'; }).join('') : '<p class="muted">Henüz turnuva yok.</p>') +
        '<h2 style="margin-top:16px">Takımlar</h2>' + (teams.length ? teams.map(function (t) { return '<a class="list-row" href="#/team/' + t.id + '">' + TH.esc(t.name) + '</a>'; }).join('') : '<p class="muted">Takımda değil.</p>') +
        '<h2 style="margin-top:16px">Kupalar</h2><p>' + (row.titles.length ? row.titles.map(function (t) { return TH.esc(t.name); }).join(', ') : 'Henüz şampiyonluk yok.') + '</p></article></section>';
    },
    bind: function (root, params) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const data = TH.storage.get();
        const player = data.players.find(function (p) { return p.id === params.id; });
        if (!player) return;
        if (el.dataset.action === 'edit') openPlayer(player);
        if (el.dataset.action === 'delete') removePlayer(player);
      });
    }
  };

  function stat(label, value) {
    return '<article class="stat-card"><div><p class="stat-label">' + label + '</p><p class="stat-value">' + value + '</p></div></article>';
  }

  function history(data, row) {
    if (!row.history.length) return '<p class="muted">Maç geçmişi boş.</p>';
    return row.history.slice(0, 12).map(function (item) {
      const pill = item.result === 'win' ? 'is-win' : item.result === 'loss' ? 'is-loss' : 'is-draw';
      const label = item.result === 'win' ? 'Galibiyet' : item.result === 'loss' ? 'Mağlubiyet' : 'Beraberlik';
      return '<div class="list-row"><span class="pill ' + pill + '">' + label + '</span><div class="list-main"><strong>' + TH.esc(item.score) + ' · ' + TH.esc(TH.entityName(data, item.opponent)) + '</strong><span class="muted">' + TH.esc(item.tournament ? item.tournament.name : '') + '</span></div></div>';
    }).join('');
  }

  function openPlayer(existing) {
    const player = existing || { displayName: '', username: '', bio: '', avatar: '' };
    TH.ui.modal({
      title: existing ? 'Oyuncuyu düzenle' : 'Yeni oyuncu',
      body: '<div class="form-grid"><label class="field"><span>Ad</span><input name="displayName" maxlength="32" value="' + TH.esc(player.displayName) + '"></label><label class="field"><span>Kullanıcı adı</span><input name="username" maxlength="20" value="' + TH.esc(player.username) + '"></label><label class="field wide"><span>Kısa bio</span><input name="bio" maxlength="120" value="' + TH.esc(player.bio || '') + '"></label><label class="field wide"><span>Profil fotoğrafı</span><span class="btn file-btn">Görsel seç<input type="file" name="avatar" accept="image/*"></span></label></div>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="save">Kaydet</button>',
      onBind: function (dialog) {
        let avatar = player.avatar || '';
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        dialog.querySelector('[name="avatar"]').addEventListener('change', function (event) {
          TH.ui.readImage(event.target.files[0]).then(function (url) { avatar = url; TH.ui.toast('Fotoğraf hazır.'); }).catch(function (err) { TH.ui.toast(err.message, 'error'); });
        });
        dialog.querySelector('[data-action="save"]').addEventListener('click', function () {
          const data = TH.storage.get();
          const displayName = dialog.querySelector('[name="displayName"]').value.trim();
          const username = dialog.querySelector('[name="username"]').value.trim().toLowerCase();
          const bio = dialog.querySelector('[name="bio"]').value.trim();
          if (displayName.length < 2) { TH.ui.toast('Ad en az 2 karakter olmalı.', 'error'); return; }
          if (!/^[a-z0-9_.]{2,20}$/.test(username)) { TH.ui.toast('Kullanıcı adı 2-20 karakter, harf ve rakam olmalı.', 'error'); return; }
          if (data.players.some(function (p) { return p.username === username && p.id !== (existing && existing.id); })) { TH.ui.toast('Bu kullanıcı adı kullanılıyor.', 'error'); return; }
          if (existing) {
            existing.displayName = displayName;
            existing.username = username;
            existing.bio = bio;
            existing.avatar = avatar;
          } else {
            data.players.push({ id: TH.uid('player'), displayName: displayName, username: username, bio: bio, avatar: avatar, createdAt: Date.now() });
          }
          TH.storage.commit();
          TH.ui.closeModal();
          TH.ui.toast('Oyuncu kaydedildi.');
          TH.app.refresh();
        });
      }
    });
  }

  function removePlayer(player) {
    const data = TH.storage.get();
    const used = data.tournaments.filter(function (t) { return t.participants.some(function (p) { return p.kind === 'player' && p.id === player.id; }); });
    const teams = data.teams.filter(function (t) { return t.memberIds.indexOf(player.id) !== -1; });
    if (used.length || teams.length) {
      TH.ui.toast('Oyuncu bir turnuva veya takımda. Önce oradan çıkar.', 'error');
      return;
    }
    TH.ui.confirm({ title: 'Oyuncuyu sil', message: player.displayName + ' profili silinecek.', confirmLabel: 'Sil', danger: true }).then(function (ok) {
      if (!ok) return;
      const fresh = TH.storage.get();
      fresh.players = fresh.players.filter(function (p) { return p.id !== player.id; });
      if (fresh.settings.profile.linkedPlayerId === player.id) fresh.settings.profile.linkedPlayerId = '';
      TH.storage.commit();
      TH.ui.toast('Oyuncu silindi.');
      location.hash = '#/players';
    });
  }

  TH.playerForm = openPlayer;
})();
