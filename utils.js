(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});

  let seq = 0;

  function uid(prefix) {
    seq += 1;
    return prefix + '_' + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function norm(value) {
    return String(value || '').toLocaleLowerCase('tr-TR').trim();
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toISODate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDaysISO(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function toLocalInput(date) {
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate()) +
      'T' +
      pad(date.getHours()) +
      ':' +
      pad(date.getMinutes())
    );
  }

  function defaultKickoff(startDate, dayOffset, index) {
    const base = new Date(String(startDate || todayISO()) + 'T18:00:00');
    const date = Number.isNaN(base.getTime()) ? new Date() : base;
    date.setDate(date.getDate() + (dayOffset || 0));
    date.setHours(18, (index % 2) * 30, 0, 0);
    return toLocalInput(date);
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value.length === 10 ? value + 'T00:00:00' : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDay(value) {
    const date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatShort(value) {
    const date = parseDate(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function timeAgo(ts) {
    const delta = Math.max(0, Date.now() - ts);
    const min = Math.floor(delta / 60000);
    if (min < 1) return 'Az önce';
    if (min < 60) return min + ' dk önce';
    const hours = Math.floor(min / 60);
    if (hours < 24) return hours + ' sa önce';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + ' gün önce';
    return formatDay(new Date(ts).toISOString());
  }

  function nextPow2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function copyRef(ref) {
    if (!ref) return null;
    return { id: ref.id, kind: ref.kind };
  }

  function sameRef(a, b) {
    return !!(a && b && a.id === b.id && a.kind === b.kind);
  }

  function byeRef() {
    return { id: 'bye', kind: 'bye' };
  }

  function isBye(ref) {
    return !!(ref && ref.kind === 'bye');
  }

  function isReal(ref) {
    return !!(ref && ref.id && ref.kind !== 'bye');
  }

  function refKey(ref) {
    if (!ref) return '';
    return ref.kind + ':' + ref.id;
  }

  function pairKey(a, b) {
    const ka = refKey(a);
    const kb = refKey(b);
    return ka < kb ? ka + '|' + kb : kb + '|' + ka;
  }

  function hue(str) {
    let h = 0;
    const text = String(str || 't');
    for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function initials(name) {
    const parts = String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2);
    return parts.map(function (p) { return p.charAt(0); }).join('').toLocaleUpperCase('tr-TR') || '?';
  }

  const GAMES = [
    'Valorant',
    'League of Legends',
    'Counter-Strike 2',
    'Dota 2',
    'Rocket League',
    'FIFA',
    'Fortnite',
    'Futbol',
    'Basketbol',
    'Voleybol',
    'Satranç',
    'Diğer'
  ];

  const FORMATS = [
    { id: 'single', name: 'Single Elimination', short: 'Tek Eleme', blurb: 'Kaybeden elenir. Kısa ve net bir şampiyonluk yolu.' },
    { id: 'double', name: 'Double Elimination', short: 'Çift Eleme', blurb: 'İlk yenilgi alt tabloya düşürür. İkinci bir şans vardır.' },
    { id: 'robin', name: 'Round Robin', short: 'Round Robin', blurb: 'Her katılımcı diğerleriyle karşılaşır.' },
    { id: 'swiss', name: 'Swiss System', short: 'İsviçre', blurb: 'Benzer puandaki rakipler eşleşir, kimse hemen elenmez.' },
    { id: 'group', name: 'Group Stage + Knockout', short: 'Grup + Eleme', blurb: 'Grup liderleri ve ikinciler eleme ağacına kalır.' },
    { id: 'league', name: 'League System', short: 'Lig', blurb: 'Haftalar boyunca oynanır, puan tablosu şampiyonu belirler.' }
  ];

  function formatMeta(id) {
    return FORMATS.find(function (f) { return f.id === id; }) || FORMATS[0];
  }

  function gameSlug(game) {
    const map = {
      Valorant: 'valorant',
      'League of Legends': 'lol',
      'Counter-Strike 2': 'cs',
      'Dota 2': 'dota',
      'Rocket League': 'rocket',
      FIFA: 'fifa',
      Fortnite: 'fortnite',
      Futbol: 'football',
      Basketbol: 'basket',
      Voleybol: 'volley',
      Satranç: 'chess',
      Diğer: 'other'
    };
    return map[game] || 'other';
  }

  function statusMeta(status) {
    if (status === 'active') return { label: 'Devam ediyor', cls: 'is-live' };
    if (status === 'completed') return { label: 'Tamamlandı', cls: 'is-done' };
    if (status === 'upcoming') return { label: 'Yaklaşan', cls: 'is-soon' };
    return { label: 'Taslak', cls: 'is-draft' };
  }

  function inviteCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'TH-';
    for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function entityName(db, ref) {
    if (!ref) return 'Belirlenecek';
    if (isBye(ref)) return 'Bay';
    if (ref.kind === 'player') {
      const player = db.players.find(function (p) { return p.id === ref.id; });
      return player ? player.displayName : 'Silinmiş oyuncu';
    }
    if (ref.kind === 'team') {
      const team = db.teams.find(function (t) { return t.id === ref.id; });
      return team ? team.name : 'Silinmiş takım';
    }
    return 'Belirlenecek';
  }

  function entityImage(db, ref) {
    if (!isReal(ref)) return '';
    if (ref.kind === 'player') {
      const player = db.players.find(function (p) { return p.id === ref.id; });
      return player && player.avatar ? player.avatar : '';
    }
    const team = db.teams.find(function (t) { return t.id === ref.id; });
    return team && team.logo ? team.logo : '';
  }

  function avatarHTML(db, ref, nameOverride) {
    if (!ref || isBye(ref)) return '<span class="avatar is-bye">–</span>';
    if (!isReal(ref)) return '<span class="avatar is-tbd">?</span>';
    const name = nameOverride || entityName(db, ref);
    const image = entityImage(db, ref);
    if (image) return '<span class="avatar has-image" style="background-image:url(\'' + esc(image) + '\')"></span>';
    return '<span class="avatar" style="--hue:' + hue(name) + '">' + esc(initials(name)) + '</span>';
  }

  function personAvatar(person) {
    const name = person.displayName || person.name || '?';
    if (person.avatar || person.logo) {
      return '<span class="avatar has-image" style="background-image:url(\'' + esc(person.avatar || person.logo) + '\')"></span>';
    }
    return '<span class="avatar" style="--hue:' + hue(name) + '">' + esc(initials(name)) + '</span>';
  }

  function svg(paths) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  const icons = {
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a2 2 0 0 0 2 3"/><path d="M16 6h3a2 2 0 0 1-2 3"/><path d="M12 13v3"/><path d="M8 20h8"/><path d="M9 17h6"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><path d="m14.8 9.2-1.2 4.4-4.4 1.2 1.2-4.4 4.4-1.2z"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 4.13a3 3 0 0 1 0 5.75"/>'),
    user: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'),
    chart: svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/>'),
    bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: svg('<path d="m5 12 5 5L20 7"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
    trash: svg('<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M8 7l1 13h6l1-13"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"/>'),
    download: svg('<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>'),
    upload: svg('<path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M5 4h14"/>'),
    filter: svg('<path d="M4 5h16l-6 7v6l-4 2v-8L4 5z"/>'),
    shuffle: svg('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    pin: svg('<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/>'),
    spark: svg('<path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3z"/>')
  };

  function toast(message, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const node = document.createElement('div');
    node.className = 'toast toast-' + (type || 'info');
    node.textContent = message;
    root.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('is-in'); });
    setTimeout(function () {
      node.classList.remove('is-in');
      setTimeout(function () { node.remove(); }, 250);
    }, 3400);
    while (root.children.length > 4) root.firstChild.remove();
  }

  let modalSettled = null;

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (modalSettled) {
      const fn = modalSettled;
      modalSettled = null;
      fn();
    }
  }

  function openModal(opts) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    closeModal();
    modalSettled = opts.onDismiss || null;
    root.innerHTML =
      '<div class="modal-backdrop" data-close="1">' +
      '<div class="modal ' + (opts.size ? 'modal-' + opts.size : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<header class="modal-head"><h3 id="modal-title">' + esc(opts.title || '') + '</h3>' +
      '<button class="icon-btn" type="button" data-close="1" aria-label="Kapat">' + icons.close + '</button></header>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<footer class="modal-foot">' + opts.footer + '</footer>' : '') +
      '</div></div>';
    document.body.classList.add('modal-open');
    const dialog = root.querySelector('.modal');
    root.querySelectorAll('[data-close="1"]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        if (event.currentTarget === el && (el.classList.contains('icon-btn') || event.target === el)) {
          if (el.classList.contains('modal-backdrop') && event.target !== el) return;
          closeModal();
        }
      });
    });
    if (opts.onBind) opts.onBind(dialog);
    const field = dialog.querySelector('input, select, textarea, button');
    if (field) field.focus();
  }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      let done = false;
      function finish(value) {
        if (done) return;
        done = true;
        closeModal();
        resolve(value);
      }
      openModal({
        title: opts.title || 'Onay',
        body: '<p class="modal-copy">' + esc(opts.message || '') + '</p>',
        footer:
          '<button class="btn btn-ghost" type="button" data-act="cancel">Vazgeç</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" type="button" data-act="ok">' +
          esc(opts.confirmLabel || 'Onayla') +
          '</button>',
        onBind: function (dialog) {
          dialog.querySelector('[data-act="cancel"]').addEventListener('click', function () { finish(false); });
          dialog.querySelector('[data-act="ok"]').addEventListener('click', function () { finish(true); });
        },
        onDismiss: function () { finish(false); }
      });
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });
  }

  function emptyState(opts) {
    return (
      '<div class="empty">' +
      '<div class="empty-icon">' + (opts.icon || icons.spark) + '</div>' +
      '<h3>' + esc(opts.title) + '</h3>' +
      '<p>' + esc(opts.text || '') + '</p>' +
      (opts.action ? '<button class="btn btn-primary" type="button" data-action="' + esc(opts.action) + '">' + esc(opts.actionLabel || 'Devam') + '</button>' : '') +
      '</div>'
    );
  }

  function pageHead(opts) {
    return (
      '<header class="page-head">' +
      '<div><p class="eyebrow">' + esc(opts.eyebrow || '') + '</p><h1>' + esc(opts.title) + '</h1>' +
      (opts.lede ? '<p class="lede">' + esc(opts.lede) + '</p>' : '') +
      '</div>' +
      (opts.actions ? '<div class="page-actions">' + opts.actions + '</div>' : '') +
      '</header>'
    );
  }

  function readImage(file, maxChars) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve('');
      if (!/^image\//.test(file.type)) return reject(new Error('Yalnızca görsel dosyası seçin.'));
      if (file.size > 700000) return reject(new Error('Görsel 700 KB altında olmalı.'));
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || '');
        if (result.length > (maxChars || 450000)) reject(new Error('Görsel depolama için fazla büyük.'));
        else resolve(result);
      };
      reader.onerror = function () { reject(new Error('Görsel okunamadı.')); };
      reader.readAsDataURL(file);
    });
  }

  TH.uid = uid;
  TH.esc = esc;
  TH.norm = norm;
  TH.todayISO = todayISO;
  TH.addDaysISO = addDaysISO;
  TH.toLocalInput = toLocalInput;
  TH.defaultKickoff = defaultKickoff;
  TH.formatDay = formatDay;
  TH.formatShort = formatShort;
  TH.timeAgo = timeAgo;
  TH.nextPow2 = nextPow2;
  TH.shuffle = shuffle;
  TH.copyRef = copyRef;
  TH.sameRef = sameRef;
  TH.byeRef = byeRef;
  TH.isBye = isBye;
  TH.isReal = isReal;
  TH.refKey = refKey;
  TH.pairKey = pairKey;
  TH.hue = hue;
  TH.initials = initials;
  TH.GAMES = GAMES;
  TH.FORMATS = FORMATS;
  TH.formatMeta = formatMeta;
  TH.gameSlug = gameSlug;
  TH.statusMeta = statusMeta;
  TH.inviteCode = inviteCode;
  TH.download = download;
  TH.entityName = entityName;
  TH.avatarHTML = avatarHTML;
  TH.personAvatar = personAvatar;
  TH.icons = icons;
  TH.ui = {
    toast: toast,
    modal: openModal,
    closeModal: closeModal,
    confirm: confirmDialog,
    empty: emptyState,
    pageHead: pageHead,
    readImage: readImage
  };
})();
