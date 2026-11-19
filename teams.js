(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  TH.views = TH.views || {};
  const state = { q: '' };

  function filtered() {
    const data = TH.storage.get();
    return TH.stats.boards(data).teams.filter(function (row) {
      return !state.q || TH.norm(row.name + ' ' + row.tag).indexOf(TH.norm(state.q)) !== -1;
    }).sort(function (a, b) { return b.win - a.win || a.name.localeCompare(b.name, 'tr'); });
  }

  function teamList(list) {
    if (!list.length) return TH.ui.empty({ title: 'Takım yok', text: 'Aramayı değiştir veya yeni takım kur.', action: 'create', actionLabel: 'Takım kur' });
    return '<div class="entity-grid">' + list.map(function (row) {
      return '<a class="entity-card" href="#/team/' + row.ref.id + '"><div class="entity-top">' + TH.personAvatar(row.person) + '<div><strong>' + TH.esc(row.name) + '</strong><span class="muted">' + TH.esc(row.tag) + ' · ' + row.person.memberIds.length + ' üye</span></div></div><div class="stat-pills"><span class="pill is-win">' + row.win + ' G</span><span class="pill is-loss">' + row.loss + ' M</span><span class="pill">' + row.winRate + '%</span></div></a>';
    }).join('') + '</div>';
  }

  TH.views.teams = {
    render: function () {
      const list = filtered();
      return TH.ui.pageHead({
        eyebrow: 'Kadro',
        title: 'Takımlar',
        lede: 'Logolar, üyeler ve takım istatistikleri.',
        actions: '<button class="btn btn-primary" type="button" data-action="create">' + TH.icons.plus + ' Takım kur</button>'
      }) + '<div class="toolbar"><label class="search"><input id="teamq" value="' + TH.esc(state.q) + '" placeholder="Takım ara">' + TH.icons.search + '</label></div><div id="tlist">' + teamList(list) + '</div>';
    },
    bind: function (root) {
      const input = root.querySelector('#teamq');
      if (input) input.addEventListener('input', function (event) {
        state.q = event.target.value;
        root.querySelector('#tlist').innerHTML = teamList(filtered());
      });
      root.addEventListener('click', function (event) {
        if (event.target.closest('[data-action="create"]')) openTeam();
      });
    }
  };

  TH.views.team = {
    render: function (params) {
      const data = TH.storage.get();
      const team = data.teams.find(function (t) { return t.id === params.id; });
      if (!team) return TH.ui.empty({ title: 'Takım bulunamadı', text: 'Bu takım silinmiş olabilir.' });
      const row = TH.stats.entity(data, { id: team.id, kind: 'team' });
      const members = team.memberIds.map(function (id) { return data.players.find(function (p) { return p.id === id; }); }).filter(Boolean);
      return '<a class="btn btn-ghost btn-sm" href="#/teams">← Takımlar</a><section class="panel" style="margin-top:12px"><div class="entity-top">' +
        TH.personAvatar(team) + '<div class="list-main"><h1>' + TH.esc(team.name) + '</h1><p class="muted">' + TH.esc(team.tag) + ' · ' + row.played + ' maç</p></div>' +
        '<button class="btn btn-ghost" type="button" data-action="edit">Düzenle</button><button class="btn btn-danger" type="button" data-action="delete">Sil</button></div>' +
        '<div class="stat-grid" style="margin-top:16px"><article class="stat-card"><div><p class="stat-label">Galibiyet</p><p class="stat-value">' + row.win + '</p></div></article><article class="stat-card"><div><p class="stat-label">Mağlubiyet</p><p class="stat-value">' + row.loss + '</p></div></article><article class="stat-card"><div><p class="stat-label">Oran</p><p class="stat-value">' + row.winRate + '%</p></div></article><article class="stat-card"><div><p class="stat-label">Kupa</p><p class="stat-value">' + row.titles.length + '</p></div></article></div></section>' +
        '<section class="detail-grid" style="margin-top:16px"><article class="panel"><h2>Üyeler</h2>' + (members.length ? members.map(function (p) { return '<a class="list-row" href="#/player/' + p.id + '">' + TH.personAvatar(p) + '<span>' + TH.esc(p.displayName) + '</span></a>'; }).join('') : '<p class="muted">Üye eklenmemiş.</p>') + '</article>' +
        '<article class="panel"><h2>Maçlar</h2>' + (row.history.length ? row.history.slice(0, 10).map(function (item) {
          return '<div class="list-row"><strong>' + TH.esc(item.score) + '</strong><span class="list-main">' + TH.esc(TH.entityName(data, item.opponent)) + '</span><span class="muted">' + TH.esc(item.tournament ? item.tournament.name : '') + '</span></div>';
        }).join('') : '<p class="muted">Henüz maç yok.</p>') +
        '<h2 style="margin-top:16px">Başarılar</h2><p>' + (row.titles.length ? row.titles.map(function (t) { return TH.esc(t.name); }).join(', ') : 'Şampiyonluk yok.') + '</p></article></section>';
    },
    bind: function (root, params) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const team = TH.storage.get().teams.find(function (t) { return t.id === params.id; });
        if (!team) return;
        if (el.dataset.action === 'edit') openTeam(team);
        if (el.dataset.action === 'delete') removeTeam(team);
      });
    }
  };

  function openTeam(existing) {
    const data = TH.storage.get();
    const team = existing || { name: '', tag: '', logo: '', memberIds: [] };
    const checks = data.players.map(function (p) {
      const on = team.memberIds.indexOf(p.id) !== -1;
      return '<label class="check"><input type="checkbox" value="' + p.id + '"' + (on ? ' checked' : '') + '>' + TH.esc(p.displayName) + '</label>';
    }).join('');
    TH.ui.modal({
      title: existing ? 'Takımı düzenle' : 'Yeni takım',
      size: 'wide',
      body: '<div class="form-grid"><label class="field"><span>Takım adı</span><input name="name" maxlength="32" value="' + TH.esc(team.name) + '"></label><label class="field"><span>Kısaltma</span><input name="tag" maxlength="4" value="' + TH.esc(team.tag) + '"></label><label class="field wide"><span>Logo</span><span class="btn file-btn">Görsel seç<input type="file" name="logo" accept="image/*"></span></label><div class="field wide"><span>Üyeler</span><div class="member-checks">' + checks + '</div></div></div>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="save">Kaydet</button>',
      onBind: function (dialog) {
        let logo = team.logo || '';
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        const file = dialog.querySelector('[name="logo"]');
        file.addEventListener('change', function () {
          TH.ui.readImage(file.files[0]).then(function (url) { logo = url; TH.ui.toast('Logo hazır.'); }).catch(function (err) { TH.ui.toast(err.message, 'error'); });
        });
        dialog.querySelector('[data-action="save"]').addEventListener('click', function () {
          const store = TH.storage.get();
          const name = dialog.querySelector('[name="name"]').value.trim();
          const tag = dialog.querySelector('[name="tag"]').value.trim().toUpperCase();
          if (name.length < 2) { TH.ui.toast('Takım adı gerekli.', 'error'); return; }
          if (!/^[A-Z0-9]{2,4}$/.test(tag)) { TH.ui.toast('Kısaltma 2-4 harf veya rakam olmalı.', 'error'); return; }
          const memberIds = Array.prototype.map.call(dialog.querySelectorAll('input[type="checkbox"]:checked'), function (box) { return box.value; });
          if (existing) {
            existing.name = name;
            existing.tag = tag;
            existing.logo = logo;
            existing.memberIds = memberIds;
          } else {
            store.teams.push({ id: TH.uid('team'), name: name, tag: tag, logo: logo, memberIds: memberIds, createdAt: Date.now() });
          }
          TH.storage.commit();
          TH.ui.closeModal();
          TH.ui.toast('Takım kaydedildi.');
          TH.app.refresh();
        });
      }
    });
  }

  function removeTeam(team) {
    const data = TH.storage.get();
    const used = data.tournaments.filter(function (t) { return t.participants.some(function (p) { return p.kind === 'team' && p.id === team.id; }); });
    if (used.length) { TH.ui.toast('Takım bir turnuvada. Önce kadrodan çıkar.', 'error'); return; }
    TH.ui.confirm({ title: 'Takımı sil', message: team.name + ' silinecek.', confirmLabel: 'Sil', danger: true }).then(function (ok) {
      if (!ok) return;
      const fresh = TH.storage.get();
      fresh.teams = fresh.teams.filter(function (t) { return t.id !== team.id; });
      TH.storage.commit();
      TH.ui.toast('Takım silindi.');
      location.hash = '#/teams';
    });
  }
})();
