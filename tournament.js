(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  TH.views = TH.views || {};

  const listState = { q: '', status: 'all', format: 'all' };
  const discoverState = { q: '', status: 'all' };
  const fixtureState = { filter: 'all', round: 'all' };

  function db() { return TH.storage.get(); }

  function cards(list) {
    const data = db();
    if (!list.length) {
      return TH.ui.empty({ title: 'Turnuva bulunamadı', text: 'Filtreyi temizle veya yeni bir kupa oluştur.', action: 'create', actionLabel: 'Turnuva oluştur' });
    }
    return '<div class="card-grid">' + list.map(function (t) { return TH.widgets.tournamentCard(data, t); }).join('') + '</div>';
  }

  function filteredTournaments() {
    return db().tournaments.filter(function (t) {
      const blob = TH.norm(t.name + ' ' + t.game + ' ' + t.description);
      if (listState.q && blob.indexOf(TH.norm(listState.q)) === -1) return false;
      if (listState.status !== 'all' && t.status !== listState.status) return false;
      if (listState.format !== 'all' && t.format !== listState.format) return false;
      return true;
    }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  function chipRow(current, action) {
    return [
      ['all', 'Tümü'],
      ['active', 'Devam eden'],
      ['upcoming', 'Yaklaşan'],
      ['completed', 'Tamamlanan']
    ].map(function (item) {
      return '<button class="chip ' + (current === item[0] ? 'is-on' : '') + '" type="button" data-action="' + action + '" data-value="' + item[0] + '">' + item[1] + '</button>';
    }).join('');
  }

  TH.views.tournaments = {
    render: function () {
      const options = '<option value="all">Tüm formatlar</option>' + TH.FORMATS.map(function (f) {
        return '<option value="' + f.id + '"' + (listState.format === f.id ? ' selected' : '') + '>' + TH.esc(f.short) + '</option>';
      }).join('');
      return (
        TH.ui.pageHead({
          eyebrow: 'Organizasyon',
          title: 'Turnuvalarım',
          lede: 'Kupalarını, liglerini ve eleme ağaçlarını buradan yönet.',
          actions: '<a class="btn btn-primary" href="#/tournaments/new">' + TH.icons.plus + ' Yeni turnuva</a>'
        }) +
        '<div class="toolbar"><label class="search"><input id="tq" value="' + TH.esc(listState.q) + '" placeholder="Turnuva veya oyun ara">' + TH.icons.search + '</label>' +
        '<div class="chips">' + chipRow(listState.status, 'status') + '</div>' +
        '<select id="tf" aria-label="Format">' + options + '</select></div><div id="results">' + cards(filteredTournaments()) + '</div>'
      );
    },
    bind: function (root) {
      const paint = function () { root.querySelector('#results').innerHTML = cards(filteredTournaments()); };
      root.querySelector('#tq').addEventListener('input', function (event) { listState.q = event.target.value; paint(); });
      root.querySelector('#tf').addEventListener('change', function (event) { listState.format = event.target.value; paint(); });
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'status') { listState.status = el.dataset.value; TH.app.render(); }
        if (el.dataset.action === 'create') location.hash = '#/tournaments/new';
      });
    }
  };

  function discoverGrid() {
    const data = db();
    const list = data.tournaments.filter(function (t) {
      if (t.visibility !== 'public') return false;
      if (discoverState.status !== 'all' && t.status !== discoverState.status) return false;
      return !discoverState.q || TH.norm(t.name + ' ' + t.game).indexOf(TH.norm(discoverState.q)) !== -1;
    });
    if (!list.length) return TH.ui.empty({ title: 'Açık turnuva yok', text: 'Filtreyi genişlet veya herkese açık bir kupa oluştur.' });
    return '<div class="card-grid">' + list.map(function (t) { return discoverCard(data, t); }).join('') + '</div>';
  }

  TH.views.discover = {
    render: function () {
      return (
        TH.ui.pageHead({
          eyebrow: 'Topluluk',
          title: 'Turnuva keşfet',
          lede: 'Herkese açık kupalara katıl veya davet koduyla özel turnuvaya gir.'
        }) +
        '<div class="toolbar"><label class="search"><input id="dq" value="' + TH.esc(discoverState.q) + '" placeholder="Açık turnuva ara">' + TH.icons.search + '</label><div class="chips">' + chipRow(discoverState.status, 'dstatus') + '</div></div>' +
        '<article class="panel" style="margin-bottom:16px"><div class="toolbar" style="margin:0"><input class="inline-input" id="invite-code" placeholder="Davet kodu · TH-XXXX" style="max-width:240px"><button class="btn btn-primary" type="button" data-action="redeem">Koda katıl</button></div></article>' +
        '<div id="dresults">' + discoverGrid() + '</div>'
      );
    },
    bind: function (root) {
      root.querySelector('#dq').addEventListener('input', function (event) {
        discoverState.q = event.target.value;
        root.querySelector('#dresults').innerHTML = discoverGrid();
      });
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'dstatus') { discoverState.status = el.dataset.value; TH.app.render(); }
        if (el.dataset.action === 'join') joinFlow(db().tournaments.find(function (t) { return t.id === el.dataset.id; }), '');
        if (el.dataset.action === 'redeem') {
          const code = root.querySelector('#invite-code').value.trim().toUpperCase();
          const found = db().tournaments.find(function (t) { return t.inviteCode.toUpperCase() === code; });
          if (!found) { TH.ui.toast('Bu kodla turnuva yok.', 'error'); return; }
          joinFlow(found, code);
        }
      });
    }
  };

  function discoverCard(data, tournament) {
    const status = TH.statusMeta(tournament.status);
    return (
      '<article class="t-card"><a href="#/tournament/' + tournament.id + '/overview"><div class="t-cover cover-' + TH.gameSlug(tournament.game) + '"><span class="badge ' + status.cls + '">' + status.label + '</span><span class="pill">' + TH.esc(tournament.game) + '</span></div></a>' +
      '<div class="t-body"><h3>' + TH.esc(tournament.name) + '</h3><p class="muted">' + TH.esc(TH.formatMeta(tournament.format).short) + ' · ' + tournament.participants.length + '/' + tournament.limit + '</p>' +
      '<button class="btn btn-primary btn-sm" type="button" data-action="join" data-id="' + tournament.id + '">Katıl</button></div></article>'
    );
  }

  function defaultWizard() {
    return {
      step: 1,
      name: '',
      description: '',
      cover: '',
      game: 'Valorant',
      startDate: TH.todayISO(),
      endDate: TH.addDaysISO(14),
      limit: 8,
      visibility: 'public',
      format: 'single',
      kind: 'team',
      selected: [],
      rules: { win: 3, draw: 1, loss: 0, duration: 30, rematch: false, autoAdvance: true }
    };
  }

  function wizard() {
    if (!TH.wizard) TH.wizard = defaultWizard();
    return TH.wizard;
  }

  function readWizard(root, state) {
    if (state.step === 1) {
      state.name = value(root, 'name');
      state.description = value(root, 'description');
      state.game = value(root, 'game');
      state.startDate = value(root, 'startDate');
      state.endDate = value(root, 'endDate');
      state.limit = Number(value(root, 'limit'));
      state.visibility = value(root, 'visibility');
    }
    if (state.step === 4) {
      state.rules.win = Number(value(root, 'win'));
      state.rules.draw = Number(value(root, 'draw'));
      state.rules.loss = Number(value(root, 'loss'));
      state.rules.duration = Number(value(root, 'duration'));
      state.rules.rematch = !!root.querySelector('[name="rematch"]').checked;
      state.rules.autoAdvance = !!root.querySelector('[name="autoAdvance"]').checked;
    }
  }

  function value(root, name) {
    const el = root.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  function validateWizard(state, step) {
    if (step === 1 || step === 5) {
      if (state.name.length < 3) return 'Turnuva adı en az 3 karakter olmalı.';
      if (!state.startDate || !state.endDate) return 'Başlangıç ve bitiş tarihi gerekli.';
      if (state.endDate < state.startDate) return 'Bitiş tarihi başlangıçtan önce olamaz.';
      if (!Number.isInteger(state.limit) || state.limit < 2 || state.limit > 32) return 'Katılımcı limiti 2 ile 32 arasında olmalı.';
    }
    if (step === 2 || step === 5) {
      const limitError = TH.matches.formatError(state.format, state.limit);
      if (limitError && state.limit > TH.matches.limits(state.format).max) return limitError;
      if (state.limit < TH.matches.limits(state.format).min) return TH.formatMeta(state.format).short + ' için limit en az ' + TH.matches.limits(state.format).min + ' olmalı.';
    }
    if (step === 3 || step === 5) {
      if (state.selected.length > state.limit) return 'Seçilen katılımcı limiti aşıyor.';
      const countError = TH.matches.formatError(state.format, state.selected.length);
      if (countError) return countError;
    }
    if (step === 4 || step === 5) {
      const r = state.rules;
      if (![r.win, r.draw, r.loss, r.duration].every(function (n) { return Number.isFinite(n); })) return 'Puan ve süre sayı olmalı.';
      if (r.win < r.draw) return 'Galibiyet puanı beraberlikten küçük olamaz.';
      if (r.duration < 5 || r.duration > 240) return 'Maç süresi 5 ile 240 dakika arasında olmalı.';
    }
    return '';
  }

  TH.views.wizard = {
    render: function () {
      const state = wizard();
      const steps = ['Genel', 'Format', 'Katılımcılar', 'Kurallar', 'Önizleme'];
      return (
        TH.ui.pageHead({ eyebrow: 'Yeni kupa', title: 'Turnuva oluştur', lede: 'Beş adımda formatı, kadroyu ve kuralları netleştir.' }) +
        '<div class="steps">' + steps.map(function (label, index) {
          const n = index + 1;
          const cls = n === state.step ? 'is-on' : n < state.step ? 'is-done' : '';
          return '<button class="step ' + cls + '" type="button" data-action="jump" data-step="' + n + '"><i>' + n + '</i>' + label + '</button>';
        }).join('') + '</div><section class="panel" id="wizard-body">' + wizardBody(state) + '</section>'
      );
    },
    bind: function (root) {
      const state = wizard();
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const action = el.dataset.action;
        if (action === 'format') { state.format = el.dataset.value; TH.app.render(); return; }
        if (action === 'kind') {
          if (state.selected.length && state.kind !== el.dataset.value) state.selected = [];
          state.kind = el.dataset.value;
          TH.app.render();
          return;
        }
        if (action === 'add-ref') {
          if (state.selected.length >= state.limit) { TH.ui.toast('Katılımcı limiti doldu.', 'error'); return; }
          state.selected.push({ id: el.dataset.id, kind: state.kind });
          TH.app.render();
          return;
        }
        if (action === 'remove-ref') { state.selected.splice(Number(el.dataset.index), 1); TH.app.render(); return; }
        if (action === 'up' || action === 'down') {
          const i = Number(el.dataset.index);
          const j = action === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= state.selected.length) return;
          const tmp = state.selected[i];
          state.selected[i] = state.selected[j];
          state.selected[j] = tmp;
          TH.app.render();
          return;
        }
        if (action === 'shuffle') { state.selected = TH.shuffle(state.selected); TH.ui.toast('Eşleşme sırası karıştırıldı.'); TH.app.render(); return; }
        if (action === 'new-entity') { openQuickCreate(state); return; }
        if (action === 'invite') { openInvite(state); return; }
        if (action === 'jump') {
          const target = Number(el.dataset.step);
          if (target < state.step) { readWizard(root, state); state.step = target; TH.app.render(); }
          return;
        }
        if (action === 'back') { readWizard(root, state); state.step = Math.max(1, state.step - 1); TH.app.render(); return; }
        if (action === 'next' || action === 'create') {
          readWizard(root, state);
          const error = validateWizard(state, state.step);
          if (error) { TH.ui.toast(error, 'error'); return; }
          if (action === 'next') { state.step += 1; TH.app.render(); return; }
          createTournament(state);
        }
      });
      const file = root.querySelector('[name="cover"]');
      if (file) {
        file.addEventListener('change', function () {
          TH.ui.readImage(file.files[0]).then(function (url) {
            state.cover = url;
            const preview = root.querySelector('.preview-cover');
            if (preview) preview.style.backgroundImage = "url('" + url + "')";
            TH.ui.toast('Görsel eklendi.');
          }).catch(function (err) { TH.ui.toast(err.message, 'error'); });
        });
      }
    }
  };

  function wizardBody(state) {
    if (state.step === 1) {
      return '<div class="form-grid">' +
        field('Turnuva adı', '<input name="name" maxlength="48" required value="' + TH.esc(state.name) + '" placeholder="Neon Kupa">') +
        field('Oyun / spor', '<select name="game">' + TH.GAMES.map(function (g) { return '<option' + (g === state.game ? ' selected' : '') + '>' + TH.esc(g) + '</option>'; }).join('') + '</select>') +
        field('Açıklama', '<textarea name="description" maxlength="400" placeholder="Kısa bir duyuru yaz">' + TH.esc(state.description) + '</textarea>', 'wide') +
        field('Başlangıç', '<input type="date" name="startDate" value="' + TH.esc(state.startDate) + '">') +
        field('Bitiş', '<input type="date" name="endDate" value="' + TH.esc(state.endDate) + '">') +
        field('Katılımcı limiti', '<input type="number" name="limit" min="2" max="32" value="' + state.limit + '">') +
        field('Katılım', '<select name="visibility"><option value="public"' + (state.visibility === 'public' ? ' selected' : '') + '>Herkese açık</option><option value="private"' + (state.visibility === 'private' ? ' selected' : '') + '>Özel</option></select>') +
        '<label class="field wide"><span>Turnuva görseli</span><span class="btn file-btn">Görsel seç<input type="file" name="cover" accept="image/*"></span></label>' +
        '<div class="preview-cover wide cover-' + TH.gameSlug(state.game) + '"' + (state.cover ? ' style="background-image:url(\'' + state.cover + '\')"' : '') + '></div>' +
        navButtons(false, true) + '</div>';
    }
    if (state.step === 2) {
      return '<div class="format-grid">' + TH.FORMATS.map(function (f) {
        return '<button class="format-card ' + (state.format === f.id ? 'is-on' : '') + '" type="button" data-action="format" data-value="' + f.id + '"><strong>' + TH.esc(f.name) + '</strong><small>' + TH.esc(f.blurb) + '</small></button>';
      }).join('') + '</div>' + navButtons(true, true);
    }
    if (state.step === 3) {
      const data = db();
      const pool = state.kind === 'team' ? data.teams : data.players;
      return '<div class="segmented" style="margin-bottom:12px"><button type="button" data-action="kind" data-value="team" class="' + (state.kind === 'team' ? 'is-on' : '') + '">Takım</button><button type="button" data-action="kind" data-value="player" class="' + (state.kind === 'player' ? 'is-on' : '') + '">Oyuncu</button></div>' +
        '<div class="toolbar"><button class="btn btn-soft" type="button" data-action="new-entity">Yeni ekle</button><button class="btn btn-ghost" type="button" data-action="invite">Davet et</button><button class="btn btn-ghost" type="button" data-action="shuffle">' + TH.icons.shuffle + ' Karıştır</button><span class="muted">' + state.selected.length + '/' + state.limit + ' · yaklaşık ' + TH.matches.estimate(state.format, state.selected.length, state.rules.rematch) + ' maç</span></div>' +
        '<div class="picker"><div><h3>Mevcut</h3><div class="picker-list">' + pool.map(function (item) {
          const id = item.id;
          const taken = state.selected.some(function (s) { return s.id === id; });
          const label = item.displayName || item.name;
          return '<button class="pick ' + (taken ? 'is-in' : '') + '" type="button" data-action="add-ref" data-id="' + id + '" ' + (taken ? 'disabled' : '') + '>' + TH.personAvatar(item) + '<span>' + TH.esc(label) + '</span></button>';
        }).join('') + '</div></div><div><h3>Seribaşı sırası</h3><div class="picker-list">' + (state.selected.length ? state.selected.map(function (ref, index) {
          return '<div class="pick"><span class="muted">' + (index + 1) + '</span><span class="list-main">' + TH.esc(TH.entityName(data, ref)) + '</span><button class="icon-btn" type="button" data-action="up" data-index="' + index + '" aria-label="Yukarı">↑</button><button class="icon-btn" type="button" data-action="down" data-index="' + index + '" aria-label="Aşağı">↓</button><button class="icon-btn" type="button" data-action="remove-ref" data-index="' + index + '" aria-label="Çıkar">' + TH.icons.close + '</button></div>';
        }).join('') : '<p class="muted">En az iki katılımcı seç.</p>') + '</div></div></div>' + navButtons(true, true);
    }
    if (state.step === 4) {
      const r = state.rules;
      return '<div class="form-grid">' +
        field('Galibiyet puanı', '<input name="win" type="number" min="0" max="20" value="' + r.win + '">') +
        field('Beraberlik puanı', '<input name="draw" type="number" min="0" max="20" value="' + r.draw + '">') +
        field('Mağlubiyet puanı', '<input name="loss" type="number" min="0" max="20" value="' + r.loss + '">') +
        field('Maç süresi (dk)', '<input name="duration" type="number" min="5" max="240" value="' + r.duration + '">') +
        '<label class="check"><input type="checkbox" name="rematch"' + (r.rematch ? ' checked' : '') + '> Rövanş (lig ve round robin fikstürünü ikiye katlar)</label>' +
        '<label class="check"><input type="checkbox" name="autoAdvance"' + (r.autoAdvance ? ' checked' : '') + '> Eleme kazananı otomatik sonraki tura yazılsın</label>' +
        navButtons(true, true) + '</div>';
    }
    const data = db();
    const rows = [
      ['Ad', state.name],
      ['Oyun', state.game],
      ['Format', TH.formatMeta(state.format).name],
      ['Tarih', TH.formatDay(state.startDate) + ' – ' + TH.formatDay(state.endDate)],
      ['Katılım', state.visibility === 'public' ? 'Herkese açık' : 'Özel'],
      ['Limit', String(state.limit)],
      ['Katılımcı', String(state.selected.length)],
      ['Tahmini maç', String(TH.matches.estimate(state.format, state.selected.length, state.rules.rematch))],
      ['Puan', state.rules.win + ' / ' + state.rules.draw + ' / ' + state.rules.loss],
      ['Süre', state.rules.duration + ' dk']
    ];
    return '<div class="preview-cover cover-' + TH.gameSlug(state.game) + '"' + (state.cover ? ' style="background-image:url(\'' + state.cover + '\')"' : '') + '></div>' +
      '<div class="summary">' + rows.map(function (row) { return '<div><span>' + row[0] + '</span><strong>' + TH.esc(row[1]) + '</strong></div>'; }).join('') + '</div>' +
      '<p style="margin:12px 0">' + state.selected.map(function (ref) { return '<span class="pill">' + TH.esc(TH.entityName(data, ref)) + '</span>'; }).join(' ') + '</p>' +
      '<p class="muted">' + TH.esc(state.description || 'Açıklama eklenmedi.') + '</p>' +
      navButtons(true, false);
  }

  function field(label, control, extra) {
    return '<label class="field ' + (extra || '') + '"><span>' + label + '</span>' + control + '</label>';
  }

  function navButtons(back, next) {
    return '<div class="wide inline-actions" style="margin-top:8px">' +
      (back ? '<button class="btn btn-ghost" type="button" data-action="back">Geri</button>' : '') +
      (next ? '<button class="btn btn-primary" type="button" data-action="next">Devam</button>' : '<button class="btn btn-primary" type="button" data-action="create">Turnuvayı oluştur</button>') +
      '</div>';
  }

  function createTournament(state) {
    const error = validateWizard(state, 5);
    if (error) { TH.ui.toast(error, 'error'); return; }
    const data = db();
    const tournament = {
      id: TH.uid('trn'),
      name: state.name,
      description: state.description,
      cover: state.cover,
      game: state.game,
      startDate: state.startDate,
      endDate: state.endDate,
      limit: state.limit,
      visibility: state.visibility,
      inviteCode: TH.inviteCode(),
      format: state.format,
      participantKind: state.kind,
      participants: state.selected.map(TH.copyRef),
      rules: {
        win: Number(state.rules.win),
        draw: Number(state.rules.draw),
        loss: Number(state.rules.loss),
        duration: Number(state.rules.duration),
        rematch: !!state.rules.rematch,
        autoAdvance: !!state.rules.autoAdvance
      },
      status: 'upcoming',
      championId: null,
      championKind: null,
      ownerId: data.settings.userId,
      swissRounds: 0,
      groups: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    try {
      const matches = TH.matches.generate(tournament);
      data.tournaments.unshift(tournament);
      matches.forEach(function (m) { data.matches.push(m); });
    } catch (err) {
      console.error(err);
      TH.ui.toast('Turnuva oluşturulamadı.', 'error');
      return;
    }
    TH.feed.activity(data, { text: tournament.name + ' oluşturuldu.', type: 'create', tournamentId: tournament.id });
    TH.feed.notify(data, { title: 'Turnuva hazır', message: tournament.name + ' fikstürü kuruldu.', type: 'info', link: '#/tournament/' + tournament.id + '/overview' });
    TH.storage.commit();
    TH.wizard = null;
    TH.ui.toast('Turnuva oluşturuldu.');
    location.hash = '#/tournament/' + tournament.id + '/overview';
  }

  function openQuickCreate(state) {
    const team = state.kind === 'team';
    TH.ui.modal({
      title: team ? 'Takım oluştur' : 'Oyuncu oluştur',
      body: team
        ? '<div class="form-grid"><label class="field"><span>Takım adı</span><input name="name" maxlength="32"></label><label class="field"><span>Kısaltma</span><input name="tag" maxlength="4"></label></div>'
        : '<div class="form-grid"><label class="field"><span>Ad</span><input name="displayName" maxlength="32"></label><label class="field"><span>Kullanıcı adı</span><input name="username" maxlength="20"></label></div>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="save-new">Ekle</button>',
      onBind: function (dialog) {
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        dialog.querySelector('[data-action="save-new"]').addEventListener('click', function () {
          const data = db();
          if (team) {
            const name = dialog.querySelector('[name="name"]').value.trim();
            const tag = dialog.querySelector('[name="tag"]').value.trim().toUpperCase();
            if (name.length < 2) { TH.ui.toast('Takım adı gerekli.', 'error'); return; }
            const item = { id: TH.uid('team'), name: name, tag: tag || 'TM', logo: '', memberIds: [], createdAt: Date.now() };
            data.teams.push(item);
            state.selected.push({ id: item.id, kind: 'team' });
          } else {
            const displayName = dialog.querySelector('[name="displayName"]').value.trim();
            const username = dialog.querySelector('[name="username"]').value.trim().toLowerCase();
            if (displayName.length < 2 || username.length < 2) { TH.ui.toast('Ad ve kullanıcı adı gerekli.', 'error'); return; }
            if (data.players.some(function (p) { return p.username === username; })) { TH.ui.toast('Bu kullanıcı adı alınmış.', 'error'); return; }
            const item = { id: TH.uid('player'), displayName: displayName, username: username, avatar: '', bio: '', createdAt: Date.now() };
            data.players.push(item);
            state.selected.push({ id: item.id, kind: 'player' });
          }
          if (state.selected.length > state.limit) state.selected.pop();
          TH.storage.commit();
          TH.ui.closeModal();
          TH.app.render();
        });
      }
    });
  }

  function openInvite(state) {
    TH.ui.modal({
      title: 'Katılımcı davet et',
      body: '<p class="modal-copy">İsim yaz. Kayıtlıysa eklenir, değilse yeni oyuncu açılır.</p><label class="field"><span>Ad veya kullanıcı adı</span><input name="who"></label>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="send">Davet et</button>',
      onBind: function (dialog) {
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        dialog.querySelector('[data-action="send"]').addEventListener('click', function () {
          const who = dialog.querySelector('[name="who"]').value.trim();
          if (who.length < 2) { TH.ui.toast('İsim çok kısa.', 'error'); return; }
          const data = db();
          let ref = null;
          if (state.kind === 'player') {
            let player = data.players.find(function (p) { return TH.norm(p.username) === TH.norm(who) || TH.norm(p.displayName) === TH.norm(who); });
            if (!player) {
              player = { id: TH.uid('player'), displayName: who, username: TH.norm(who).replace(/\s+/g, '') || TH.uid('u'), avatar: '', bio: '', createdAt: Date.now() };
              data.players.push(player);
            }
            ref = { id: player.id, kind: 'player' };
          } else {
            let team = data.teams.find(function (t) { return TH.norm(t.name) === TH.norm(who); });
            if (!team) {
              team = { id: TH.uid('team'), name: who, tag: 'TM', logo: '', memberIds: [], createdAt: Date.now() };
              data.teams.push(team);
            }
            ref = { id: team.id, kind: 'team' };
          }
          if (!state.selected.some(function (s) { return s.id === ref.id; }) && state.selected.length < state.limit) state.selected.push(ref);
          TH.feed.notify(data, { title: 'Davet oluşturuldu', message: who + ' listeye eklendi.', type: 'info', link: '#/tournaments/new' });
          TH.storage.commit();
          TH.ui.closeModal();
          TH.ui.toast('Davet eklendi.');
          TH.app.render();
        });
      }
    });
  }

  function joinFlow(tournament, code) {
    if (!tournament) return;
    if (tournament.visibility === 'private' && code.toUpperCase() !== tournament.inviteCode.toUpperCase()) {
      TH.ui.toast('Özel turnuva için geçerli davet kodu gerekir.', 'error');
      return;
    }
    const data = db();
    if (!TH.matches.canMutateParticipants(data, tournament)) {
      TH.ui.toast('Skor girildiği için katılım kapandı.', 'error');
      return;
    }
    if (tournament.participantKind === 'player') {
      const id = data.settings.profile.linkedPlayerId;
      if (!data.players.some(function (p) { return p.id === id; })) { TH.ui.toast('Ayarlardan bağlı oyuncu seç.', 'error'); return; }
      addRef(tournament, { id: id, kind: 'player' });
      return;
    }
    const options = data.teams.map(function (t) { return '<option value="' + t.id + '">' + TH.esc(t.name) + '</option>'; }).join('');
    if (!options) { TH.ui.toast('Önce bir takım oluştur.', 'error'); return; }
    TH.ui.modal({
      title: 'Takımınla katıl',
      body: '<label class="field"><span>Takım</span><select name="team">' + options + '</select></label>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="ok">Katıl</button>',
      onBind: function (dialog) {
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        dialog.querySelector('[data-action="ok"]').addEventListener('click', function () {
          const id = dialog.querySelector('[name="team"]').value;
          TH.ui.closeModal();
          addRef(tournament, { id: id, kind: 'team' });
        });
      }
    });
  }

  function addRef(tournament, ref) {
    const data = db();
    if (tournament.participants.length >= tournament.limit) { TH.ui.toast('Limit dolu.', 'error'); return; }
    if (tournament.participants.some(function (p) { return TH.sameRef(p, ref); })) { TH.ui.toast('Zaten listede.', 'error'); return; }
    if (tournament.participantKind !== ref.kind) { TH.ui.toast('Bu turnuva farklı katılım türü kullanıyor.', 'error'); return; }
    tournament.participants.push(TH.copyRef(ref));
    const result = TH.matches.regenerate(data, tournament);
    if (!result.ok) { tournament.participants.pop(); TH.ui.toast(result.error, 'error'); return; }
    TH.feed.activity(data, { text: TH.entityName(data, ref) + ', ' + tournament.name + ' kadrosuna katıldı.', tournamentId: tournament.id });
    TH.storage.commit();
    TH.ui.toast('Katılım kaydedildi.');
    TH.app.refresh();
  }

  const tabs = [
    ['overview', 'Genel Bakış'],
    ['participants', 'Katılımcılar'],
    ['fixtures', 'Fikstür'],
    ['bracket', 'Turnuva Ağacı'],
    ['standings', 'Puan Durumu'],
    ['stats', 'İstatistikler'],
    ['rules', 'Kurallar']
  ];

  TH.views.tournament = {
    render: function (params) {
      const data = db();
      const tournament = data.tournaments.find(function (t) { return t.id === params.id; });
      if (!tournament) return TH.ui.empty({ title: 'Turnuva yok', text: 'Silinmiş veya hiç oluşmamış.', action: 'back-home', actionLabel: 'Dashboard' });
      const tab = tabs.some(function (item) { return item[0] === params.tab; }) ? params.tab : 'overview';
      const status = TH.statusMeta(tournament.status);
      const champ = tournament.championId ? TH.entityName(data, { id: tournament.championId, kind: tournament.championKind }) : 'Belirsiz';
      return (
        '<a class="btn btn-ghost btn-sm" href="#/tournaments">← Turnuvalar</a>' +
        '<section class="hero cover-' + TH.gameSlug(tournament.game) + (tournament.cover ? ' cover-photo' : '') + '"' + (tournament.cover ? ' style="background-image:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.55)),url(\'' + tournament.cover + '\')"' : '') + '>' +
        '<span class="badge ' + status.cls + '">' + status.label + '</span><h1>' + TH.esc(tournament.name) + '</h1><p>' + TH.esc(tournament.description || TH.formatMeta(tournament.format).blurb) + '</p>' +
        '<div class="hero-stats"><div><span>Katılımcı</span><strong>' + tournament.participants.length + '/' + tournament.limit + '</strong></div>' +
        '<div><span>Başlangıç</span><strong>' + TH.esc(TH.formatDay(tournament.startDate)) + '</strong></div>' +
        '<div><span>Format</span><strong>' + TH.esc(TH.formatMeta(tournament.format).short) + '</strong></div>' +
        '<div><span>Şampiyon</span><strong>' + TH.esc(champ) + '</strong></div></div></section>' +
        '<div class="tabs">' + tabs.map(function (item) {
          return '<a class="tab ' + (item[0] === tab ? 'is-on' : '') + '" href="#/tournament/' + tournament.id + '/' + item[0] + '">' + item[1] + '</a>';
        }).join('') + '</div>' + renderTab(data, tournament, tab)
      );
    },
    bind: function (root) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const id = root.querySelector('.hero') ? location.hash.split('/')[2] : '';
        const tournament = db().tournaments.find(function (t) { return t.id === id; }) || db().tournaments.find(function (t) { return location.hash.indexOf(t.id) !== -1; });
        if (el.dataset.action === 'back-home') { location.hash = '#/dashboard'; return; }
        if (!tournament) return;
        handleDetail(el, tournament);
      });
      root.addEventListener('change', function (event) {
        const el = event.target;
        if (el.dataset.action === 'schedule') {
          const result = TH.matches.setSchedule(db(), el.dataset.id, el.value);
          if (!result.ok) { TH.ui.toast(result.error, 'error'); return; }
          TH.storage.commit();
          TH.ui.toast('Maç saati güncellendi.');
        }
        if (el.id === 'fixture-filter' || el.id === 'fixture-round') {
          fixtureState.filter = root.querySelector('#fixture-filter').value;
          fixtureState.round = root.querySelector('#fixture-round').value;
          const slot = root.querySelector('#fixture-list');
          const tournament = currentFromHash();
          if (slot && tournament) slot.innerHTML = fixtureRows(db(), tournament);
        }
      });
    }
  };

  function currentFromHash() {
    const parts = location.hash.split('/');
    return db().tournaments.find(function (t) { return t.id === parts[2]; });
  }

  function handleDetail(el, tournament) {
    const action = el.dataset.action;
    const data = db();
    if (action === 'score') TH.actions.askScore(el.dataset.id);
    if (action === 'revert') TH.actions.revert(el.dataset.id);
    if (action === 'release') TH.actions.release(el.dataset.id);
    if (action === 'copy-code') {
      const text = tournament.inviteCode;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { TH.ui.toast('Kod kopyalandı: ' + text); });
      else TH.ui.toast(text);
    }
    if (action === 'shuffle') {
      if (!TH.matches.canMutateParticipants(data, tournament)) { TH.ui.toast('Skor varken sıra değişmez.', 'error'); return; }
      tournament.participants = TH.shuffle(tournament.participants);
      TH.matches.regenerate(data, tournament);
      TH.storage.commit();
      TH.ui.toast('Eşleşmeler yeniden kuruldu.');
      TH.app.refresh();
    }
    if (action === 'remove-participant') removeParticipant(tournament, el.dataset.id, el.dataset.kind);
    if (action === 'add-participant') openAdd(tournament);
    if (action === 'edit-info') openInfo(tournament);
    if (action === 'edit-rules') openRules(tournament);
    if (action === 'delete') deleteTournament(tournament);
    if (action === 'rollback') {
      const result = TH.matches.rollbackSwiss(data, tournament.id);
      if (!result.ok) { TH.ui.toast(result.error, 'error'); return; }
      TH.storage.commit();
      TH.ui.toast('Son tur geri alındı.');
      TH.app.refresh();
    }
  }

  function renderTab(data, tournament, tab) {
    if (tab === 'overview') return overview(data, tournament);
    if (tab === 'participants') return participants(data, tournament);
    if (tab === 'fixtures') return fixtures(data, tournament);
    if (tab === 'bracket') return '<section class="panel">' + TH.bracket.render(data, tournament) + '</section>';
    if (tab === 'standings') return standings(data, tournament);
    if (tab === 'stats') return stats(data, tournament);
    return rules(tournament);
  }

  function overview(data, tournament) {
    const progress = TH.matches.progress(data, tournament);
    const recent = data.matches.filter(function (m) { return m.tournamentId === tournament.id && m.manualResult; }).sort(function (a, b) { return (b.playedAt || 0) - (a.playedAt || 0); }).slice(0, 4);
    const next = data.matches.filter(function (m) { return m.tournamentId === tournament.id && TH.matches.isPlayable(m); }).slice(0, 4);
    return '<section class="detail-grid"><div class="stack"><article class="panel"><div class="panel-head"><h2>İlerleme</h2><strong>' + progress.done + '/' + progress.total + '</strong></div><div class="progress"><span style="width:' + Math.round(progress.ratio * 100) + '%"></span></div><p class="muted" style="margin-top:8px">' + TH.esc(TH.formatDay(tournament.startDate)) + ' – ' + TH.esc(TH.formatDay(tournament.endDate)) + ' · ' + (tournament.visibility === 'public' ? 'Herkese açık' : 'Özel') + ' · Kod ' + TH.esc(tournament.inviteCode) + '</p></article>' +
      '<article class="panel"><div class="panel-head"><h2>Son maçlar</h2></div>' + (recent.length ? recent.map(function (m) { return TH.widgets.matchRow(data, m); }).join('') : '<p class="muted">Henüz skor yok.</p>') + '</article></div>' +
      '<aside class="stack"><article class="panel"><div class="panel-head"><h2>Sıradaki</h2></div>' + (next.length ? next.map(function (m) { return TH.widgets.matchRow(data, m); }).join('') : '<p class="muted">Oynanacak maç kalmadı.</p>') + '</article>' +
      '<article class="panel"><div class="inline-actions"><button class="btn btn-ghost" type="button" data-action="edit-info">Bilgileri düzenle</button><button class="btn btn-ghost" type="button" data-action="copy-code">Kodu kopyala</button><button class="btn btn-danger" type="button" data-action="delete">Turnuvayı sil</button></div></article></aside></section>';
  }

  function participants(data, tournament) {
    const locked = !TH.matches.canMutateParticipants(data, tournament);
    return '<section class="panel"><div class="panel-head"><h2>Katılımcılar</h2><div class="inline-actions">' +
      (locked ? '<span class="muted">Skor girildiği için kadro kilitli.</span>' : '<button class="btn btn-ghost" type="button" data-action="shuffle">Karıştır</button><button class="btn btn-primary" type="button" data-action="add-participant">Ekle</button>') +
      '</div></div>' + tournament.participants.map(function (ref, index) {
        return '<div class="list-row">' + TH.avatarHTML(data, ref) + '<div class="list-main"><strong>' + (index + 1) + '. ' + TH.esc(TH.entityName(data, ref)) + '</strong><span class="muted">' + (ref.kind === 'team' ? 'Takım' : 'Oyuncu') + '</span></div>' +
          (locked ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-action="remove-participant" data-id="' + ref.id + '" data-kind="' + ref.kind + '">Çıkar</button>') + '</div>';
      }).join('') + '</section>';
  }

  function fixtures(data, tournament) {
    const rounds = {};
    data.matches.forEach(function (m) { if (m.tournamentId === tournament.id) rounds[m.round] = true; });
    const rollback = tournament.format === 'swiss'
      ? '<button class="btn btn-ghost" type="button" data-action="rollback">Son turu geri al</button>'
      : '';
    const filter = fixtureState.filter;
    const round = fixtureState.round;
    return '<section class="panel"><div class="panel-head"><h2>Fikstür</h2>' + rollback + '</div><div class="toolbar"><select id="fixture-filter"><option value="all"' + (filter === 'all' ? ' selected' : '') + '>Tüm durumlar</option><option value="play"' + (filter === 'play' ? ' selected' : '') + '>Skor bekleyen</option><option value="done"' + (filter === 'done' ? ' selected' : '') + '>Tamamlanan</option></select><select id="fixture-round"><option value="all"' + (round === 'all' ? ' selected' : '') + '>Tüm turlar</option>' +
      Object.keys(rounds).map(function (r) { return '<option value="' + r + '"' + (round === r ? ' selected' : '') + '>' + (Number(r) + 1) + '. tur</option>'; }).join('') +
      '</select></div><div id="fixture-list">' + fixtureRows(data, tournament) + '</div></section>';
  }

  function fixtureRows(data, tournament) {
    const rows = data.matches.filter(function (m) {
      if (m.tournamentId !== tournament.id || m.status === 'cancelled') return false;
      if (m.phase === 'reset' && m.status === 'pending') return false;
      if (fixtureState.round !== 'all' && String(m.round) !== fixtureState.round) return false;
      if (fixtureState.filter === 'play') return TH.matches.isPlayable(m) || m.held;
      if (fixtureState.filter === 'done') return m.status === 'completed';
      return true;
    });
    if (!rows.length) return '<p class="muted">Bu filtrede maç yok.</p>';
    return rows.map(function (m) {
      return '<div class="fixture"><div><span class="pill">' + TH.esc(m.name) + '</span><div><input class="inline-input" type="datetime-local" data-action="schedule" data-id="' + m.id + '" value="' + TH.esc(m.scheduledAt || '') + '"></div></div>' +
        '<div class="sides"><div class="side">' + TH.avatarHTML(data, m.a) + '<span>' + TH.esc(TH.entityName(data, m.a)) + '</span></div>' +
        '<div class="score-pill">' + (m.status === 'completed' ? m.scoreA + ' - ' + m.scoreB : 'vs') + '</div>' +
        '<div class="side away"><span>' + TH.esc(TH.entityName(data, m.b)) + '</span>' + TH.avatarHTML(data, m.b) + '</div></div>' +
        '<div class="inline-actions">' + actionsFor(m) + '</div></div>';
    }).join('');
  }

  function actionsFor(match) {
    if (match.autoBye) return '<span class="muted">Bay</span>';
    if (match.held) return '<button class="btn btn-primary btn-sm" type="button" data-action="release" data-id="' + match.id + '">İlerlet</button><button class="btn btn-ghost btn-sm" type="button" data-action="score" data-id="' + match.id + '">Düzenle</button>';
    if (TH.matches.isPlayable(match)) return '<button class="btn btn-primary btn-sm" type="button" data-action="score" data-id="' + match.id + '">Skor gir</button>';
    if (match.manualResult) return '<button class="btn btn-ghost btn-sm" type="button" data-action="score" data-id="' + match.id + '">Düzenle</button><button class="btn btn-ghost btn-sm" type="button" data-action="revert" data-id="' + match.id + '">Geri al</button>';
    return '<span class="muted">Rakip belli değil</span>';
  }

  function tableHTML(data, rows) {
    if (!rows.length) return '<p class="muted">Tablo için katılımcı yok.</p>';
    return '<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Katılımcı</th><th>O</th><th>G</th><th>B</th><th>M</th><th>A</th><th>Y</th><th>Av</th><th>P</th></tr></thead><tbody>' +
      rows.map(function (row, index) {
        return '<tr><td>' + (index + 1) + '</td><td><div class="who">' + TH.avatarHTML(data, row.ref) + TH.esc(TH.entityName(data, row.ref)) + '</div></td><td>' + row.played + '</td><td>' + row.win + '</td><td>' + row.draw + '</td><td>' + row.loss + '</td><td>' + row.sf + '</td><td>' + row.sa + '</td><td>' + (row.sf - row.sa) + '</td><td><strong>' + row.points + '</strong></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function standings(data, tournament) {
    if (tournament.format === 'group') {
      const blocks = (tournament.groups || []).map(function (group) {
        return '<h3 style="margin:12px 0">' + TH.esc(group.name) + '</h3>' + tableHTML(data, TH.matches.standings(data, tournament.id, group.id));
      }).join('');
      return '<section class="panel"><p class="muted">İlk iki sıra eleme turuna kalır. Averaj ve atılan sayı eşitlikte devreye girer.</p>' + blocks + '</section>';
    }
    const note = (tournament.format === 'single' || tournament.format === 'double')
      ? 'Eleme formatında puan tablosu skorlardan hesaplanır. Şampiyonu ağaç belirler.'
      : 'Sıralama puan, averaj ve atılan sayıya göre güncellenir.';
    return '<section class="panel"><p class="muted">' + note + '</p>' + tableHTML(data, TH.matches.standings(data, tournament.id)) + '</section>';
  }

  function stats(data, tournament) {
    const matches = data.matches.filter(function (m) { return m.tournamentId === tournament.id && m.status !== 'cancelled'; });
    const done = matches.filter(function (m) { return m.status === 'completed'; });
    let goals = 0;
    let biggest = null;
    done.forEach(function (m) {
      if (m.scoreA == null) return;
      goals += m.scoreA + m.scoreB;
      const diff = Math.abs(m.scoreA - m.scoreB);
      if (!biggest || diff > biggest.diff) biggest = { match: m, diff: diff };
    });
    const table = TH.matches.standings(data, tournament.id);
    return '<section class="stat-grid">' +
      mini('Maç', matches.length) + mini('Tamamlanan', done.length) + mini('Toplam sayı', goals) + mini('Lider', table[0] ? TH.entityName(data, table[0].ref) : '—') +
      '</section><section class="panel" style="margin-top:16px"><h2>En farklı sonuç</h2><p>' + (biggest ? TH.esc(TH.entityName(data, biggest.match.a) + ' ' + biggest.match.scoreA + '-' + biggest.match.scoreB + ' ' + TH.entityName(data, biggest.match.b)) : 'Henüz skor yok.') + '</p></section>';
  }

  function mini(label, value) {
    return '<article class="stat-card"><div><p class="stat-label">' + label + '</p><p class="stat-value">' + TH.esc(value) + '</p></div></article>';
  }

  function rules(tournament) {
    const r = tournament.rules;
    const items = [
      ['Galibiyet', r.win],
      ['Beraberlik', r.draw],
      ['Mağlubiyet', r.loss],
      ['Süre', r.duration + ' dk'],
      ['Rövanş', r.rematch ? 'Açık' : 'Kapalı'],
      ['Otomatik ilerleme', r.autoAdvance ? 'Açık' : 'Kapalı'],
      ['Davet kodu', tournament.inviteCode],
      ['Görünürlük', tournament.visibility === 'public' ? 'Herkese açık' : 'Özel']
    ];
    return '<section class="panel"><div class="panel-head"><h2>Kurallar</h2><button class="btn btn-ghost" type="button" data-action="edit-rules">Düzenle</button></div><div class="rules-list">' +
      items.map(function (item) { return '<div class="rule"><span>' + item[0] + '</span><strong>' + TH.esc(item[1]) + '</strong></div>'; }).join('') + '</div></section>';
  }

  function removeParticipant(tournament, id, kind) {
    const data = db();
    if (!TH.matches.canMutateParticipants(data, tournament)) { TH.ui.toast('Kadro kilitli.', 'error'); return; }
    tournament.participants = tournament.participants.filter(function (p) { return !(p.id === id && p.kind === kind); });
    const result = TH.matches.regenerate(data, tournament);
    if (!result.ok) { TH.ui.toast(result.error, 'error'); return; }
    TH.storage.commit();
    TH.ui.toast('Katılımcı çıkarıldı.');
    TH.app.refresh();
  }

  function openAdd(tournament) {
    const data = db();
    const pool = tournament.participantKind === 'team' ? data.teams : data.players;
    const options = pool.filter(function (item) {
      return !tournament.participants.some(function (p) { return p.id === item.id; });
    }).map(function (item) {
      return '<option value="' + item.id + '">' + TH.esc(item.displayName || item.name) + '</option>';
    }).join('');
    TH.ui.modal({
      title: 'Katılımcı ekle',
      body: options ? '<label class="field"><span>Seç</span><select name="who">' + options + '</select></label>' : '<p>Eklenecek kayıt kalmadı.</p>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button>' + (options ? '<button class="btn btn-primary" type="button" data-action="ok">Ekle</button>' : ''),
      onBind: function (dialog) {
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        const ok = dialog.querySelector('[data-action="ok"]');
        if (!ok) return;
        ok.addEventListener('click', function () {
          const id = dialog.querySelector('[name="who"]').value;
          TH.ui.closeModal();
          addRef(tournament, { id: id, kind: tournament.participantKind });
        });
      }
    });
  }

  function openInfo(tournament) {
    TH.ui.modal({
      title: 'Turnuva bilgisi',
      body: '<div class="form-grid"><label class="field wide"><span>Ad</span><input name="name" value="' + TH.esc(tournament.name) + '"></label>' +
        '<label class="field wide"><span>Açıklama</span><textarea name="description">' + TH.esc(tournament.description) + '</textarea></label>' +
        '<label class="field"><span>Oyun</span><select name="game">' + TH.GAMES.map(function (g) { return '<option' + (g === tournament.game ? ' selected' : '') + '>' + TH.esc(g) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Limit</span><input name="limit" type="number" min="' + tournament.participants.length + '" max="32" value="' + tournament.limit + '"></label>' +
        '<label class="field"><span>Başlangıç</span><input type="date" name="startDate" value="' + tournament.startDate + '"></label>' +
        '<label class="field"><span>Bitiş</span><input type="date" name="endDate" value="' + tournament.endDate + '"></label>' +
        '<label class="field"><span>Görünürlük</span><select name="visibility"><option value="public"' + (tournament.visibility === 'public' ? ' selected' : '') + '>Herkese açık</option><option value="private"' + (tournament.visibility === 'private' ? ' selected' : '') + '>Özel</option></select></label></div>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="save">Kaydet</button>',
      onBind: function (dialog) {
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        dialog.querySelector('[data-action="save"]').addEventListener('click', function () {
          const name = dialog.querySelector('[name="name"]').value.trim();
          const start = dialog.querySelector('[name="startDate"]').value;
          const end = dialog.querySelector('[name="endDate"]').value;
          const limit = Number(dialog.querySelector('[name="limit"]').value);
          if (name.length < 3) { TH.ui.toast('Ad çok kısa.', 'error'); return; }
          if (end < start) { TH.ui.toast('Tarih aralığı geçersiz.', 'error'); return; }
          if (limit < tournament.participants.length || limit > 32) { TH.ui.toast('Limit, mevcut katılımcıdan küçük olamaz.', 'error'); return; }
          tournament.name = name;
          tournament.description = dialog.querySelector('[name="description"]').value.trim();
          tournament.game = dialog.querySelector('[name="game"]').value;
          tournament.startDate = start;
          tournament.endDate = end;
          tournament.limit = limit;
          tournament.visibility = dialog.querySelector('[name="visibility"]').value;
          tournament.updatedAt = Date.now();
          TH.storage.commit();
          TH.ui.closeModal();
          TH.ui.toast('Bilgiler güncellendi.');
          TH.app.refresh();
        });
      }
    });
  }

  function openRules(tournament) {
    const r = tournament.rules;
    TH.ui.modal({
      title: 'Kuralları düzenle',
      body: '<div class="form-grid"><label class="field"><span>Galibiyet</span><input name="win" type="number" value="' + r.win + '"></label>' +
        '<label class="field"><span>Beraberlik</span><input name="draw" type="number" value="' + r.draw + '"></label>' +
        '<label class="field"><span>Mağlubiyet</span><input name="loss" type="number" value="' + r.loss + '"></label>' +
        '<label class="field"><span>Süre</span><input name="duration" type="number" value="' + r.duration + '"></label>' +
        '<label class="check wide"><input type="checkbox" name="autoAdvance"' + (r.autoAdvance ? ' checked' : '') + '> Otomatik ilerleme</label></div>',
      footer: '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button><button class="btn btn-primary" type="button" data-action="save">Kaydet</button>',
      onBind: function (dialog) {
        dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
        dialog.querySelector('[data-action="save"]').addEventListener('click', function () {
          const win = Number(dialog.querySelector('[name="win"]').value);
          const draw = Number(dialog.querySelector('[name="draw"]').value);
          const loss = Number(dialog.querySelector('[name="loss"]').value);
          const duration = Number(dialog.querySelector('[name="duration"]').value);
          if (win < draw) { TH.ui.toast('Galibiyet puanı beraberlikten küçük olamaz.', 'error'); return; }
          const auto = dialog.querySelector('[name="autoAdvance"]').checked;
          tournament.rules.win = win;
          tournament.rules.draw = draw;
          tournament.rules.loss = loss;
          tournament.rules.duration = duration;
          tournament.rules.autoAdvance = auto;
          if (auto) {
            db().matches.forEach(function (m) { if (m.tournamentId === tournament.id && m.held) m.held = false; });
            TH.matches.refresh(db(), tournament);
          }
          TH.storage.commit();
          TH.ui.closeModal();
          TH.ui.toast('Kurallar güncellendi.');
          TH.app.refresh();
        });
      }
    });
  }

  function deleteTournament(tournament) {
    TH.ui.confirm({
      title: 'Turnuvayı sil',
      message: tournament.name + ' ve bütün maçları kalıcı olarak silinecek.',
      confirmLabel: 'Sil',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      const data = db();
      data.tournaments = data.tournaments.filter(function (t) { return t.id !== tournament.id; });
      data.matches = data.matches.filter(function (m) { return m.tournamentId !== tournament.id; });
      TH.storage.commit();
      TH.ui.toast('Turnuva silindi.');
      location.hash = '#/tournaments';
    });
  }
})();
