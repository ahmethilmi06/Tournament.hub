(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  const cal = { cursor: new Date(), selected: TH.todayISO() };

  const NAV = [
    { kicker: 'Genel', items: [
      ['dashboard', '#/dashboard', 'Dashboard', 'dashboard'],
      ['tournaments', '#/tournaments', 'Turnuvalarım', 'trophy'],
      ['discover', '#/discover', 'Turnuva Keşfet', 'compass']
    ]},
    { kicker: 'Yönetim', items: [
      ['teams', '#/teams', 'Takımlar', 'users'],
      ['players', '#/players', 'Oyuncular', 'user'],
      ['calendar', '#/calendar', 'Maç Takvimi', 'calendar'],
      ['rankings', '#/rankings', 'Sıralamalar', 'chart']
    ]},
    { kicker: 'Sistem', items: [
      ['notifications', '#/notifications', 'Bildirimler', 'bell'],
      ['settings', '#/settings', 'Ayarlar', 'settings']
    ]}
  ];

  function parseScore(value) {
    if (!/^\d{1,3}$/.test(String(value).trim())) return null;
    return Number(value);
  }

  TH.actions = {
    askScore: function (matchId) {
      const data = TH.storage.get();
      const match = data.matches.find(function (m) { return m.id === matchId; });
      if (!match) return;
      if (match.autoBye) { TH.ui.toast('Bay geçen maça skor girilmez.', 'error'); return; }
      if (!TH.isReal(match.a) || !TH.isReal(match.b)) { TH.ui.toast('İki taraf da belli değil.', 'error'); return; }
      const locked = !!(match.manualResult && TH.matches.hasDownstreamManual(data, match));
      const tournament = data.tournaments.find(function (t) { return t.id === match.tournamentId; });
      TH.ui.modal({
        title: match.name,
        body:
          '<p class="muted" style="margin-bottom:12px">' + TH.esc(tournament ? tournament.name : '') + '</p>' +
          '<div class="score-grid"><div class="score-side">' + TH.avatarHTML(data, match.a) + '<strong>' + TH.esc(TH.entityName(data, match.a)) + '</strong><input name="scoreA" inputmode="numeric" value="' + (match.scoreA == null ? '' : match.scoreA) + '"' + (locked ? ' disabled' : '') + '></div>' +
          '<strong>-</strong><div class="score-side">' + TH.avatarHTML(data, match.b) + '<strong>' + TH.esc(TH.entityName(data, match.b)) + '</strong><input name="scoreB" inputmode="numeric" value="' + (match.scoreB == null ? '' : match.scoreB) + '"' + (locked ? ' disabled' : '') + '></div></div>' +
          '<p class="field-error" id="score-error">' + (locked ? 'Sonraki maç oynandığı için bu skor kilitli.' : '') + '</p>',
        footer:
          (match.manualResult && !locked ? '<button class="btn btn-ghost" type="button" data-action="revert">Geri al</button>' : '') +
          '<button class="btn btn-ghost" type="button" data-close="2">Vazgeç</button>' +
          (locked ? '' : '<button class="btn btn-primary" type="button" data-action="save">Sonucu onayla</button>'),
        onBind: function (dialog) {
          dialog.querySelector('[data-close="2"]').addEventListener('click', TH.ui.closeModal);
          const save = dialog.querySelector('[data-action="save"]');
          if (save) {
            save.addEventListener('click', function () {
              const scoreA = parseScore(dialog.querySelector('[name="scoreA"]').value);
              const scoreB = parseScore(dialog.querySelector('[name="scoreB"]').value);
              const error = dialog.querySelector('#score-error');
              if (scoreA == null || scoreB == null) { error.textContent = 'İki skor da 0-999 arasında olmalı.'; return; }
              const result = TH.matches.commit(TH.storage.get(), match.id, scoreA, scoreB);
              if (!result.ok) { error.textContent = result.error; return; }
              TH.storage.commit();
              const fresh = TH.storage.get().matches.find(function (m) { return m.id === match.id; });
              TH.ui.closeModal();
              TH.ui.toast(fresh && fresh.held ? 'Skor onaylandı. İlerlet ile sonraki tura yaz.' : 'Skor kaydedildi. Fikstür güncellendi.');
              TH.app.refresh();
            });
          }
          const revert = dialog.querySelector('[data-action="revert"]');
          if (revert) revert.addEventListener('click', function () { TH.ui.closeModal(); TH.actions.revert(match.id); });
        }
      });
    },
    revert: function (matchId) {
      TH.ui.confirm({ title: 'Skoru geri al', message: 'Bu maçın sonucu silinir ve sonraki tur yeniden hesaplanır.', confirmLabel: 'Geri al', danger: true }).then(function (ok) {
        if (!ok) return;
        const result = TH.matches.revert(TH.storage.get(), matchId);
        if (!result.ok) { TH.ui.toast(result.error, 'error'); return; }
        TH.storage.commit();
        TH.ui.toast('Skor geri alındı.');
        TH.app.refresh();
      });
    },
    release: function (matchId) {
      const result = TH.matches.release(TH.storage.get(), matchId);
      if (!result.ok) { TH.ui.toast(result.error, 'error'); return; }
      TH.storage.commit();
      TH.ui.toast('Kazanan sonraki tura yazıldı.');
      TH.app.refresh();
    }
  };

  function searchIndex(query) {
    const data = TH.storage.get();
    const q = TH.norm(query);
    if (!q) return { tournaments: [], players: [], teams: [] };
    return {
      tournaments: data.tournaments.filter(function (t) { return TH.norm(t.name + ' ' + t.game).indexOf(q) !== -1; }).slice(0, 5),
      players: data.players.filter(function (p) { return TH.norm(p.displayName + ' ' + p.username).indexOf(q) !== -1; }).slice(0, 5),
      teams: data.teams.filter(function (t) { return TH.norm(t.name + ' ' + t.tag).indexOf(q) !== -1; }).slice(0, 5)
    };
  }

  TH.views.search = {
    render: function (params) {
      const found = searchIndex(params.q || '');
      const block = function (title, rows, map) {
        return '<section class="panel"><h2>' + title + '</h2>' + (rows.length ? rows.map(map).join('') : '<p class="muted">Sonuç yok.</p>') + '</section>';
      };
      return TH.ui.pageHead({ eyebrow: 'Arama', title: params.q ? params.q : 'Arama', lede: 'Turnuva, oyuncu ve takım sonuçları.' }) +
        '<div class="stack">' +
        block('Turnuvalar', found.tournaments, function (t) { return '<a class="list-row" href="#/tournament/' + t.id + '/overview"><strong>' + TH.esc(t.name) + '</strong><span class="muted">' + TH.esc(t.game) + '</span></a>'; }) +
        block('Oyuncular', found.players, function (p) { return '<a class="list-row" href="#/player/' + p.id + '">' + TH.personAvatar(p) + '<span>' + TH.esc(p.displayName) + '</span></a>'; }) +
        block('Takımlar', found.teams, function (t) { return '<a class="list-row" href="#/team/' + t.id + '">' + TH.personAvatar(t) + '<span>' + TH.esc(t.name) + '</span></a>'; }) +
        '</div>';
    },
    bind: function () {}
  };

  TH.views.calendar = {
    render: function () {
      const data = TH.storage.get();
      const cursor = cal.cursor;
      const label = cursor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      const cells = monthCells(cursor);
      const selectedMatches = matchesOn(data, cal.selected);
      return TH.ui.pageHead({ eyebrow: 'Program', title: 'Maç takvimi', lede: 'Planlanan maçlar gün gün. Skoru buradan da girebilirsin.' }) +
        '<section class="calendar"><article class="panel"><div class="cal-head"><button class="icon-btn" type="button" data-action="prev" aria-label="Önceki ay">‹</button><h2>' + TH.esc(label) + '</h2><button class="icon-btn" type="button" data-action="next" aria-label="Sonraki ay">›</button></div>' +
        '<div class="cal-grid">' + ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('') +
        cells.map(function (day) {
          if (!day) return '<span></span>';
          const key = iso(day);
          const count = matchesOn(data, key).length;
          const cls = (key === TH.todayISO() ? ' is-today' : '') + (key === cal.selected ? ' is-selected' : '');
          return '<button class="cal-cell' + cls + '" type="button" data-action="day" data-date="' + key + '"><strong>' + day.getDate() + '</strong>' + (count ? '<div class="cal-dots">' + '<i></i>'.repeat(Math.min(count, 3)) + '</div>' : '') + '</button>';
        }).join('') + '</div></article><article class="panel"><h2>' + TH.esc(TH.formatDay(cal.selected)) + '</h2>' +
        (selectedMatches.length ? selectedMatches.map(function (m) { return TH.widgets.matchRow(data, m); }).join('') : '<p class="muted">Bu gün için maç yok.</p>') +
        '</article></section>';
    },
    bind: function (root) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'prev') shiftMonth(-1);
        if (el.dataset.action === 'next') shiftMonth(1);
        if (el.dataset.action === 'day') { cal.selected = el.dataset.date; TH.app.refresh(); }
        if (el.dataset.action === 'score') TH.actions.askScore(el.dataset.id);
      });
    }
  };

  function iso(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function shiftMonth(delta) {
    const selected = new Date(cal.selected + 'T12:00:00');
    const cursor = new Date(cal.cursor.getFullYear(), cal.cursor.getMonth() + delta, 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const day = Math.min(selected.getDate() || 1, last);
    cal.cursor = cursor;
    cal.selected = iso(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    TH.app.refresh();
  }

  function monthCells(cursor) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const pad = (first.getDay() + 6) % 7;
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < pad; i += 1) cells.push(null);
    for (let day = 1; day <= total; day += 1) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    return cells;
  }

  function matchesOn(data, key) {
    return data.matches.filter(function (m) {
      return m.scheduledAt && m.scheduledAt.slice(0, 10) === key && m.status !== 'cancelled' && TH.isReal(m.a) && TH.isReal(m.b);
    });
  }

  TH.views.settings = {
    render: function () {
      const data = TH.storage.get();
      const profile = data.settings.profile;
      const players = data.players.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === profile.linkedPlayerId ? ' selected' : '') + '>' + TH.esc(p.displayName) + '</option>';
      }).join('');
      return TH.ui.pageHead({ eyebrow: 'Sistem', title: 'Ayarlar', lede: 'Tema, profil ve yedek buradan yönetilir. Veriler bu tarayıcıda kalır.' }) +
        '<section class="settings-grid"><div class="stack"><article class="panel"><h2>Profil</h2><div class="form-grid" style="margin-top:12px"><label class="field"><span>Görünen ad</span><input id="set-name" value="' + TH.esc(profile.displayName) + '"></label><label class="field"><span>Kullanıcı adı</span><input id="set-user" value="' + TH.esc(profile.username) + '"></label><label class="field wide"><span>Katılırken kullanılacak oyuncu</span><select id="set-player">' + players + '</select></label></div><button class="btn btn-primary" type="button" data-action="save-profile" style="margin-top:12px">Kaydet</button></article>' +
        '<article class="panel"><h2>Görünüm</h2><div class="switch"><div><strong>Açık tema</strong><p class="muted">Varsayılan koyu temadır.</p></div><button class="btn btn-ghost" type="button" data-action="theme">' + (data.settings.theme === 'light' ? 'Koyu yap' : 'Açık yap') + '</button></div>' +
        '<div class="switch"><div><strong>Azaltılmış hareket</strong><p class="muted">Animasyonları kapatır.</p></div><button class="btn btn-ghost" type="button" data-action="motion">' + (data.settings.reduceMotion ? 'Animasyonu aç' : 'Animasyonu kıs') + '</button></div>' +
        '<div class="switch"><div><strong>Bildirim kaydı</strong><p class="muted">Kapalıyken yeni olaylar gelen kutusuna yazılmaz.</p></div><button class="btn btn-ghost" type="button" data-action="notes">' + (data.settings.notificationsEnabled ? 'Kapat' : 'Aç') + '</button></div></article></div>' +
        '<div class="stack"><article class="panel"><h2>Yedek</h2><p class="muted">Bütün turnuva, oyuncu ve maç verisini JSON olarak al veya geri yükle.</p><div class="inline-actions" style="margin-top:12px"><button class="btn btn-primary" type="button" data-action="export">' + TH.icons.download + ' Dışa aktar</button><label class="btn file-btn">' + TH.icons.upload + ' İçe aktar<input id="import-file" type="file" accept="application/json"></label></div></article>' +
        '<article class="panel danger-zone"><h2>Sıfırla</h2><p class="muted">Örnek veriler geri gelir. Mevcut kayıtlar silinir.</p><button class="btn btn-danger" type="button" data-action="reset" style="margin-top:12px">Verileri sıfırla</button></article></div></section>';
    },
    bind: function (root) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const data = TH.storage.get();
        if (el.dataset.action === 'theme') {
          data.settings.theme = data.settings.theme === 'light' ? 'dark' : 'light';
          TH.storage.commit();
          applyShell(data);
          TH.app.refresh();
        }
        if (el.dataset.action === 'motion') {
          data.settings.reduceMotion = !data.settings.reduceMotion;
          TH.storage.commit();
          applyShell(data);
          TH.app.refresh();
        }
        if (el.dataset.action === 'notes') {
          data.settings.notificationsEnabled = !data.settings.notificationsEnabled;
          TH.storage.commit();
          TH.ui.toast(data.settings.notificationsEnabled ? 'Bildirimler açık.' : 'Bildirimler kapalı.');
          TH.app.refresh();
        }
        if (el.dataset.action === 'save-profile') saveProfile(root);
        if (el.dataset.action === 'export') {
          TH.download('tournament-hub-' + TH.todayISO() + '.json', TH.storage.exportText());
          TH.ui.toast('JSON indirildi.');
        }
        if (el.dataset.action === 'reset') {
          TH.ui.confirm({ title: 'Verileri sıfırla', message: 'Bütün turnuvalar silinip örnek veri yüklenecek.', confirmLabel: 'Sıfırla', danger: true }).then(function (ok) {
            if (!ok) return;
            TH.storage.reset();
            applyShell(TH.storage.get());
            TH.ui.toast('Örnek veriler yüklendi.');
            location.hash = '#/dashboard';
          });
        }
      });
      const file = root.querySelector('#import-file');
      if (file) {
        file.addEventListener('change', function () {
          const picked = file.files[0];
          if (!picked) return;
          const reader = new FileReader();
          reader.onload = function () {
            try {
              const json = JSON.parse(String(reader.result || ''));
              if (!json || !Array.isArray(json.tournaments) || !Array.isArray(json.players) || !Array.isArray(json.teams) || !Array.isArray(json.matches)) {
                throw new Error('Dosya turnuva verisi içermiyor.');
              }
              TH.ui.confirm({ title: 'İçe aktar', message: 'Mevcut verinin üzerine yazılacak.', confirmLabel: 'Yükle' }).then(function (ok) {
                if (!ok) return;
                TH.storage.replace(json);
                applyShell(TH.storage.get());
                TH.ui.toast('Veri içe aktarıldı.');
                location.hash = '#/dashboard';
              });
            } catch (err) {
              TH.ui.toast(err.message || 'Dosya okunamadı.', 'error');
            }
          };
          reader.readAsText(picked);
        });
      }
    }
  };

  function saveProfile(root) {
    const data = TH.storage.get();
    const name = root.querySelector('#set-name').value.trim();
    const username = root.querySelector('#set-user').value.trim().toLowerCase();
    if (name.length < 2) { TH.ui.toast('Ad çok kısa.', 'error'); return; }
    if (!/^[a-z0-9_.]{2,20}$/.test(username)) { TH.ui.toast('Kullanıcı adı harf ve rakam olmalı.', 'error'); return; }
    data.settings.profile.displayName = name;
    data.settings.profile.username = username;
    data.settings.profile.linkedPlayerId = root.querySelector('#set-player').value;
    const user = data.users[0];
    if (user) { user.displayName = name; user.username = username; }
    TH.storage.commit();
    applyShell(data);
    TH.ui.toast('Profil kaydedildi.');
    TH.app.refresh();
  }

  function applyShell(data) {
    document.documentElement.setAttribute('data-theme', data.settings.theme || 'dark');
    document.body.classList.toggle('reduce-motion', !!data.settings.reduceMotion);
    const profile = data.settings.profile;
    const name = document.getElementById('profile-name');
    const side = document.getElementById('side-name');
    const role = document.getElementById('profile-role');
    if (name) name.textContent = profile.displayName;
    if (side) side.textContent = profile.displayName;
    if (role) role.textContent = profile.title || 'Organizatör';
    const avatar = '<span class="avatar" style="--hue:' + TH.hue(profile.displayName) + '">' + TH.esc(TH.initials(profile.displayName)) + '</span>';
    const chip = document.getElementById('profile-avatar');
    const sideAv = document.getElementById('side-avatar');
    if (chip) chip.innerHTML = avatar;
    if (sideAv) sideAv.innerHTML = avatar;
    const count = TH.inbox.unread(data);
    document.querySelectorAll('[data-badge]').forEach(function (el) {
      el.textContent = count > 9 ? '9+' : String(count);
      el.hidden = count === 0;
    });
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.innerHTML = data.settings.theme === 'light' ? TH.icons.moon : TH.icons.sun;
  }

  function paintNav(active) {
    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.classList.toggle('is-active', link.dataset.nav === active);
    });
  }

  function renderSearchPanel(query) {
    const panel = document.getElementById('search-panel');
    const found = searchIndex(query);
    const total = found.tournaments.length + found.players.length + found.teams.length;
    if (!query.trim() || !total) { panel.hidden = !query.trim(); panel.innerHTML = query.trim() ? '<p class="muted" style="padding:10px">Sonuç yok</p>' : ''; return; }
    const line = function (href, icon, title, meta) {
      return '<a class="search-item" href="' + href + '">' + icon + '<span class="list-main"><strong>' + TH.esc(title) + '</strong><span class="muted">' + TH.esc(meta) + '</span></span></a>';
    };
    panel.hidden = false;
    panel.innerHTML =
      (found.tournaments.length ? '<div class="search-group">Turnuvalar</div>' + found.tournaments.map(function (t) { return line('#/tournament/' + t.id + '/overview', TH.icons.trophy, t.name, t.game); }).join('') : '') +
      (found.players.length ? '<div class="search-group">Oyuncular</div>' + found.players.map(function (p) { return line('#/player/' + p.id, TH.icons.user, p.displayName, '@' + p.username); }).join('') : '') +
      (found.teams.length ? '<div class="search-group">Takımlar</div>' + found.teams.map(function (t) { return line('#/team/' + t.id, TH.icons.users, t.name, t.tag); }).join('') : '');
  }

  function renderBell() {
    const panel = document.getElementById('bell-panel');
    const data = TH.storage.get();
    const items = data.notifications.slice(0, 6);
    panel.innerHTML = (items.length ? items.map(function (n) {
      return '<button class="bell-item ' + (n.read ? '' : 'is-unread') + '" type="button" data-note="' + n.id + '"><span class="list-main"><strong>' + TH.esc(n.title) + '</strong><span class="muted">' + TH.esc(n.message) + '</span></span></button>';
    }).join('') : '<p class="muted" style="padding:10px">Bildirim yok</p>') + '<a class="btn btn-ghost btn-sm" href="#/notifications" style="width:100%;margin-top:6px">Tüm bildirimler</a>';
    panel.querySelectorAll('[data-note]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const note = TH.storage.get().notifications.find(function (n) { return n.id === btn.dataset.note; });
        if (!note) return;
        note.read = true;
        TH.storage.commit();
        panel.hidden = true;
        if (note.link) location.hash = note.link;
        else TH.app.refresh();
      });
    });
  }

  let paintedKey = '';

  function render() {
    const route = TH.router.current();
    const view = TH.views[route.name];
    const key = route.name + ':' + JSON.stringify(route.params || {});
    const keepScroll = key === paintedKey;
    const scrollY = keepScroll ? window.scrollY : 0;
    paintedKey = key;
    const previous = document.getElementById('view');
    const root = previous.cloneNode(false);
    previous.replaceWith(root);
    paintNav(route.nav);
    try {
      root.innerHTML = view ? view.render(route.params) : TH.ui.empty({ title: 'Sayfa yok', text: 'Bu adres bulunamadı.' });
      root.classList.remove('view-enter');
      void root.offsetWidth;
      root.classList.add('view-enter');
      if (view && view.bind) view.bind(root, route.params);
    } catch (err) {
      console.error(err);
      root.innerHTML = TH.ui.empty({ title: 'Sayfa açılamadı', text: 'Beklenmeyen bir hata oluştu. Sayfayı yenile.' });
    }
    applyShell(TH.storage.get());
    const titles = { dashboard: 'Dashboard', tournaments: 'Turnuvalarım', wizard: 'Yeni turnuva', tournament: 'Turnuva', discover: 'Keşfet', teams: 'Takımlar', team: 'Takım', players: 'Oyuncular', player: 'Oyuncu', calendar: 'Takvim', rankings: 'Sıralamalar', notifications: 'Bildirimler', settings: 'Ayarlar', search: 'Arama' };
    document.title = (titles[route.name] || 'Tournament Hub') + ' · Tournament Hub';
    window.scrollTo(0, scrollY);
  }

  function buildNav() {
    document.getElementById('sidenav').innerHTML = NAV.map(function (group) {
      return '<div class="nav-section"><p class="nav-kicker">' + group.kicker + '</p>' + group.items.map(function (item) {
        const badge = item[0] === 'notifications' ? '<span class="nav-badge" data-badge hidden>0</span>' : '';
        return '<a class="nav-link" href="' + item[1] + '" data-nav="' + item[0] + '">' + TH.icons[item[3]] + '<span class="nav-label">' + item[2] + '</span>' + badge + '</a>';
      }).join('') + '</div>';
    }).join('');
  }

  TH.app = {
    refresh: render,
    render: render,
    navigate: function (path) {
      const next = path.charAt(0) === '#' ? path : '#' + path;
      if (location.hash === next) render();
      else location.hash = next;
    }
  };

  function init() {
    try {
      TH.storage.init();
    } catch (err) {
      console.error(err);
      TH.storage.reset();
    }
    buildNav();
    applyShell(TH.storage.get());
    const search = document.getElementById('global-search');
    const panel = document.getElementById('search-panel');
    search.addEventListener('input', function () { renderSearchPanel(search.value); });
    search.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        const q = search.value.trim();
        panel.hidden = true;
        if (q) location.hash = '#/search/' + encodeURIComponent(q);
      }
    });
    document.getElementById('theme-toggle').addEventListener('click', function () {
      const data = TH.storage.get();
      data.settings.theme = data.settings.theme === 'light' ? 'dark' : 'light';
      TH.storage.commit();
      applyShell(data);
    });
    document.getElementById('bell-btn').addEventListener('click', function (event) {
      event.stopPropagation();
      const bell = document.getElementById('bell-panel');
      bell.hidden = !bell.hidden;
      if (!bell.hidden) renderBell();
    });
    document.getElementById('nav-toggle').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
    document.getElementById('nav-backdrop').addEventListener('click', function () { document.body.classList.remove('nav-open'); });
    document.getElementById('profile-chip').addEventListener('click', function () { location.hash = '#/settings'; });
    document.getElementById('sidebar-user').addEventListener('click', function () { location.hash = '#/settings'; });
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.search')) panel.hidden = true;
      if (!event.target.closest('.bell-wrap')) document.getElementById('bell-panel').hidden = true;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === '/' && !event.target.matches('input, textarea, select')) {
        event.preventDefault();
        search.focus();
      }
    });
    window.addEventListener('hashchange', function () {
      document.body.classList.remove('nav-open');
      render();
    });
    if (!location.hash) location.hash = '#/dashboard';
    else render();
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('is-done');
      setTimeout(function () { boot.remove(); }, 350);
    }
  }

  init();
})();
