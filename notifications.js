(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});

  function unread(db) {
    return db.notifications.filter(function (n) { return !n.read; }).length;
  }

  TH.views = TH.views || {};
  TH.views.notifications = {
    render: function () {
      const db = TH.storage.get();
      const items = db.notifications;
      return (
        TH.ui.pageHead({
          eyebrow: 'Gelen kutusu',
          title: 'Bildirimler',
          lede: unread(db) ? unread(db) + ' okunmamış bildirim var.' : 'Hepsi okundu.',
          actions: '<button class="btn btn-ghost" type="button" data-action="read-all">Tümünü okundu işaretle</button>'
        }) +
        '<section class="panel">' +
        (items.length ? items.map(function (n) {
          return (
            '<button class="bell-item ' + (n.read ? '' : 'is-unread') + '" type="button" data-action="open-note" data-id="' + TH.esc(n.id) + '">' +
            '<span class="stat-icon">' + TH.icons.bell + '</span><span class="list-main"><strong>' + TH.esc(n.title) + '</strong>' +
            '<span class="muted">' + TH.esc(n.message) + '</span></span><small class="muted">' + TH.esc(TH.timeAgo(n.createdAt)) + '</small></button>'
          );
        }).join('') : TH.ui.empty({ title: 'Bildirim yok', text: 'Skorlar ve turnuva olayları burada toplanır.' })) +
        '</section>'
      );
    },
    bind: function (root) {
      root.addEventListener('click', function (event) {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const db = TH.storage.get();
        if (el.dataset.action === 'read-all') {
          db.notifications.forEach(function (n) { n.read = true; });
          TH.storage.commit();
          TH.app.refresh();
          return;
        }
        const note = db.notifications.find(function (n) { return n.id === el.dataset.id; });
        if (!note) return;
        note.read = true;
        TH.storage.commit();
        if (note.link) location.hash = note.link.replace(/^#/, '#');
        else TH.app.refresh();
      });
    }
  };

  TH.inbox = { unread: unread };
})();
