(function () {
  'use strict';

  const TH = (window.TH = window.TH || {});

  function copy(ref) { return TH.copyRef(ref); }
  function same(a, b) { return TH.sameRef(a, b); }
  function bye() { return TH.byeRef(); }
  function real(ref) { return TH.isReal(ref); }
  function isBye(ref) { return TH.isBye(ref); }

  function baseMatch(tournament, extra) {
    return {
      id: TH.uid('match'),
      tournamentId: tournament.id,
      phase: extra.phase,
      group: extra.group || null,
      round: extra.round,
      index: extra.index,
      name: extra.name,
      seedA: extra.seedA ? copy(extra.seedA) : null,
      seedB: extra.seedB ? copy(extra.seedB) : null,
      a: extra.seedA ? copy(extra.seedA) : null,
      b: extra.seedB ? copy(extra.seedB) : null,
      scoreA: null,
      scoreB: null,
      winner: null,
      loser: null,
      status: extra.status || (extra.seedA || extra.seedB ? 'scheduled' : 'pending'),
      manualResult: false,
      held: false,
      autoBye: false,
      playedAt: null,
      scheduledAt: extra.scheduledAt || null,
      nextId: null,
      nextSlot: null,
      loserNextId: null,
      loserSlot: null
    };
  }

  function clearResult(match) {
    match.scoreA = null;
    match.scoreB = null;
    match.winner = null;
    match.loser = null;
    match.manualResult = false;
    match.held = false;
    match.autoBye = false;
    match.playedAt = null;
  }

  function bracketPositions(size) {
    let positions = [1, 2];
    while (positions.length < size) {
      const sum = positions.length * 2 + 1;
      const next = [];
      positions.forEach(function (p) { next.push(p, sum - p); });
      positions = next;
    }
    return positions;
  }

  function seedIntoBracket(participants, size) {
    return bracketPositions(size).map(function (seed) {
      return participants[seed - 1] ? copy(participants[seed - 1]) : bye();
    });
  }

  function roundTitle(round, total) {
    const fromEnd = total - round - 1;
    if (fromEnd === 0) return 'Final';
    if (fromEnd === 1) return 'Yarı Final';
    if (fromEnd === 2) return 'Çeyrek Final';
    if (fromEnd === 3) return 'Son 16';
    if (fromEnd === 4) return 'Son 32';
    return round + 1 + '. Tur';
  }

  function linkWinners(rounds) {
    for (let r = 0; r < rounds.length - 1; r += 1) {
      rounds[r].forEach(function (match, index) {
        const dest = rounds[r + 1][Math.floor(index / 2)];
        match.nextId = dest.id;
        match.nextSlot = index % 2 === 0 ? 'A' : 'B';
      });
    }
  }

  function generateSingleStructure(tournament, participants, phase) {
    const field = participants || tournament.participants;
    const size = TH.nextPow2(field.length);
    const slots = seedIntoBracket(field, size);
    const roundsCount = Math.log2(size);
    const rounds = [];
    const matches = [];
    for (let r = 0; r < roundsCount; r += 1) {
      const count = size / Math.pow(2, r + 1);
      const round = [];
      for (let i = 0; i < count; i += 1) {
        const match = baseMatch(tournament, {
          phase: phase || 'winners',
          round: r,
          index: i,
          name: roundTitle(r, roundsCount)
        });
        round.push(match);
        matches.push(match);
      }
      rounds.push(round);
    }
    rounds[0].forEach(function (match, index) {
      match.seedA = copy(slots[index * 2]);
      match.seedB = copy(slots[index * 2 + 1]);
      match.a = copy(match.seedA);
      match.b = copy(match.seedB);
      match.status = 'scheduled';
    });
    linkWinners(rounds);
    return matches;
  }

  function generateDoubleStructure(tournament) {
    const field = tournament.participants;
    const size = Math.max(4, TH.nextPow2(Math.max(2, field.length)));
    const slots = seedIntoBracket(field, size);
    const roundsCount = Math.log2(size);
    const matches = [];
    const wb = [];
    for (let r = 0; r < roundsCount; r += 1) {
      const count = size / Math.pow(2, r + 1);
      const round = [];
      for (let i = 0; i < count; i += 1) {
        const match = baseMatch(tournament, {
          phase: 'winners',
          round: r,
          index: i,
          name: 'Üst Tablo · ' + roundTitle(r, roundsCount)
        });
        round.push(match);
        matches.push(match);
      }
      wb.push(round);
    }
    wb[0].forEach(function (match, index) {
      match.seedA = copy(slots[index * 2]);
      match.seedB = copy(slots[index * 2 + 1]);
      match.a = copy(match.seedA);
      match.b = copy(match.seedB);
      match.status = 'scheduled';
    });
    linkWinners(wb);

    const lb = [];
    for (let i = 0; i < roundsCount - 1; i += 1) {
      const count = Math.max(1, (size / 4) / Math.pow(2, i));
      for (let part = 0; part < 2; part += 1) {
        const round = [];
        for (let j = 0; j < count; j += 1) {
          const match = baseMatch(tournament, {
            phase: 'losers',
            round: lb.length,
            index: j,
            name: 'Alt Tablo · ' + (lb.length + 1) + '. Tur'
          });
          round.push(match);
          matches.push(match);
        }
        lb.push(round);
      }
    }

    wb[0].forEach(function (match, index) {
      const dest = lb[0][Math.floor(index / 2)];
      match.loserNextId = dest.id;
      match.loserSlot = index % 2 === 0 ? 'A' : 'B';
    });
    for (let r = 1; r < roundsCount; r += 1) {
      const destRound = lb[2 * r - 1];
      wb[r].forEach(function (match, index) {
        match.loserNextId = destRound[index].id;
        match.loserSlot = 'B';
      });
    }
    for (let r = 0; r < lb.length - 1; r += 1) {
      if (r % 2 === 0) {
        lb[r].forEach(function (match, index) {
          match.nextId = lb[r + 1][index].id;
          match.nextSlot = 'A';
        });
      } else {
        lb[r].forEach(function (match, index) {
          const dest = lb[r + 1][Math.floor(index / 2)];
          match.nextId = dest.id;
          match.nextSlot = index % 2 === 0 ? 'A' : 'B';
        });
      }
    }

    const grand = baseMatch(tournament, { phase: 'grand', round: 0, index: 0, name: 'Büyük Final' });
    const reset = baseMatch(tournament, { phase: 'reset', round: 0, index: 0, name: 'Büyük Final (Rövanş)', status: 'pending' });
    matches.push(grand, reset);
    const wbFinal = wb[wb.length - 1][0];
    wbFinal.nextId = grand.id;
    wbFinal.nextSlot = 'A';
    lb[lb.length - 1][0].nextId = grand.id;
    lb[lb.length - 1][0].nextSlot = 'B';
    return matches;
  }

  function roundRobinRounds(players) {
    const list = players.map(copy);
    if (list.length < 2) return [];
    if (list.length % 2 === 1) list.push(bye());
    const count = list.length;
    const rounds = count - 1;
    const half = count / 2;
    const fixed = list[0];
    let rest = list.slice(1);
    const out = [];
    for (let r = 0; r < rounds; r += 1) {
      const row = [fixed].concat(rest);
      const pairs = [];
      for (let i = 0; i < half; i += 1) {
        let home = row[i];
        let away = row[count - 1 - i];
        if (r % 2 === 1 && i === 0) {
          const swap = home;
          home = away;
          away = swap;
        }
        pairs.push([home, away]);
      }
      out.push(pairs);
      rest = [rest[rest.length - 1]].concat(rest.slice(0, rest.length - 1));
    }
    return out;
  }

  function finishBye(match) {
    const aBye = isBye(match.a);
    const bBye = isBye(match.b);
    if (!aBye && !bBye) return '';
    if (aBye && bBye) {
      match.status = 'cancelled';
      match.winner = bye();
      match.loser = bye();
      match.autoBye = true;
      match.manualResult = false;
      return 'empty';
    }
    match.winner = copy(aBye ? match.b : match.a);
    match.loser = null;
    match.scoreA = aBye ? 0 : 1;
    match.scoreB = bBye ? 0 : 1;
    match.status = 'completed';
    match.autoBye = true;
    match.manualResult = false;
    return 'bye';
  }

  function tableMatches(tournament, players, phase, group, rematch) {
    let rounds = roundRobinRounds(players);
    if (rematch) {
      const back = rounds.map(function (round) {
        return round.map(function (pair) { return [pair[1], pair[0]]; });
      });
      rounds = rounds.concat(back);
    }
    const matches = [];
    const label = tournament.format === 'league' ? 'Hafta ' : 'Tur ';
    rounds.forEach(function (pairs, round) {
      pairs.forEach(function (pair, index) {
        if (isBye(pair[0]) && isBye(pair[1])) return;
        const match = baseMatch(tournament, {
          phase: phase,
          group: group,
          round: round,
          index: index,
          name: (group ? group + ' · ' : '') + label + (round + 1),
          seedA: pair[0],
          seedB: pair[1]
        });
        if (isBye(match.a) || isBye(match.b)) finishBye(match);
        matches.push(match);
      });
    });
    return matches;
  }

  function splitGroups(participants) {
    const count = Math.max(2, Math.round(participants.length / 4));
    let groupCount = count;
    while (groupCount > 2 && participants.length / groupCount < 3) groupCount -= 1;
    const groups = [];
    for (let i = 0; i < groupCount; i += 1) {
      const id = String.fromCharCode(65 + i);
      groups.push({ id: id, name: 'Grup ' + id, members: [] });
    }
    let cursor = 0;
    let dir = 1;
    participants.forEach(function (participant) {
      groups[cursor].members.push(copy(participant));
      cursor += dir;
      if (cursor >= groups.length) {
        dir = -1;
        cursor = groups.length - 1;
      } else if (cursor < 0) {
        dir = 1;
        cursor = 0;
      }
    });
    return groups;
  }

  function generateGroupStructure(tournament) {
    tournament.groups = splitGroups(tournament.participants);
    let matches = [];
    tournament.groups.forEach(function (group) {
      matches = matches.concat(tableMatches(tournament, group.members, 'group', group.id, false));
    });
    return matches;
  }

  function pairSwiss(list, played) {
    const pairs = [];
    let steps = 0;
    function dfs(remaining) {
      if (remaining.length === 0) return true;
      if (steps > 25000) return false;
      const first = remaining[0];
      for (let i = 1; i < remaining.length; i += 1) {
        steps += 1;
        const other = remaining[i];
        if (played.has(TH.pairKey(first, other))) continue;
        pairs.push([first, other]);
        const next = remaining.filter(function (_item, index) { return index !== 0 && index !== i; });
        if (dfs(next)) return true;
        pairs.pop();
      }
      return false;
    }
    if (!dfs(list.slice())) {
      pairs.length = 0;
      for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
    }
    return pairs;
  }

  function buildSwissRound(db, tournament, round) {
    const table = standings(db, tournament.id);
    let pool = table.map(function (row) { return copy(row.ref); });
    const played = new Set();
    db.matches.forEach(function (match) {
      if (match.tournamentId !== tournament.id || match.phase !== 'swiss') return;
      if (real(match.a) && real(match.b)) played.add(TH.pairKey(match.a, match.b));
    });
    const byeCounts = {};
    db.matches.forEach(function (match) {
      if (match.tournamentId === tournament.id && match.autoBye && match.winner) {
        byeCounts[TH.refKey(match.winner)] = (byeCounts[TH.refKey(match.winner)] || 0) + 1;
      }
    });
    if (pool.length % 2 === 1) {
      const reversed = pool.slice().reverse();
      const choice = reversed.find(function (ref) { return !byeCounts[TH.refKey(ref)]; }) || reversed[0];
      pool = pool.filter(function (ref) { return !same(ref, choice); });
      const byeMatch = baseMatch(tournament, {
        phase: 'swiss',
        round: round,
        index: 99,
        name: 'Tur ' + (round + 1) + ' · Bay',
        seedA: choice,
        seedB: bye(),
        scheduledAt: TH.defaultKickoff(tournament.startDate, round, 0)
      });
      finishBye(byeMatch);
      const pairs = pairSwiss(pool, played);
      const matches = pairs.map(function (pair, index) {
        return baseMatch(tournament, {
          phase: 'swiss',
          round: round,
          index: index,
          name: 'Tur ' + (round + 1),
          seedA: pair[0],
          seedB: pair[1],
          scheduledAt: TH.defaultKickoff(tournament.startDate, round, index)
        });
      });
      matches.push(byeMatch);
      return matches;
    }
    return pairSwiss(pool, played).map(function (pair, index) {
      return baseMatch(tournament, {
        phase: 'swiss',
        round: round,
        index: index,
        name: 'Tur ' + (round + 1),
        seedA: pair[0],
        seedB: pair[1],
        scheduledAt: TH.defaultKickoff(tournament.startDate, round, index)
      });
    });
  }

  function generateSwissStructure(tournament) {
    const count = tournament.participants.length;
    tournament.swissRounds = Math.max(1, Math.ceil(Math.log2(count)));
    const fakeDb = { tournaments: [tournament], matches: [], players: [], teams: [] };
    return buildSwissRound(fakeDb, tournament, 0);
  }

  function stampSchedule(matches, tournament) {
    matches.forEach(function (match) {
      if (match.scheduledAt) return;
      if (match.status === 'cancelled' || (match.phase === 'reset' && match.status === 'pending')) return;
      const extra = match.phase === 'grand' ? 2 : match.phase === 'losers' ? 0 : 0;
      match.scheduledAt = TH.defaultKickoff(tournament.startDate, match.round + extra + (match.phase === 'knockout' ? 3 : 0), match.index);
    });
  }

  function today() { return TH.todayISO(); }

  function deriveStatus(db, tournament) {
    if (tournament.championId) {
      tournament.status = 'completed';
      return;
    }
    const matches = db.matches.filter(function (m) { return m.tournamentId === tournament.id; });
    const played = matches.some(function (m) { return m.manualResult; });
    if (!played && tournament.startDate > today()) tournament.status = 'upcoming';
    else tournament.status = 'active';
  }

  function setChampion(tournament, ref) {
    if (!real(ref)) return;
    tournament.championId = ref.id;
    tournament.championKind = ref.kind;
    tournament.status = 'completed';
  }

  function applyScores(match, scoreA, scoreB) {
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    if (scoreA > scoreB) {
      match.winner = copy(match.a);
      match.loser = copy(match.b);
    } else if (scoreB > scoreA) {
      match.winner = copy(match.b);
      match.loser = copy(match.a);
    } else {
      match.winner = null;
      match.loser = null;
    }
  }

  function pushForward(ctx, match) {
    if (match.winner && match.nextId) {
      const next = ctx.byId.get(match.nextId);
      if (next && next.status !== 'cancelled') {
        if (match.nextSlot === 'B') next.b = copy(match.winner);
        else next.a = copy(match.winner);
        if (next.status === 'pending') next.status = 'scheduled';
      }
    }
    if (match.loserNextId) {
      const next = ctx.byId.get(match.loserNextId);
      if (next) {
        const payload = match.loser ? copy(match.loser) : bye();
        if (match.loserSlot === 'B') next.b = payload;
        else next.a = payload;
        if (next.status === 'pending' || next.status === 'cancelled') next.status = 'scheduled';
      }
    }
    if (match.phase === 'grand') {
      const reset = ctx.matches.find(function (item) { return item.phase === 'reset'; });
      const lowerWon = match.winner && match.b && same(match.winner, match.b);
      if (lowerWon && reset) {
        reset.a = copy(match.a);
        reset.b = copy(match.b);
        reset.status = 'scheduled';
        if (!reset.scheduledAt) reset.scheduledAt = TH.defaultKickoff(ctx.tournament.startDate, 8, 0);
        ctx.tournament.championId = null;
        ctx.tournament.championKind = null;
        ctx.tournament.status = 'active';
      } else {
        if (reset) {
          reset.status = 'cancelled';
          reset.a = null;
          reset.b = null;
        }
        setChampion(ctx.tournament, match.winner);
      }
    } else if (match.phase === 'reset') {
      setChampion(ctx.tournament, match.winner);
    } else if (!match.nextId && (match.phase === 'winners' || match.phase === 'knockout') && match.winner) {
      setChampion(ctx.tournament, match.winner);
    }
  }

  function resolveByes(ctx) {
    let guard = 0;
    let moved = true;
    while (moved && guard < 80) {
      moved = false;
      guard += 1;
      ctx.matches.forEach(function (match) {
        if (match.status === 'completed' || match.status === 'cancelled') return;
        if (!match.a || !match.b) return;
        if (!(isBye(match.a) || isBye(match.b))) return;
        if (finishBye(match)) {
          pushForward(ctx, match);
          moved = true;
        }
      });
    }
  }

  function recomputeElimination(db, tournament, phases) {
    const matches = db.matches.filter(function (m) {
      return m.tournamentId === tournament.id && phases.indexOf(m.phase) !== -1;
    });
    const manuals = matches
      .filter(function (m) { return m.manualResult; })
      .map(function (m) {
        return { id: m.id, scoreA: m.scoreA, scoreB: m.scoreB, playedAt: m.playedAt || 0, held: !!m.held };
      })
      .sort(function (a, b) { return a.playedAt - b.playedAt; });

    tournament.championId = null;
    tournament.championKind = null;

    matches.forEach(function (match) {
      match.a = copy(match.seedA);
      match.b = copy(match.seedB);
      const keepSchedule = match.scheduledAt;
      clearResult(match);
      match.scheduledAt = keepSchedule;
      if (match.phase === 'reset') match.status = 'pending';
      else match.status = match.a || match.b ? 'scheduled' : 'pending';
    });

    const ctx = { matches: matches, tournament: tournament, byId: new Map(matches.map(function (m) { return [m.id, m]; })) };
    resolveByes(ctx);

    manuals.forEach(function (rec) {
      const match = ctx.byId.get(rec.id);
      if (!match || match.status === 'cancelled') return;
      if (!real(match.a) || !real(match.b)) return;
      applyScores(match, rec.scoreA, rec.scoreB);
      match.manualResult = true;
      match.held = rec.held;
      match.playedAt = rec.playedAt;
      match.status = 'completed';
      if (!rec.held && match.winner) pushForward(ctx, match);
      resolveByes(ctx);
    });
    deriveStatus(db, tournament);
  }

  function groupOf(tournament, ref) {
    const groups = tournament.groups || [];
    for (let i = 0; i < groups.length; i += 1) {
      if (groups[i].members.some(function (member) { return same(member, ref); })) return groups[i].id;
    }
    return '';
  }

  function qualify(db, tournament) {
    const winners = [];
    const runners = [];
    (tournament.groups || []).forEach(function (group) {
      const table = standings(db, tournament.id, group.id);
      if (table[0]) winners.push(copy(table[0].ref));
      if (table[1]) runners.push(copy(table[1].ref));
    });
    return winners.concat(runners);
  }

  function recomputeGroup(db, tournament) {
    const groupMatches = db.matches.filter(function (m) {
      return m.tournamentId === tournament.id && m.phase === 'group';
    });
    groupMatches.forEach(function (match) {
      if (match.autoBye && !match.manualResult) return;
      const schedule = match.scheduledAt;
      const manual = match.manualResult;
      const scoreA = match.scoreA;
      const scoreB = match.scoreB;
      const playedAt = match.playedAt;
      const held = match.held;
      match.a = copy(match.seedA);
      match.b = copy(match.seedB);
      clearResult(match);
      match.scheduledAt = schedule;
      if (manual) {
        applyScores(match, scoreA, scoreB);
        match.manualResult = true;
        match.held = held;
        match.playedAt = playedAt;
        match.status = 'completed';
      } else if (isBye(match.a) || isBye(match.b)) {
        finishBye(match);
      } else {
        match.status = 'scheduled';
      }
    });

    const knockoutManual = db.matches.some(function (m) {
      return m.tournamentId === tournament.id && m.phase === 'knockout' && m.manualResult;
    });
    const groupsDone = groupMatches.length > 0 && groupMatches.every(function (m) { return m.status === 'completed'; });

    if (!knockoutManual) {
      db.matches = db.matches.filter(function (m) {
        return !(m.tournamentId === tournament.id && m.phase === 'knockout');
      });
      tournament.championId = null;
      tournament.championKind = null;
      if (groupsDone) {
        const qualified = qualify(db, tournament);
        if (qualified.length >= 2) {
          const ghost = Object.assign({}, tournament, { participants: qualified, format: 'single' });
          const created = generateSingleStructure(ghost, qualified, 'knockout');
          created.forEach(function (match) {
            match.tournamentId = tournament.id;
            match.phase = 'knockout';
            match.scheduledAt = TH.defaultKickoff(tournament.startDate, match.round + 4, match.index);
            db.matches.push(match);
          });
          recomputeElimination(db, tournament, ['knockout']);
          return;
        }
      }
    } else {
      recomputeElimination(db, tournament, ['knockout']);
      return;
    }
    deriveStatus(db, tournament);
  }

  function ensureSwiss(db, tournament) {
    let guard = 0;
    while (guard < tournament.swissRounds + 1) {
      guard += 1;
      const swiss = db.matches.filter(function (m) { return m.tournamentId === tournament.id && m.phase === 'swiss'; });
      if (!swiss.length) break;
      const max = Math.max.apply(null, swiss.map(function (m) { return m.round; }));
      if (max + 1 >= tournament.swissRounds) break;
      const current = swiss.filter(function (m) { return m.round === max; });
      if (!current.every(function (m) { return m.status === 'completed'; })) break;
      buildSwissRound(db, tournament, max + 1).forEach(function (match) { db.matches.push(match); });
    }
  }

  function syncTableChampion(db, tournament) {
    const matches = db.matches.filter(function (m) {
      return m.tournamentId === tournament.id && m.status !== 'cancelled' && (m.phase === 'league' || m.phase === 'robin' || m.phase === 'swiss' || tournament.format === 'league' || tournament.format === 'robin' || tournament.format === 'swiss');
    });
    const relevant = db.matches.filter(function (m) { return m.tournamentId === tournament.id && m.status !== 'cancelled'; });
    let complete = false;
    if (tournament.format === 'swiss') {
      const rounds = {};
      relevant.forEach(function (m) { rounds[m.round] = true; });
      complete = Object.keys(rounds).length >= tournament.swissRounds && relevant.every(function (m) { return m.status === 'completed'; });
    } else {
      complete = relevant.length > 0 && relevant.every(function (m) { return m.status === 'completed'; });
    }
    if (complete) {
      const table = standings(db, tournament.id);
      if (table[0]) setChampion(tournament, table[0].ref);
      else deriveStatus(db, tournament);
    } else {
      tournament.championId = null;
      tournament.championKind = null;
      deriveStatus(db, tournament);
    }
    return matches;
  }

  function findMatch(db, id) {
    return db.matches.find(function (m) { return m.id === id; });
  }

  function findTournament(db, id) {
    return db.tournaments.find(function (t) { return t.id === id; });
  }

  function eliminationPhase(phase) {
    return phase === 'winners' || phase === 'losers' || phase === 'grand' || phase === 'reset' || phase === 'knockout';
  }

  function hasDownstreamManual(db, match) {
    const seen = {};
    const stack = [];
    if (match.nextId) stack.push(match.nextId);
    if (match.loserNextId) stack.push(match.loserNextId);
    while (stack.length) {
      const id = stack.pop();
      if (seen[id]) continue;
      seen[id] = true;
      const next = findMatch(db, id);
      if (!next) continue;
      if (next.manualResult) return true;
      if (next.nextId) stack.push(next.nextId);
      if (next.loserNextId) stack.push(next.loserNextId);
    }
    if (match.phase === 'grand') {
      return db.matches.some(function (m) {
        return m.tournamentId === match.tournamentId && m.phase === 'reset' && m.manualResult;
      });
    }
    return false;
  }

  function isPlayable(match) {
    return !!(match && match.status !== 'completed' && match.status !== 'cancelled' && real(match.a) && real(match.b));
  }

  function validateScore(db, match, scoreA, scoreB) {
    if (!match) return 'Maç bulunamadı.';
    if (match.status === 'cancelled') return 'Bu maç iptal edildi.';
    if (match.autoBye) return 'Bay geçen tarafa skor girilmez.';
    if (!real(match.a) || !real(match.b)) return 'İki taraf da belli olmadan skor girilemez.';
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 999 || scoreB > 999) {
      return 'Skor 0 ile 999 arasında bir tam sayı olmalı.';
    }
    const tournament = findTournament(db, match.tournamentId);
    if (!tournament) return 'Turnuva bulunamadı.';
    if (eliminationPhase(match.phase) && scoreA === scoreB) return 'Eleme maçında beraberlik olamaz.';
    if (hasDownstreamManual(db, match)) return 'Sonraki maç oynanmış. Önce onun skorunu geri alın.';
    if (tournament.format === 'swiss') {
      const later = db.matches.some(function (m) {
        return m.tournamentId === tournament.id && m.phase === 'swiss' && m.round > match.round;
      });
      if (later) return 'Sonraki tur hazır. Önce son turu geri alın.';
    }
    if (tournament.format === 'group' && match.phase === 'group') {
      const locked = db.matches.some(function (m) {
        return m.tournamentId === tournament.id && m.phase === 'knockout' && m.manualResult;
      });
      if (locked) return 'Eleme turu başladığı için grup skorları kilitli.';
    }
    return '';
  }

  function announce(db, tournament, match, prevChampion, silent) {
    if (silent) return;
    const left = TH.entityName(db, match.a);
    const right = TH.entityName(db, match.b);
    const score = match.scoreA + ' - ' + match.scoreB;
    TH.feed.activity(db, {
      text: tournament.name + ': ' + left + ' ' + score + ' ' + right + '.',
      type: 'score',
      tournamentId: tournament.id
    });
    TH.feed.notify(db, {
      title: 'Skor işlendi',
      message: left + ' ' + score + ' ' + right + ' · ' + match.name,
      type: 'match',
      link: '#/tournament/' + tournament.id + '/fixtures'
    });
    if (tournament.championId && tournament.championId !== prevChampion) {
      const champ = TH.entityName(db, { id: tournament.championId, kind: tournament.championKind });
      TH.feed.activity(db, {
        text: tournament.name + ' tamamlandı. Şampiyon: ' + champ + '.',
        type: 'champion',
        tournamentId: tournament.id
      });
      TH.feed.notify(db, {
        title: 'Şampiyon belli oldu',
        message: champ + ', ' + tournament.name + ' şampiyonu.',
        type: 'champion',
        link: '#/tournament/' + tournament.id + '/overview'
      });
    }
  }

  function afterWrite(db, tournament) {
    if (tournament.format === 'single') recomputeElimination(db, tournament, ['winners']);
    else if (tournament.format === 'double') recomputeElimination(db, tournament, ['winners', 'losers', 'grand', 'reset']);
    else if (tournament.format === 'group') recomputeGroup(db, tournament);
    else if (tournament.format === 'swiss') {
      ensureSwiss(db, tournament);
      syncTableChampion(db, tournament);
    } else {
      syncTableChampion(db, tournament);
    }
  }

  function commit(db, matchId, scoreA, scoreB, opts) {
    const match = findMatch(db, matchId);
    const error = validateScore(db, match, scoreA, scoreB);
    if (error) return { ok: false, error: error };
    const tournament = findTournament(db, match.tournamentId);
    const prevChampion = tournament.championId;
    const hold = eliminationPhase(match.phase) && tournament.rules && tournament.rules.autoAdvance === false;
    match.manualResult = true;
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.playedAt = match.playedAt || Date.now();
    match.held = hold;
    applyScores(match, scoreA, scoreB);
    match.status = 'completed';
    afterWrite(db, tournament);
    tournament.updatedAt = Date.now();
    const fresh = findMatch(db, matchId);
    announce(db, tournament, fresh || match, prevChampion, opts && opts.silent);
    return { ok: true };
  }

  function revert(db, matchId) {
    const match = findMatch(db, matchId);
    if (!match) return { ok: false, error: 'Maç bulunamadı.' };
    if (match.autoBye) return { ok: false, error: 'Bay maçı geri alınamaz.' };
    if (!match.manualResult) return { ok: false, error: 'Bu maçın skoru yok.' };
    if (hasDownstreamManual(db, match)) return { ok: false, error: 'Sonraki maç oynanmış. Önce onu geri alın.' };
    const tournament = findTournament(db, match.tournamentId);
    if (tournament.format === 'swiss') {
      const later = db.matches.some(function (m) {
        return m.tournamentId === tournament.id && m.phase === 'swiss' && m.round > match.round;
      });
      if (later) return { ok: false, error: 'Sonraki tur duruyor. Önce son turu geri alın.' };
    }
    if (tournament.format === 'group' && match.phase === 'group') {
      const locked = db.matches.some(function (m) {
        return m.tournamentId === tournament.id && m.phase === 'knockout' && m.manualResult;
      });
      if (locked) return { ok: false, error: 'Eleme skorları varken grup sonucu geri alınamaz.' };
    }
    const schedule = match.scheduledAt;
    match.manualResult = false;
    clearResult(match);
    match.scheduledAt = schedule;
    match.a = copy(match.seedA);
    match.b = copy(match.seedB);
    match.status = 'scheduled';
    afterWrite(db, tournament);
    tournament.updatedAt = Date.now();
    return { ok: true };
  }

  function release(db, matchId) {
    const match = findMatch(db, matchId);
    if (!match || !match.held) return { ok: false, error: 'İlerletilecek onaylı skor yok.' };
    const tournament = findTournament(db, match.tournamentId);
    const prev = tournament.championId;
    match.held = false;
    afterWrite(db, tournament);
    announce(db, tournament, findMatch(db, matchId) || match, prev, false);
    return { ok: true };
  }

  function rollbackSwiss(db, tournamentId) {
    const tournament = findTournament(db, tournamentId);
    if (!tournament || tournament.format !== 'swiss') return { ok: false, error: 'Bu turnuva İsviçre sisteminde değil.' };
    const swiss = db.matches.filter(function (m) { return m.tournamentId === tournamentId && m.phase === 'swiss'; });
    if (!swiss.length) return { ok: false, error: 'Silinecek tur yok.' };
    const max = Math.max.apply(null, swiss.map(function (m) { return m.round; }));
    if (max === 0) return { ok: false, error: 'İlk tur silinemez.' };
    const round = swiss.filter(function (m) { return m.round === max; });
    if (round.some(function (m) { return m.manualResult; })) return { ok: false, error: 'Son turda skor var. Önce skorları geri alın.' };
    db.matches = db.matches.filter(function (m) {
      return !(m.tournamentId === tournamentId && m.phase === 'swiss' && m.round === max);
    });
    syncTableChampion(db, tournament);
    return { ok: true };
  }

  function generate(tournament) {
    let matches = [];
    if (tournament.format === 'single') matches = generateSingleStructure(tournament);
    else if (tournament.format === 'double') {
      if (tournament.participants.length < 2) return [];
      matches = generateDoubleStructure(tournament);
    } else if (tournament.format === 'robin') matches = tableMatches(tournament, tournament.participants, 'robin', null, !!tournament.rules.rematch);
    else if (tournament.format === 'league') matches = tableMatches(tournament, tournament.participants, 'league', null, !!tournament.rules.rematch);
    else if (tournament.format === 'swiss') matches = generateSwissStructure(tournament);
    else if (tournament.format === 'group') matches = generateGroupStructure(tournament);
    const db = { tournaments: [tournament], matches: matches, players: [], teams: [], notifications: [], activities: [] };
    if (tournament.format === 'single') recomputeElimination(db, tournament, ['winners']);
    else if (tournament.format === 'double') recomputeElimination(db, tournament, ['winners', 'losers', 'grand', 'reset']);
    else deriveStatus(db, tournament);
    stampSchedule(db.matches, tournament);
    return db.matches;
  }

  function standings(db, tournamentId, groupId) {
    const tournament = findTournament(db, tournamentId);
    if (!tournament) return [];
    const rules = tournament.rules || { win: 3, draw: 1, loss: 0 };
    let source = tournament.participants;
    if (groupId) {
      const group = (tournament.groups || []).find(function (g) { return g.id === groupId; });
      source = group ? group.members : [];
    }
    const rows = source.map(function (ref, index) {
      return {
        ref: copy(ref),
        seed: index,
        played: 0,
        win: 0,
        draw: 0,
        loss: 0,
        points: 0,
        sf: 0,
        sa: 0,
        bye: 0
      };
    });
    const map = {};
    rows.forEach(function (row) { map[TH.refKey(row.ref)] = row; });

    db.matches.forEach(function (match) {
      if (match.tournamentId !== tournamentId || match.status !== 'completed') return;
      if (groupId && match.group !== groupId) return;
      if (!groupId && tournament.format === 'group' && match.phase !== 'group') return;
      const rowA = real(match.a) ? map[TH.refKey(match.a)] : null;
      const rowB = real(match.b) ? map[TH.refKey(match.b)] : null;
      if (isBye(match.b) && rowA) {
        rowA.played += 1; rowA.win += 1; rowA.bye += 1; rowA.points += Number(rules.win); rowA.sf += match.scoreA || 0;
        return;
      }
      if (isBye(match.a) && rowB) {
        rowB.played += 1; rowB.win += 1; rowB.bye += 1; rowB.points += Number(rules.win); rowB.sf += match.scoreB || 0;
        return;
      }
      if (!rowA || !rowB) return;
      rowA.played += 1;
      rowB.played += 1;
      rowA.sf += match.scoreA;
      rowA.sa += match.scoreB;
      rowB.sf += match.scoreB;
      rowB.sa += match.scoreA;
      if (match.scoreA === match.scoreB) {
        rowA.draw += 1; rowB.draw += 1;
        rowA.points += Number(rules.draw); rowB.points += Number(rules.draw);
      } else if (match.scoreA > match.scoreB) {
        rowA.win += 1; rowB.loss += 1;
        rowA.points += Number(rules.win); rowB.points += Number(rules.loss);
      } else {
        rowB.win += 1; rowA.loss += 1;
        rowB.points += Number(rules.win); rowA.points += Number(rules.loss);
      }
    });

    return rows.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      const diff = (b.sf - b.sa) - (a.sf - a.sa);
      if (diff) return diff;
      if (b.sf !== a.sf) return b.sf - a.sf;
      if (b.win !== a.win) return b.win - a.win;
      return a.seed - b.seed;
    });
  }

  function canMutateParticipants(db, tournament) {
    return !db.matches.some(function (m) { return m.tournamentId === tournament.id && m.manualResult; });
  }

  function regenerate(db, tournament) {
    if (!canMutateParticipants(db, tournament)) {
      return { ok: false, error: 'Skor girilmiş turnuvanın fikstürü yeniden kurulamaz.' };
    }
    db.matches = db.matches.filter(function (m) { return m.tournamentId !== tournament.id; });
    tournament.championId = null;
    tournament.championKind = null;
    tournament.groups = [];
    generate(tournament).forEach(function (match) { db.matches.push(match); });
    return { ok: true };
  }

  function limits(format) {
    if (format === 'double') return { min: 4, max: 32 };
    if (format === 'group') return { min: 4, max: 16 };
    if (format === 'swiss') return { min: 4, max: 16 };
    if (format === 'robin' || format === 'league') return { min: 2, max: 12 };
    return { min: 2, max: 32 };
  }

  function formatError(format, count) {
    const bound = limits(format);
    if (count < bound.min) return TH.formatMeta(format).short + ' için en az ' + bound.min + ' katılımcı gerekir.';
    if (count > bound.max) return TH.formatMeta(format).short + ' için en fazla ' + bound.max + ' katılımcı eklenebilir.';
    return '';
  }

  function estimate(format, count, rematch) {
    const error = formatError(format, count);
    if (error || count < 2) return 0;
    if (format === 'single') return TH.nextPow2(count) - 1;
    if (format === 'double') {
      const size = TH.nextPow2(count);
      const rounds = Math.log2(size);
      let total = size - 1 + 2;
      for (let i = 0; i < rounds - 1; i += 1) total += 2 * ((size / 4) / Math.pow(2, i));
      return total;
    }
    if (format === 'robin' || format === 'league') {
      const base = (count * (count - 1)) / 2;
      return rematch ? base * 2 : base;
    }
    if (format === 'swiss') return Math.ceil(Math.log2(count)) * Math.floor(count / 2);
    const fake = [];
    for (let i = 0; i < count; i += 1) fake.push({ id: 'p' + i, kind: 'team' });
    const groups = splitGroups(fake);
    let groupGames = 0;
    groups.forEach(function (g) { groupGames += (g.members.length * (g.members.length - 1)) / 2; });
    return groupGames + (TH.nextPow2(groups.length * 2) - 1);
  }

  function upcoming(db, limit) {
    const now = Date.now();
    return db.matches
      .filter(function (m) {
        if (m.status === 'completed' || m.status === 'cancelled' || m.status === 'pending') return false;
        if (!m.scheduledAt) return isPlayable(m);
        const time = new Date(m.scheduledAt).getTime();
        return !Number.isNaN(time) && (time >= now - 3600000 || isPlayable(m));
      })
      .filter(function (m) { return m.status !== 'completed' && real(m.a) && real(m.b) && m.phase !== 'reset' || isPlayable(m); })
      .filter(isPlayable)
      .sort(function (a, b) { return String(a.scheduledAt).localeCompare(String(b.scheduledAt)); })
      .slice(0, limit || 6);
  }

  function recent(db, limit) {
    return db.matches
      .filter(function (m) { return m.status === 'completed' && m.manualResult; })
      .sort(function (a, b) { return (b.playedAt || 0) - (a.playedAt || 0); })
      .slice(0, limit || 6);
  }

  function entityRow(db, ref) {
    let played = 0;
    let win = 0;
    let draw = 0;
    let loss = 0;
    let points = 0;
    const history = [];
    db.matches.forEach(function (match) {
      if (match.status !== 'completed') return;
      const home = same(match.a, ref);
      const away = same(match.b, ref);
      if (!home && !away) return;
      const tournament = findTournament(db, match.tournamentId);
      const rules = (tournament && tournament.rules) || { win: 3, draw: 1, loss: 0 };
      played += 1;
      const mine = home ? match.scoreA : match.scoreB;
      const theirs = home ? match.scoreB : match.scoreA;
      const opponent = home ? match.b : match.a;
      let result = 'draw';
      if (isBye(opponent) || (match.winner && same(match.winner, ref))) {
        result = 'win';
        win += 1;
        points += Number(rules.win);
      } else if (mine === theirs) {
        draw += 1;
        points += Number(rules.draw);
      } else {
        result = 'loss';
        loss += 1;
        points += Number(rules.loss);
      }
      history.push({
        match: match,
        tournament: tournament,
        opponent: opponent,
        score: (home ? match.scoreA : match.scoreB) + ' - ' + (home ? match.scoreB : match.scoreA),
        result: result,
        when: match.playedAt || 0
      });
    });
    const titles = db.tournaments.filter(function (t) {
      return t.status === 'completed' && t.championId === ref.id && t.championKind === ref.kind;
    });
    const joined = db.tournaments.filter(function (t) {
      return t.participants.some(function (p) { return same(p, ref); });
    });
    history.sort(function (a, b) { return b.when - a.when; });
    return {
      ref: copy(ref),
      played: played,
      win: win,
      draw: draw,
      loss: loss,
      points: points,
      winRate: played ? Math.round((win / played) * 100) : 0,
      titles: titles,
      joined: joined,
      history: history
    };
  }

  function boards(db) {
    const players = db.players.map(function (player) {
      const row = entityRow(db, { id: player.id, kind: 'player' });
      row.name = player.displayName;
      row.username = player.username;
      row.avatar = player.avatar;
      row.person = player;
      return row;
    });
    const teams = db.teams.map(function (team) {
      const row = entityRow(db, { id: team.id, kind: 'team' });
      row.name = team.name;
      row.tag = team.tag;
      row.logo = team.logo;
      row.person = team;
      return row;
    });
    return { players: players, teams: teams };
  }

  function progress(db, tournament) {
    const matches = db.matches.filter(function (m) {
      return m.tournamentId === tournament.id && m.status !== 'cancelled' && !(m.phase === 'reset' && m.status === 'pending');
    });
    const done = matches.filter(function (m) { return m.status === 'completed'; }).length;
    return { done: done, total: matches.length, ratio: matches.length ? done / matches.length : 0 };
  }

  TH.matches = {
    generate: generate,
    commit: commit,
    revert: revert,
    release: release,
    rollbackSwiss: rollbackSwiss,
    standings: standings,
    isPlayable: isPlayable,
    canMutateParticipants: canMutateParticipants,
    regenerate: regenerate,
    limits: limits,
    formatError: formatError,
    estimate: estimate,
    upcoming: upcoming,
    recent: recent,
    entityRow: entityRow,
    boards: boards,
    progress: progress,
    hasDownstreamManual: hasDownstreamManual,
    refresh: function (db, tournament) { afterWrite(db, tournament); },
    setSchedule: function (db, matchId, value) {
      const match = findMatch(db, matchId);
      if (!match) return { ok: false, error: 'Maç bulunamadı.' };
      if (value && Number.isNaN(new Date(value).getTime())) return { ok: false, error: 'Geçersiz tarih.' };
      match.scheduledAt = value || null;
      return { ok: true };
    }
  };
  TH.stats = { entity: entityRow, boards: boards };
})();
