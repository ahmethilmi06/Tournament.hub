(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});
  const KEY = 'tournament-hub.v1';
  const memory = { value: null };

  function bucket() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) {
      /* private mode */
    }
    return {
      getItem: function () { return memory.value; },
      setItem: function (_key, value) { memory.value = String(value); },
      removeItem: function () { memory.value = null; }
    };
  }

  let state = null;

  function blank() {
    return {
      version: 1,
      users: [],
      players: [],
      teams: [],
      tournaments: [],
      matches: [],
      notifications: [],
      activities: [],
      settings: {
        theme: 'dark',
        reduceMotion: false,
        sidebarCollapsed: false,
        notificationsEnabled: true,
        userId: 'user_ahmet',
        profile: {
          displayName: 'Ahmet',
          username: 'ahmet',
          title: 'Organizatör',
          linkedPlayerId: 'player_ahmet'
        }
      }
    };
  }

  TH.feed = {
    notify: function (db, partial) {
      if (db.settings && db.settings.notificationsEnabled === false && partial.force !== true) return;
      db.notifications.unshift({
        id: TH.uid('ntf'),
        title: partial.title,
        message: partial.message,
        type: partial.type || 'info',
        link: partial.link || '',
        read: false,
        createdAt: Date.now()
      });
      if (db.notifications.length > 60) db.notifications.length = 60;
    },
    activity: function (db, partial) {
      db.activities.unshift({
        id: TH.uid('act'),
        text: partial.text,
        type: partial.type || 'info',
        tournamentId: partial.tournamentId || null,
        createdAt: Date.now()
      });
      if (db.activities.length > 50) db.activities.length = 50;
    }
  };

  function commit() {
    try {
      bucket().setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      if (TH.ui) TH.ui.toast('Depolama alanı doldu. Büyük görselleri kaldırın veya veriyi dışa aktarın.', 'error');
      return false;
    }
  }

  function update(mutator) {
    const result = mutator(state);
    commit();
    return result;
  }

  function createSeed() {
    const db = blank();
    const P = function (id, displayName, username, bio) {
      return { id: id, displayName: displayName, username: username, avatar: '', bio: bio, createdAt: Date.now() - 86400000 * 40 };
    };
    db.users = [{ id: 'user_ahmet', displayName: 'Ahmet', username: 'ahmet', role: 'organizer' }];
    db.players = [
      P('player_ahmet', 'Ahmet Yılmaz', 'ahmet', 'Kupa organizatörü ve takım kaptanı.'),
      P('player_ece', 'Ece Demir', 'ece', 'Keskin nişancı, sakin finalist.'),
      P('player_mert', 'Mert Kaya', 'mert', 'Oyun kurucu. Tempo onunla gelir.'),
      P('player_zeynep', 'Zeynep Arslan', 'zeynep', 'Strateji masasının sessiz lideri.'),
      P('player_kerem', 'Kerem Şahin', 'kerem', 'Agresif açılışları sever.'),
      P('player_elif', 'Elif Aydın', 'elif', 'Defansif zekâ, temiz kararlar.'),
      P('player_burak', 'Burak Çetin', 'burak', 'Clutch anlarının adamı.'),
      P('player_deniz', 'Deniz Aksoy', 'deniz', 'Her formatta istikrarlı.'),
      P('player_selin', 'Selin Koç', 'selin', 'Takım kimyasını kurar.'),
      P('player_emre', 'Emre Yıldız', 'emre', 'Hızlı ayak, daha hızlı karar.'),
      P('player_aylin', 'Aylin Kurt', 'aylin', 'Lig maçlarının temposunu belirler.'),
      P('player_can', 'Can Öztürk', 'can', 'Finalde soğukkanlı.')
    ];

    const Tm = function (id, name, tag, members) {
      return { id: id, name: name, tag: tag, logo: '', memberIds: members, createdAt: Date.now() - 86400000 * 30 };
    };
    db.teams = [
      Tm('team_nova', 'Nova Pulse', 'NVP', ['player_ahmet', 'player_ece', 'player_mert']),
      Tm('team_kuzey', 'Kuzey Alevi', 'KZA', ['player_zeynep', 'player_kerem']),
      Tm('team_gece', 'Gece Kodu', 'GKD', ['player_elif', 'player_burak']),
      Tm('team_titan', 'Titan Rota', 'TTR', ['player_deniz', 'player_selin']),
      Tm('team_vadi', 'Vadi FK', 'VDF', ['player_emre', 'player_aylin']),
      Tm('team_orbit', 'Orbit', 'ORB', ['player_can', 'player_ece']),
      Tm('team_mavi', 'Mavi Şimşek', 'MVS', ['player_mert', 'player_deniz', 'player_aylin']),
      Tm('team_son', 'Son Darbe', 'SND', ['player_zeynep', 'player_burak', 'player_can'])
    ];

    function teamRef(id) { return { id: id, kind: 'team' }; }
    function playerRef(id) { return { id: id, kind: 'player' }; }

    function makeTournament(partial) {
      return {
        id: partial.id,
        name: partial.name,
        description: partial.description,
        cover: '',
        game: partial.game,
        startDate: TH.addDaysISO(partial.start),
        endDate: TH.addDaysISO(partial.end),
        limit: partial.limit,
        visibility: partial.visibility,
        inviteCode: partial.inviteCode,
        format: partial.format,
        participantKind: partial.kind,
        participants: partial.participants,
        rules: partial.rules,
        status: 'upcoming',
        championId: null,
        championKind: null,
        ownerId: 'user_ahmet',
        swissRounds: 0,
        groups: [],
        createdAt: Date.now() - 86400000 * Math.abs(partial.start),
        updatedAt: Date.now()
      };
    }

    const rules = function (rematch) {
      return { win: 3, draw: 1, loss: 0, duration: partialDuration(rematch), rematch: !!rematch, autoAdvance: true };
    };
    function partialDuration(rematch) { return rematch ? 45 : 30; }

    const neon = makeTournament({
      id: 'trn_neon',
      name: 'Neon Kupa 2026',
      description: 'Sekiz takımlık Valorant eleme kupası. Çeyrek finaller tamamlandı, yarı final eşleşmeleri hazır.',
      game: 'Valorant',
      start: -8,
      end: 12,
      limit: 8,
      visibility: 'public',
      inviteCode: 'TH-NEON',
      format: 'single',
      kind: 'team',
      participants: ['team_nova', 'team_kuzey', 'team_gece', 'team_titan', 'team_vadi', 'team_orbit', 'team_mavi', 'team_son'].map(teamRef),
      rules: rules(false)
    });

    const campus = makeTournament({
      id: 'trn_campus',
      name: 'Kampüs Ligi',
      description: 'Dört takımlık futbol ligi. Puan durumu her skorla birlikte güncellenir.',
      game: 'Futbol',
      start: -14,
      end: 21,
      limit: 6,
      visibility: 'public',
      inviteCode: 'TH-KAMP',
      format: 'league',
      kind: 'team',
      participants: ['team_nova', 'team_kuzey', 'team_gece', 'team_titan'].map(teamRef),
      rules: { win: 3, draw: 1, loss: 0, duration: 60, rematch: false, autoAdvance: true }
    });

    const swiss = makeTournament({
      id: 'trn_swiss',
      name: 'Satranç Swiss Açık',
      description: 'Sekiz oyunculuk İsviçre sistemi. Benzer puanlar aynı turda karşılaşır.',
      game: 'Satranç',
      start: -6,
      end: 10,
      limit: 8,
      visibility: 'public',
      inviteCode: 'TH-SWIS',
      format: 'swiss',
      kind: 'player',
      participants: ['player_ahmet', 'player_ece', 'player_mert', 'player_zeynep', 'player_kerem', 'player_elif', 'player_burak', 'player_deniz'].map(playerRef),
      rules: { win: 1, draw: 0.5, loss: 0, duration: 25, rematch: false, autoAdvance: true }
    });
    swiss.rules.draw = 1;

    const groups = makeTournament({
      id: 'trn_groups',
      name: 'Bahar Grupları',
      description: 'İki grup ve ardından eleme. Grup maçları bitti, yarı finaller sizi bekliyor.',
      game: 'Counter-Strike 2',
      start: -12,
      end: 16,
      limit: 8,
      visibility: 'public',
      inviteCode: 'TH-BAHR',
      format: 'group',
      kind: 'team',
      participants: ['team_nova', 'team_kuzey', 'team_gece', 'team_titan', 'team_vadi', 'team_orbit', 'team_mavi', 'team_son'].map(teamRef),
      rules: rules(false)
    });

    const winter = makeTournament({
      id: 'trn_winter',
      name: 'Kış Şampiyonası',
      description: 'Tamamlanmış Rocket League kupası. Şampiyon, istatistiklere işlendi.',
      game: 'Rocket League',
      start: -40,
      end: -18,
      limit: 4,
      visibility: 'public',
      inviteCode: 'TH-KIS1',
      format: 'single',
      kind: 'player',
      participants: ['player_ahmet', 'player_zeynep', 'player_can', 'player_elif'].map(playerRef),
      rules: rules(false)
    });

    const invite = makeTournament({
      id: 'trn_invite',
      name: 'Davet Kupası',
      description: 'Kod ile katılınan çift eleme turnuvası. İlk maçlar henüz oynanmadı.',
      game: 'League of Legends',
      start: 12,
      end: 28,
      limit: 8,
      visibility: 'private',
      inviteCode: 'TH-LOL4',
      format: 'double',
      kind: 'team',
      participants: ['team_nova', 'team_gece', 'team_orbit', 'team_son'].map(teamRef),
      rules: rules(false)
    });

    db.tournaments = [neon, campus, swiss, groups, winter, invite];

    if (!TH.matches) return db;

    db.tournaments.forEach(function (tournament) {
      const created = TH.matches.generate(tournament);
      created.forEach(function (match) { db.matches.push(match); });
    });

    function playable(match) {
      return TH.matches.isPlayable(match);
    }

    function play(match, scoreA, scoreB) {
      const result = TH.matches.commit(db, match.id, scoreA, scoreB, { silent: true });
      if (!result.ok) throw new Error(result.error + ' · ' + match.name);
    }

    function list(tournamentId, phase, round) {
      return db.matches
        .filter(function (m) {
          return m.tournamentId === tournamentId && m.phase === phase && (round == null || m.round === round);
        })
        .sort(function (a, b) { return a.index - b.index; });
    }

    list('trn_neon', 'winners', 0).forEach(function (match, index) {
      if (!playable(match)) return;
      const table = [[2, 0], [2, 1], [1, 2], [0, 2]];
      play(match, table[index][0], table[index][1]);
    });

    const leagueMatches = db.matches
      .filter(function (m) { return m.tournamentId === 'trn_campus' && playable(m); })
      .sort(function (a, b) { return a.round - b.round || a.index - b.index; })
      .slice(0, 3);
    [[2, 1], [1, 1], [0, 3]].forEach(function (score, index) {
      if (leagueMatches[index]) play(leagueMatches[index], score[0], score[1]);
    });

    list('trn_swiss', 'swiss', 0).forEach(function (match, index) {
      if (!playable(match)) return;
      play(match, index % 2 === 0 ? 1 : 0, index % 2 === 0 ? 0 : 1);
    });
    const swissNext = db.matches.find(function (m) {
      return m.tournamentId === 'trn_swiss' && m.phase === 'swiss' && m.round === 1 && playable(m);
    });
    if (swissNext) play(swissNext, 1, 0);

    const groupQueue = db.matches
      .filter(function (m) { return m.tournamentId === 'trn_groups' && m.phase === 'group' && playable(m); })
      .sort(function (a, b) { return a.round - b.round || a.index - b.index || a.group.localeCompare(b.group); });
    groupQueue.forEach(function (match) {
      const draw = (match.round + match.index) % 5 === 0;
      if (draw) play(match, 1, 1);
      else if ((match.index + match.round) % 2 === 0) play(match, 2, 0);
      else play(match, 0, 2);
    });

    for (let guard = 0; guard < 30 && !winter.championId; guard += 1) {
      const next = db.matches
        .filter(function (m) { return m.tournamentId === 'trn_winter' && playable(m); })
        .sort(function (a, b) { return a.round - b.round || a.index - b.index; })[0];
      if (!next) break;
      if (guard % 2 === 0) play(next, 3, 1);
      else play(next, 1, 2);
    }

    const now = new Date();
    db.matches.forEach(function (match) {
      if (match.status === 'cancelled' || (match.phase === 'reset' && match.status === 'pending')) {
        match.scheduledAt = null;
        return;
      }
      const when = new Date(now);
      if (match.status === 'completed') when.setDate(when.getDate() - 9 + match.round);
      else when.setDate(when.getDate() + 1 + match.round + (match.phase === 'grand' ? 2 : 0));
      when.setHours(18 + (match.index % 3), (match.index % 2) * 30, 0, 0);
      match.scheduledAt = TH.toLocalInput(when);
    });

    const championName = TH.entityName(db, winter.championId ? { id: winter.championId, kind: winter.championKind } : null);
    db.activities = [
      { id: 'act_1', text: 'Neon Kupa yarı final eşleşmeleri netleşti.', type: 'bracket', tournamentId: 'trn_neon', createdAt: Date.now() - 3600000 * 5 },
      { id: 'act_2', text: 'Kampüs Ligi puan durumuna yeni skorlar işlendi.', type: 'score', tournamentId: 'trn_campus', createdAt: Date.now() - 3600000 * 9 },
      { id: 'act_3', text: 'Satranç Swiss Açık ikinci tura geçti.', type: 'round', tournamentId: 'trn_swiss', createdAt: Date.now() - 3600000 * 14 },
      { id: 'act_4', text: 'Bahar Grupları eleme turu oluşturuldu.', type: 'bracket', tournamentId: 'trn_groups', createdAt: Date.now() - 3600000 * 20 },
      { id: 'act_5', text: 'Kış Şampiyonası tamamlandı. Şampiyon: ' + championName + '.', type: 'champion', tournamentId: 'trn_winter', createdAt: Date.now() - 86400000 * 18 }
    ];
    db.notifications = [
      { id: 'ntf_1', title: 'Yarı final hazır', message: 'Neon Kupa çeyrek finalleri bitti. Yarı finalistleri belirleyin.', type: 'match', link: '#/tournament/trn_neon/bracket', read: false, createdAt: Date.now() - 3600000 * 5 },
      { id: 'ntf_2', title: 'Eleme turu açıldı', message: 'Bahar Grupları grup aşamasını tamamladı.', type: 'bracket', link: '#/tournament/trn_groups/bracket', read: false, createdAt: Date.now() - 3600000 * 20 },
      { id: 'ntf_3', title: 'Şampiyon belli oldu', message: championName + ' Kış Şampiyonası’nı kazandı.', type: 'champion', link: '#/tournament/trn_winter/overview', read: true, createdAt: Date.now() - 86400000 * 18 },
      { id: 'ntf_4', title: 'Özel turnuva', message: 'Davet Kupası kodu: TH-LOL4. Katılım henüz açık.', type: 'info', link: '#/tournament/trn_invite/overview', read: false, createdAt: Date.now() - 3600000 * 2 }
    ];

    return db;
  }

  function ensureShape(data) {
    const base = blank();
    data.version = 1;
    ['users', 'players', 'teams', 'tournaments', 'matches', 'notifications', 'activities'].forEach(function (key) {
      if (!Array.isArray(data[key])) data[key] = [];
    });
    data.settings = Object.assign(base.settings, data.settings || {});
    data.settings.profile = Object.assign(base.settings.profile, (data.settings && data.settings.profile) || {});
    return data;
  }

  function init() {
    try {
      const raw = bucket().getItem(KEY);
      if (raw) {
        state = ensureShape(JSON.parse(raw));
        return state;
      }
    } catch (err) {
      state = null;
    }
    state = createSeed();
    commit();
    return state;
  }

  function replace(next) {
    state = ensureShape(next);
    commit();
    return state;
  }

  TH.storage = {
    KEY: KEY,
    init: init,
    get: function () { return state; },
    commit: commit,
    update: update,
    createSeed: createSeed,
    replace: replace,
    reset: function () {
      state = createSeed();
      commit();
      return state;
    },
    exportText: function () {
      return JSON.stringify(state, null, 2);
    }
  };
})();
