import { makeEmptyMain, makeReserve, deepClone } from '../shared/gameLogic.js';
import { HEROES } from '../src/heroes.js';
import { executeRound } from '../src/battleEngine.js';

const BETTING_MAX_PLAYERS = 12;
const BETTING_MIN_PLAYERS = 2;
const BETTING_STARTING_COINS = 10;
const BETTING_TOTAL_ROUNDS = 8;
const BETTING_BET_MS = 60_000;
const BETTING_BATTLE_PLAYBACK_MS = 8_000;
const BETTING_SUMMARY_MS = 15_000;

const DRAFTABLE_HEROES = HEROES.filter((hero) => hero && hero.draftable !== false);

const BOT_NAMES = [
  'Ashbite', 'Copper Vow', 'Red Hollow', 'Mirecoil', 'Thorn Knell', 'Iron Lantern', 'Violet Pike', 'Hearthspite',
  'Ruinwell', 'Black Salt', 'Ridge Hex', 'Crow Tithe', 'Fable Hook', 'Stone Choir', 'Cinder Halo', 'Night Ore',
  'Moss Brand', 'Tarnished Bell', 'Harrow Vane', 'Rook Ember', 'Fogwarden', 'Grim Orchard', 'Mallet Saint', 'Rune Pledge',
  'Brackish Sun', 'Wolf Candle', 'Glass Briar', 'Warden Pike', 'Hush Quarry', 'Vex Banner', 'Frost Latch', 'Coal Monarch',
  'Ivory Fathom', 'Gale Tonic', 'Rattle Hymn', 'Duskwell', 'Hex Marble', 'Amber Graft', 'Brass Sparrow', 'Hollow Sickle',
  'Nettle Sovereign', 'Dagger Bloom', 'Sable Moor', 'Crag Reliquary', 'Vein Compass', 'Rookhaven', 'Spite Lantern', 'Orchid Fang',
  'Mercy Pike', 'Flint Parable', 'Gutter Crown', 'Mourn Current', 'Alder Ruin', 'Storm Gavel', 'Flare Bishop', 'Tide Fable',
  'Crypt Thread', 'Steel Ivy', 'Dawn Furnace', 'Briar Oracle', 'Ravel Drum', 'Grimward', 'Mire Bloom', 'Ashen Quill',
  'Echo Scar', 'Pale Carbine', 'Umber Anthem', 'Gloom Atlas', 'Riven Laurel', 'Shard Chapel', 'Cairn Zeal', 'Wick Harbor',
  'Thistle Regent', 'Smolder Loom', 'Bastion Crow', 'Hearth Tempest', 'Dread Finch', 'Trench Psalm', 'Velvet Sunder', 'Carven Mist',
  'Obsidian Lark', 'Marrow Bell', 'Fen Paladin', 'Rune Anchor', 'Vault Thorn', 'Gray Casket', 'Silt Herald', 'Blood Cowl',
  'Morrow Pike', 'Rust Litany', 'Wraith Acre', 'Harvest Spark', 'Pyre Beacon', 'Aegis Marsh', 'Wild Garrison', 'Cobalt Reliant',
  'Umbral Vicar', 'Warden Bloom', 'Feral Ledger', 'Quarry Saint'
];

const SIDE_BET_POOL = [
  {
    id: 1,
    title: 'Total Health Of Winning Team',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict total remaining health on the winning team.'
  },
  {
    id: 2,
    title: 'Round The Game Ends On',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict the exact ending round.'
  },
  {
    id: 3,
    title: 'Total Energy Of Winning Team',
    multiplier: 5,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict total ending energy on the winning team.'
  },
  {
    id: 4,
    title: 'Hero With Most Damage',
    multiplier: 6,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the hero with the most total damage dealt.'
  },
  {
    id: 5,
    title: 'Hero With Least Casts (Alive)',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the alive hero with the fewest casts.'
  },
  {
    id: 6,
    title: 'Hero With Most Casts (Alive)',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the alive hero with the most casts.'
  },
  {
    id: 7,
    title: 'First Hero To Die',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the first hero to die.'
  },
  {
    id: 8,
    title: 'Last Hero To Die On Losing Team',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the last hero to die on the losing team.'
  },
  {
    id: 9,
    title: 'Round With Most Hero Deaths',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict the round with the highest death count.'
  }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleUnique(source, count) {
  const list = Array.isArray(source) ? [...source] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list.slice(0, Math.max(0, Math.min(count, list.length)));
}

function makeLobbyCode(existingCodes) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  return `L${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function cloneHeroForBattle(hero, uid) {
  const h = deepClone(hero);
  h.currentHealth = Number(h.health || 0);
  h.currentArmor = Number(h.armor || 0);
  h.currentEnergy = Number(h.energy || 0);
  h.currentSpeed = Number(h.speed || 0);
  h.currentSpellPower = Number(h.spellPower || 0);
  h._bettingUid = uid;
  return h;
}

function chooseBotNames() {
  const picks = sampleUnique(BOT_NAMES, 2);
  if (picks.length < 2) return ['Easy Bot A', 'Easy Bot B'];
  return picks;
}

function chooseSideBet(heroOptions) {
  const picked = SIDE_BET_POOL[Math.floor(Math.random() * SIDE_BET_POOL.length)];
  return {
    ...picked,
    heroOptions: picked.predictionType === 'hero' ? heroOptions : []
  };
}

function createBattleSpec(roundNumber) {
  const [botA, botB] = chooseBotNames();
  const mainSlots = sampleUnique([0, 1, 2, 3, 4, 5, 6, 7, 8], 5);

  const teamA = {
    main: makeEmptyMain('player1'),
    reserve: makeReserve('player1')
  };
  const teamB = {
    main: makeEmptyMain('player2'),
    reserve: makeReserve('player2')
  };

  const heroesA = sampleUnique(DRAFTABLE_HEROES, 7);
  const heroesB = sampleUnique(DRAFTABLE_HEROES, 7);

  const heroOptions = [];

  for (let i = 0; i < 5; i += 1) {
    const slot = mainSlots[i];
    const heroA = heroesA[i];
    const heroB = heroesB[i];
    if (heroA) {
      const uidA = `r${roundNumber}-p1-main-${slot}-${heroA.id}-${i}`;
      teamA.main[slot] = {
        ...teamA.main[slot],
        hero: cloneHeroForBattle(heroA, uidA)
      };
      heroOptions.push({ uid: uidA, name: heroA.name, team: botA });
    }
    if (heroB) {
      const uidB = `r${roundNumber}-p2-main-${slot}-${heroB.id}-${i}`;
      teamB.main[slot] = {
        ...teamB.main[slot],
        hero: cloneHeroForBattle(heroB, uidB)
      };
      heroOptions.push({ uid: uidB, name: heroB.name, team: botB });
    }
  }

  for (let i = 0; i < 2; i += 1) {
    const heroA = heroesA[5 + i];
    const heroB = heroesB[5 + i];
    if (heroA) {
      const uidA = `r${roundNumber}-p1-res-${i}-${heroA.id}`;
      teamA.reserve[i] = {
        ...teamA.reserve[i],
        hero: cloneHeroForBattle(heroA, uidA)
      };
      heroOptions.push({ uid: uidA, name: heroA.name, team: botA });
    }
    if (heroB) {
      const uidB = `r${roundNumber}-p2-res-${i}-${heroB.id}`;
      teamB.reserve[i] = {
        ...teamB.reserve[i],
        hero: cloneHeroForBattle(heroB, uidB)
      };
      heroOptions.push({ uid: uidB, name: heroB.name, team: botB });
    }
  }

  const sideBet = chooseSideBet(heroOptions);

  return {
    roundNumber,
    bots: {
      p1: botA,
      p2: botB
    },
    p1Main: teamA.main,
    p1Reserve: teamA.reserve,
    p2Main: teamB.main,
    p2Reserve: teamB.reserve,
    heroOptions,
    sideBet
  };
}

function getTileByToken(snapshot, token) {
  if (!snapshot || !token || typeof token.index !== 'number') return null;
  const boardName = String(token.boardName || '');
  if (boardName === 'p1Main') return (snapshot.p1Board || [])[token.index] || null;
  if (boardName === 'p2Main') return (snapshot.p2Board || [])[token.index] || null;
  if (boardName === 'p1Reserve') return (snapshot.p1Reserve || [])[token.index] || null;
  if (boardName === 'p2Reserve') return (snapshot.p2Reserve || [])[token.index] || null;
  return null;
}

function isAliveTile(tile) {
  if (!tile || !tile.hero) return false;
  if (tile._dead) return false;
  const hp = tile.currentHealth != null ? Number(tile.currentHealth) : Number(tile.hero.health || 0);
  return hp > 0;
}

function collectAllTiles(snapshot) {
  const out = [];
  const collect = (arr, side) => {
    (arr || []).forEach((tile) => {
      if (!tile || !tile.hero || !tile.hero._bettingUid) return;
      out.push({
        uid: tile.hero._bettingUid,
        name: tile.hero.name || 'Hero',
        side,
        alive: isAliveTile(tile),
        tile
      });
    });
  };
  collect(snapshot.p1Board, 'p1');
  collect(snapshot.p1Reserve, 'p1');
  collect(snapshot.p2Board, 'p2');
  collect(snapshot.p2Reserve, 'p2');
  return out;
}

function remainingStat(snapshot, side, field) {
  const arrays = side === 'p1'
    ? [snapshot.p1Board || [], snapshot.p1Reserve || []]
    : [snapshot.p2Board || [], snapshot.p2Reserve || []];

  return arrays.reduce((sum, arr) => sum + arr.reduce((acc, tile) => {
    if (!isAliveTile(tile)) return acc;
    const value = tile[field] != null
      ? Number(tile[field])
      : Number(tile.hero && tile.hero[field.replace('current', '').toLowerCase()] || 0);
    return acc + Math.max(0, value);
  }, 0), 0);
}

function evaluateSideBetWinners(sideBet, placed, outcome) {
  const eligible = placed.filter((entry) => Number(entry.sideAmount || 0) > 0);
  if (!sideBet || eligible.length === 0) return new Set();

  const winners = new Set();

  if (sideBet.id === 1) {
    let best = Infinity;
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamHealth || 0));
      best = Math.min(best, dist);
    });
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamHealth || 0));
      if (dist === best) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 2) {
    eligible.forEach((entry) => {
      if (Number(entry.sidePrediction) === Number(outcome.endRound || 0)) {
        winners.add(entry.playerId);
      }
    });
    return winners;
  }

  if (sideBet.id === 3) {
    let best = Infinity;
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamEnergy || 0));
      best = Math.min(best, dist);
    });
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamEnergy || 0));
      if (dist === best) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 4) {
    const set = new Set(outcome.mostDamageHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 5) {
    const set = new Set(outcome.leastCastsAliveHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 6) {
    const set = new Set(outcome.mostCastsAliveHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 7) {
    const set = new Set(outcome.firstToDieHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 8) {
    const set = new Set(outcome.lastDieOnLosingTeamHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 9) {
    const set = new Set(outcome.roundsWithMostDeaths || []);
    eligible.forEach((entry) => {
      if (set.has(Number(entry.sidePrediction))) winners.add(entry.playerId);
    });
  }

  return winners;
}

async function simulateBattle(spec) {
  let p1Main = deepClone(spec.p1Main);
  let p1Reserve = deepClone(spec.p1Reserve);
  let p2Main = deepClone(spec.p2Main);
  let p2Reserve = deepClone(spec.p2Reserve);

  const damageByHero = new Map();
  const castsByHero = new Map();
  const heroNameByUid = new Map();
  const heroSideByUid = new Map();
  const deathEvents = [];
  const deathsByRound = new Map();
  const playback = [];
  const replaySteps = [];
  let replaySeq = 0;

  let deathSeq = 0;
  let prevAlive = new Map();
  let winnerToken = null;
  let endRound = 0;

  const seedSnapshot = { p1Board: p1Main, p2Board: p2Main, p1Reserve, p2Reserve };
  collectAllTiles(seedSnapshot).forEach((entry) => {
    prevAlive.set(entry.uid, entry.alive);
    heroNameByUid.set(entry.uid, entry.name);
    heroSideByUid.set(entry.uid, entry.side);
    damageByHero.set(entry.uid, 0);
    castsByHero.set(entry.uid, 0);
  });

  for (let round = 1; round <= 20; round += 1) {
    endRound = round;
    const result = await executeRound(
      {
        p1Board: p1Main,
        p2Board: p2Main,
        p1Reserve,
        p2Reserve,
        priorityPlayer: round % 2 === 0 ? 'player2' : 'player1',
        roundNumber: round,
        gameMode: 'classic'
      },
      {
        castDelayMs: 0,
        postEffectDelayMs: 0,
        reactionDelayMs: 0,
        postCastDelayMs: 0,
        quiet: true,
        speedMultiplier: 30,
        onStep: (snapshot) => {
          const action = snapshot && snapshot.lastAction ? snapshot.lastAction : null;
          replaySeq += 1;
          const stepAction = action ? deepClone(action) : { type: 'stateSync' };
          stepAction.seq = replaySeq;
          stepAction.state = {
            p1Main: deepClone(snapshot?.p1Board || []),
            p2Main: deepClone(snapshot?.p2Board || []),
            p1Reserve: deepClone(snapshot?.p1Reserve || []),
            p2Reserve: deepClone(snapshot?.p2Reserve || []),
            priorityPlayer: snapshot?.priorityPlayer || 'player1',
            phase: snapshot?.phase || 'battle',
            roundNumber: Number(snapshot?.roundNumber || round)
          };
          replaySteps.push(stepAction);

          collectAllTiles(snapshot).forEach((entry) => {
            heroNameByUid.set(entry.uid, entry.name);
            heroSideByUid.set(entry.uid, entry.side);
            if (!damageByHero.has(entry.uid)) damageByHero.set(entry.uid, 0);
            if (!castsByHero.has(entry.uid)) castsByHero.set(entry.uid, 0);
          });

          if (action && action.type === 'cast' && action.caster) {
            const casterTile = getTileByToken(snapshot, action.caster);
            const casterUid = casterTile && casterTile.hero ? casterTile.hero._bettingUid : null;
            if (casterUid) {
              castsByHero.set(casterUid, Number(castsByHero.get(casterUid) || 0) + 1);
              const damage = (Array.isArray(action.results) ? action.results : []).reduce((sum, item) => {
                const amount = item && item.applied && item.applied.type === 'damage'
                  ? Number(item.applied.amount || 0)
                  : 0;
                return sum + Math.max(0, amount);
              }, 0);
              damageByHero.set(casterUid, Number(damageByHero.get(casterUid) || 0) + damage);
              const casterName = heroNameByUid.get(casterUid) || 'Hero';
              if (damage > 0 && playback.length < 220) {
                playback.push(`Round ${round}: ${casterName} dealt ${damage} total damage.`);
              }
            }
          }

          const allNow = collectAllTiles(snapshot);
          allNow.forEach((entry) => {
            const beforeAlive = prevAlive.get(entry.uid);
            const nowAlive = entry.alive;
            prevAlive.set(entry.uid, nowAlive);
            if (beforeAlive === true && nowAlive === false) {
              deathSeq += 1;
              deathEvents.push({ uid: entry.uid, round, seq: deathSeq, side: entry.side });
              deathsByRound.set(round, Number(deathsByRound.get(round) || 0) + 1);
              if (playback.length < 220) {
                playback.push(`Round ${round}: ${entry.name} was slain.`);
              }
            }
          });
        }
      }
    );

    p1Main = result.p1Board;
    p2Main = result.p2Board;
    p1Reserve = result.p1Reserve;
    p2Reserve = result.p2Reserve;

    if (result.winner) {
      winnerToken = result.winner;
      break;
    }
  }

  const finalSnapshot = { p1Board: p1Main, p2Board: p2Main, p1Reserve, p2Reserve };

  const p1Health = remainingStat(finalSnapshot, 'p1', 'currentHealth');
  const p2Health = remainingStat(finalSnapshot, 'p2', 'currentHealth');

  let winnerSide = winnerToken === 'player1'
    ? 'p1'
    : winnerToken === 'player2'
      ? 'p2'
      : p1Health >= p2Health
        ? 'p1'
        : 'p2';

  const losingSide = winnerSide === 'p1' ? 'p2' : 'p1';

  const winningTeamHealth = remainingStat(finalSnapshot, winnerSide, 'currentHealth');
  const winningTeamEnergy = remainingStat(finalSnapshot, winnerSide, 'currentEnergy');

  const damageEntries = [...damageByHero.entries()];
  const maxDamage = damageEntries.reduce((max, [, value]) => Math.max(max, Number(value || 0)), 0);
  const mostDamageHeroes = damageEntries
    .filter(([, value]) => Number(value || 0) === maxDamage)
    .map(([uid]) => uid);

  const aliveTiles = collectAllTiles(finalSnapshot).filter((entry) => entry.alive);
  const aliveCastEntries = aliveTiles.map((entry) => ({
    uid: entry.uid,
    casts: Number(castsByHero.get(entry.uid) || 0)
  }));

  const leastCast = aliveCastEntries.length > 0
    ? aliveCastEntries.reduce((min, entry) => Math.min(min, entry.casts), Infinity)
    : null;
  const mostCast = aliveCastEntries.length > 0
    ? aliveCastEntries.reduce((max, entry) => Math.max(max, entry.casts), -Infinity)
    : null;

  const leastCastsAliveHeroes = leastCast == null
    ? []
    : aliveCastEntries.filter((entry) => entry.casts === leastCast).map((entry) => entry.uid);
  const mostCastsAliveHeroes = mostCast == null
    ? []
    : aliveCastEntries.filter((entry) => entry.casts === mostCast).map((entry) => entry.uid);

  const firstToDieHeroes = [];
  if (deathEvents.length > 0) {
    const minSeq = deathEvents.reduce((min, event) => Math.min(min, event.seq), Infinity);
    deathEvents.forEach((event) => {
      if (event.seq === minSeq) firstToDieHeroes.push(event.uid);
    });
  }

  const losingDeaths = deathEvents.filter((event) => event.side === losingSide);
  const lastDieOnLosingTeamHeroes = [];
  if (losingDeaths.length > 0) {
    const maxSeq = losingDeaths.reduce((max, event) => Math.max(max, event.seq), -Infinity);
    losingDeaths.forEach((event) => {
      if (event.seq === maxSeq) lastDieOnLosingTeamHeroes.push(event.uid);
    });
  }

  const roundDeathEntries = [...deathsByRound.entries()];
  const maxDeathsAnyRound = roundDeathEntries.reduce((max, [, value]) => Math.max(max, Number(value || 0)), 0);
  const roundsWithMostDeaths = roundDeathEntries
    .filter(([, value]) => Number(value || 0) === maxDeathsAnyRound)
    .map(([round]) => Number(round));

  return {
    winnerSide,
    losingSide,
    endRound,
    winningTeamHealth,
    winningTeamEnergy,
    mostDamageHeroes,
    leastCastsAliveHeroes,
    mostCastsAliveHeroes,
    firstToDieHeroes,
    lastDieOnLosingTeamHeroes,
    roundsWithMostDeaths,
    heroNameByUid: Object.fromEntries(heroNameByUid.entries()),
    castsByHero: Object.fromEntries(castsByHero.entries()),
    damageByHero: Object.fromEntries(damageByHero.entries()),
    playback: playback.slice(0, 220),
    replayInitialState: {
      p1Main: deepClone(spec.p1Main),
      p2Main: deepClone(spec.p2Main),
      p1Reserve: deepClone(spec.p1Reserve),
      p2Reserve: deepClone(spec.p2Reserve),
      phase: 'battle',
      gameMode: 'classic',
      roundNumber: 0,
      priorityPlayer: 'player1'
    },
    replaySteps,
    finalSnapshot
  };
}

export function createBettingModeManager(io) {
  const lobbiesByCode = new Map();
  const lobbyCodeBySocketId = new Map();
  const lobbyCodeByPlayerId = new Map();
  const playerIdBySocketId = new Map();

  const roomForLobby = (code) => `betting:${code}`;

  const getPlayerId = (socket) => {
    const raw = socket?.data?.playfab?.playFabId;
    if (!raw) return null;
    return String(raw);
  };

  const getPlayerName = (socket) => String(socket?.data?.playfab?.username || 'Player');

  const clearLobbyTimer = (lobby) => {
    if (lobby && lobby.timer) {
      clearTimeout(lobby.timer);
      lobby.timer = null;
    }
  };

  const serializeLobby = (lobby, socketId) => {
    const mePlayerId = playerIdBySocketId.get(socketId) || null;
    const players = lobby.playerOrder
      .map((playerId) => lobby.players.get(playerId))
      .filter(Boolean)
      .map((player) => ({
        id: player.playerId,
        username: player.username,
        coins: Number(player.coins || 0),
        isHost: player.playerId === lobby.hostPlayerId,
        online: !!player.online
      }));

    const me = mePlayerId ? (lobby.players.get(mePlayerId) || null) : null;

    return {
      code: lobby.code,
      visibility: lobby.visibility,
      phase: lobby.phase,
      hostId: lobby.hostPlayerId,
      currentRound: lobby.currentRound,
      totalRounds: BETTING_TOTAL_ROUNDS,
      canStart: mePlayerId === lobby.hostPlayerId && lobby.phase === 'lobby' && players.length >= BETTING_MIN_PLAYERS,
      players,
      me: me
        ? {
            id: me.playerId,
            username: me.username,
            coins: Number(me.coins || 0)
          }
        : null,
      submittedBets: Object.keys(lobby.bets || {}).length,
      betDeadlineTs: lobby.betDeadlineTs || null,
      battleDeadlineTs: lobby.battleDeadlineTs || null,
      summaryDeadlineTs: lobby.summaryDeadlineTs || null,
      battle: lobby.battleSpec
        ? {
            bots: lobby.battleSpec.bots,
            p1Main: lobby.battleSpec.p1Main,
            p1Reserve: lobby.battleSpec.p1Reserve,
            p2Main: lobby.battleSpec.p2Main,
            p2Reserve: lobby.battleSpec.p2Reserve,
            sideBet: lobby.battleSpec.sideBet,
            replay: lobby.battleReplay ? {
              initialState: lobby.battleReplay.initialState,
              steps: lobby.battleReplay.steps
            } : null
          }
        : null,
      playback: lobby.playback || null,
      roundSummary: lobby.roundSummary || null,
      finalStandings: lobby.finalStandings || null
    };
  };

  const serializeLobbyBrowser = () => {
    const cards = [];
    lobbiesByCode.forEach((lobby) => {
      if (!lobby || lobby.visibility !== 'public') return;
      const totalPlayers = lobby.playerOrder.length;
      const onlinePlayers = lobby.playerOrder.reduce((acc, playerId) => {
        const p = lobby.players.get(playerId);
        return acc + (p && p.online ? 1 : 0);
      }, 0);
      cards.push({
        code: lobby.code,
        phase: lobby.phase,
        visibility: lobby.visibility,
        currentRound: lobby.currentRound,
        totalRounds: BETTING_TOTAL_ROUNDS,
        totalPlayers,
        onlinePlayers,
        hostUsername: lobby.players.get(lobby.hostPlayerId)?.username || 'Host',
        canJoin: lobby.phase === 'lobby' && totalPlayers < BETTING_MAX_PLAYERS
      });
    });
    cards.sort((a, b) => Number(b.totalPlayers || 0) - Number(a.totalPlayers || 0));
    return cards;
  };

  const emitLobbyBrowser = () => {
    const payload = { lobbies: serializeLobbyBrowser() };
    io.emit('bettingLobbyBrowser', payload);
  };

  const emitLobbyState = (lobby) => {
    lobby.playerOrder.forEach((playerId) => {
      const socketId = lobby.players.get(playerId)?.socketId;
      if (!socketId) return;
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.emit('bettingLobbyState', serializeLobby(lobby, socketId));
    });
    emitLobbyBrowser();
  };

  const getLobbyForSocket = (socketId) => {
    const code = lobbyCodeBySocketId.get(socketId);
    if (!code) return null;
    return lobbiesByCode.get(code) || null;
  };

  const deleteLobbyIfEmpty = (lobby) => {
    if (!lobby || lobby.playerOrder.length > 0) return;
    clearLobbyTimer(lobby);
    lobby.playerOrder.forEach((playerId) => {
      lobbyCodeByPlayerId.delete(playerId);
    });
    lobbiesByCode.delete(lobby.code);
    emitLobbyBrowser();
  };

  const removeFromLobby = (socket, { silent = false } = {}) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;
    const lobby = getLobbyForSocket(socket.id);
    if (!lobby) return;

    lobby.players.delete(playerId);
    lobby.playerOrder = lobby.playerOrder.filter((id) => id !== playerId);
    delete lobby.bets[playerId];
    lobbyCodeBySocketId.delete(socket.id);
    lobbyCodeByPlayerId.delete(playerId);
    playerIdBySocketId.delete(socket.id);

    socket.leave(roomForLobby(lobby.code));

    if (lobby.hostPlayerId === playerId) {
      lobby.hostPlayerId = lobby.playerOrder[0] || null;
    }

    if (lobby.phase !== 'lobby' && lobby.playerOrder.length < BETTING_MIN_PLAYERS) {
      clearLobbyTimer(lobby);
      lobby.phase = 'complete';
      lobby.finalStandings = lobby.playerOrder
        .map((id) => lobby.players.get(id))
        .filter(Boolean)
        .map((player) => ({ username: player.username, coins: Number(player.coins || 0) }))
        .sort((a, b) => b.coins - a.coins);
    }

    if (!silent) {
      socket.emit('bettingLeftLobby', { ok: true });
    }

    if (lobby.playerOrder.length > 0) {
      emitLobbyState(lobby);
    }
    deleteLobbyIfEmpty(lobby);
  };

  const beginSummaryPhase = (lobby) => {
    lobby.phase = 'summary';
    lobby.summaryDeadlineTs = Date.now() + BETTING_SUMMARY_MS;
    lobby.betDeadlineTs = null;
    lobby.battleDeadlineTs = null;
    lobby.playback = null;

    emitLobbyState(lobby);

    clearLobbyTimer(lobby);
    lobby.timer = setTimeout(() => {
      if (!lobbiesByCode.has(lobby.code)) return;
      if (lobby.currentRound >= BETTING_TOTAL_ROUNDS) {
        lobby.phase = 'complete';
        lobby.finalStandings = lobby.playerOrder
          .map((playerId) => lobby.players.get(playerId))
          .filter(Boolean)
          .map((player) => ({ username: player.username, coins: Number(player.coins || 0) }))
          .sort((a, b) => b.coins - a.coins);
        lobby.summaryDeadlineTs = null;
        emitLobbyState(lobby);
        return;
      }
      startBettingRound(lobby).catch((error) => {
        console.error('[Betting] Failed to start next round:', error);
      });
    }, BETTING_SUMMARY_MS);
  };

  const settleRound = async (lobby) => {
    const battleOutcome = await simulateBattle(lobby.battleSpec);
    const placed = lobby.playerOrder.map((id) => {
      const bet = lobby.bets[id] || {};
      return {
        playerId: id,
        primaryPick: String(bet.primaryPick || ''),
        primaryAmount: Number(bet.primaryAmount || 0),
        sideAmount: Number(bet.sideAmount || 0),
        sidePrediction: bet.sidePrediction
      };
    });

    const sideWinners = evaluateSideBetWinners(lobby.battleSpec.sideBet, placed, battleOutcome);
    const roundRows = [];

    placed.forEach((entry) => {
      const player = lobby.players.get(entry.playerId);
      if (!player) return;

      const before = Number(player.coins || 0);
      const primaryAmount = Math.max(0, Math.floor(Number(entry.primaryAmount || 0)));
      const sideAmount = Math.max(0, Math.floor(Number(entry.sideAmount || 0)));
      const totalStake = primaryAmount + sideAmount;

      const wonPrimary = primaryAmount > 0 && entry.primaryPick === battleOutcome.winnerSide;
      const wonSide = sideAmount > 0 && sideWinners.has(entry.playerId);

      const primaryPayout = wonPrimary ? primaryAmount * 2 : 0;
      const sidePayout = wonSide ? sideAmount * Number(lobby.battleSpec.sideBet.multiplier || 0) : 0;
      const payout = primaryPayout + sidePayout;

      const after = Math.max(0, before - totalStake + payout);
      player.coins = after;

      roundRows.push({
        playerId: entry.playerId,
        username: player.username,
        coinsBefore: before,
        coinsAfter: after,
        primaryPick: entry.primaryPick || null,
        primaryAmount,
        sidePrediction: entry.sidePrediction ?? null,
        sideAmount,
        wonPrimary,
        wonSide,
        payout
      });
    });

    lobby.playback = {
      lines: battleOutcome.playback,
      winnerSide: battleOutcome.winnerSide,
      winnerName: battleOutcome.winnerSide === 'p1' ? lobby.battleSpec.bots.p1 : lobby.battleSpec.bots.p2
    };
    lobby.battleReplay = {
      initialState: battleOutcome.replayInitialState,
      steps: battleOutcome.replaySteps
    };

    lobby.roundSummary = {
      round: lobby.currentRound,
      winnerSide: battleOutcome.winnerSide,
      winnerName: battleOutcome.winnerSide === 'p1' ? lobby.battleSpec.bots.p1 : lobby.battleSpec.bots.p2,
      endRound: battleOutcome.endRound,
      sideBet: lobby.battleSpec.sideBet,
      sideBetOutcome: {
        winningTeamHealth: battleOutcome.winningTeamHealth,
        winningTeamEnergy: battleOutcome.winningTeamEnergy,
        mostDamageHeroes: battleOutcome.mostDamageHeroes,
        leastCastsAliveHeroes: battleOutcome.leastCastsAliveHeroes,
        mostCastsAliveHeroes: battleOutcome.mostCastsAliveHeroes,
        firstToDieHeroes: battleOutcome.firstToDieHeroes,
        lastDieOnLosingTeamHeroes: battleOutcome.lastDieOnLosingTeamHeroes,
        roundsWithMostDeaths: battleOutcome.roundsWithMostDeaths,
        heroNameByUid: battleOutcome.heroNameByUid
      },
      rows: roundRows
    };

    lobby.phase = 'battle';
    lobby.betDeadlineTs = null;
    lobby.battleDeadlineTs = Date.now() + BETTING_BATTLE_PLAYBACK_MS;

    emitLobbyState(lobby);

    clearLobbyTimer(lobby);
    lobby.timer = setTimeout(() => {
      if (!lobbiesByCode.has(lobby.code)) return;
      beginSummaryPhase(lobby);
    }, BETTING_BATTLE_PLAYBACK_MS);
  };

  const closeBettingWindow = async (lobby) => {
    if (!lobby || lobby.phase !== 'betting') return;
    lobby.betDeadlineTs = null;
    try {
      await settleRound(lobby);
    } catch (error) {
      console.error('[Betting] Failed to settle round:', error);
      lobby.phase = 'summary';
      lobby.roundSummary = {
        round: lobby.currentRound,
        winnerName: 'Unavailable',
        rows: []
      };
      emitLobbyState(lobby);
    }
  };

  async function startBettingRound(lobby) {
    lobby.currentRound += 1;
    lobby.phase = 'betting';
    lobby.bets = {};
    lobby.roundSummary = null;
    lobby.playback = null;
    lobby.battleReplay = null;
    lobby.summaryDeadlineTs = null;
    lobby.battleDeadlineTs = null;

    lobby.battleSpec = createBattleSpec(lobby.currentRound);
    lobby.betDeadlineTs = Date.now() + BETTING_BET_MS;

    emitLobbyState(lobby);

    clearLobbyTimer(lobby);
    lobby.timer = setTimeout(() => {
      closeBettingWindow(lobby).catch((error) => {
        console.error('[Betting] Failed to close betting window:', error);
      });
    }, BETTING_BET_MS);
  }

  const onConnection = (socket) => {
    const createLobbyInternal = (visibilityRaw = 'public') => {
      if (!socket.data || !socket.data.playfab) {
        socket.emit('bettingError', { message: 'You must be logged in to create a lobby.' });
        return;
      }

      const playerId = getPlayerId(socket);
      if (!playerId) {
        socket.emit('bettingError', { message: 'Could not determine player identity.' });
        return;
      }

      removeFromLobby(socket, { silent: true });

      const code = makeLobbyCode(lobbiesByCode);
      const visibility = String(visibilityRaw || '').toLowerCase() === 'private' ? 'private' : 'public';
      const lobby = {
        code,
        createdAt: Date.now(),
        hostPlayerId: playerId,
        visibility,
        phase: 'lobby',
        currentRound: 0,
        players: new Map(),
        playerOrder: [],
        battleSpec: null,
        battleReplay: null,
        bets: {},
        playback: null,
        roundSummary: null,
        finalStandings: null,
        timer: null,
        betDeadlineTs: null,
        battleDeadlineTs: null,
        summaryDeadlineTs: null
      };

      lobby.players.set(playerId, {
        playerId,
        socketId: socket.id,
        username: getPlayerName(socket),
        coins: BETTING_STARTING_COINS,
        online: true,
        lastSeenAt: Date.now()
      });
      lobby.playerOrder.push(playerId);

      lobbiesByCode.set(code, lobby);
      lobbyCodeBySocketId.set(socket.id, code);
      playerIdBySocketId.set(socket.id, playerId);
      lobbyCodeByPlayerId.set(playerId, code);
      socket.join(roomForLobby(code));

      emitLobbyState(lobby);
    };

    socket.on('listBettingLobbies', () => {
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
    });

    socket.on('createBettingLobby', () => {
      createLobbyInternal('public');
    });

    socket.on('createBettingLobbyWithVisibility', (payload = {}) => {
      createLobbyInternal(payload.visibility);
    });

    socket.on('joinBettingLobby', (payload = {}) => {
      if (!socket.data || !socket.data.playfab) {
        socket.emit('bettingError', { message: 'You must be logged in to join a lobby.' });
        return;
      }

      const playerId = getPlayerId(socket);
      if (!playerId) return;

      const code = String(payload.code || '').trim().toUpperCase();
      const lobby = lobbiesByCode.get(code);
      if (!lobby) {
        socket.emit('bettingError', { message: 'Lobby not found.' });
        return;
      }
      if (lobby.playerOrder.length >= BETTING_MAX_PLAYERS) {
        socket.emit('bettingError', { message: 'Lobby is full.' });
        return;
      }
      if (lobby.phase !== 'lobby') {
        socket.emit('bettingError', { message: 'Game already started in this lobby.' });
        return;
      }

      removeFromLobby(socket, { silent: true });

      if (lobby.players.has(playerId)) {
        const player = lobby.players.get(playerId);
        player.socketId = socket.id;
        player.online = true;
        player.username = getPlayerName(socket);
      } else {
        lobby.players.set(playerId, {
          playerId,
          socketId: socket.id,
          username: getPlayerName(socket),
          coins: BETTING_STARTING_COINS,
          online: true,
          lastSeenAt: Date.now()
        });
        lobby.playerOrder.push(playerId);
      }
      lobbyCodeBySocketId.set(socket.id, code);
      playerIdBySocketId.set(socket.id, playerId);
      lobbyCodeByPlayerId.set(playerId, code);
      socket.join(roomForLobby(code));

      emitLobbyState(lobby);
    });

    socket.on('leaveBettingLobby', () => {
      removeFromLobby(socket);
    });

    socket.on('startBettingGame', () => {
      const playerId = getPlayerId(socket);
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby) {
        socket.emit('bettingError', { message: 'Join a lobby first.' });
        return;
      }
      if (!playerId || lobby.hostPlayerId !== playerId) {
        socket.emit('bettingError', { message: 'Only the lobby host can start.' });
        return;
      }
      if (lobby.phase !== 'lobby') {
        socket.emit('bettingError', { message: 'Game already started.' });
        return;
      }
      if (lobby.playerOrder.length < BETTING_MIN_PLAYERS) {
        socket.emit('bettingError', { message: 'At least 2 players are required to start.' });
        return;
      }

      lobby.playerOrder.forEach((id) => {
        const player = lobby.players.get(id);
        if (player) player.coins = BETTING_STARTING_COINS;
      });

      startBettingRound(lobby).catch((error) => {
        console.error('[Betting] Failed to start game:', error);
        socket.emit('bettingError', { message: 'Could not start betting game.' });
      });
    });

    socket.on('placeBettingBet', (payload = {}) => {
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby) return;
      if (lobby.phase !== 'betting') return;

      const playerId = getPlayerId(socket);
      if (!playerId) return;

      const player = lobby.players.get(playerId);
      if (!player) return;

      const primaryAmount = Math.max(0, Math.floor(Number(payload.primaryAmount || 0)));
      const sideAmountRaw = Math.max(0, Math.floor(Number(payload.sideAmount || 0)));
      const sideAmount = Math.min(Number(lobby.battleSpec?.sideBet?.maxStake || 5), sideAmountRaw);
      const primaryPick = String(payload.primaryPick || '');
      const total = primaryAmount + sideAmount;

      if (!['p1', 'p2'].includes(primaryPick)) {
        socket.emit('bettingError', { message: 'Primary bet must pick one of the two bots.' });
        return;
      }
      if (primaryAmount < 1) {
        socket.emit('bettingError', { message: 'Primary bet minimum is 1 coin.' });
        return;
      }
      if (total > Number(player.coins || 0)) {
        socket.emit('bettingError', { message: 'Your total stake exceeds your coins.' });
        return;
      }

      const sideBet = lobby.battleSpec?.sideBet || null;
      let sidePrediction = payload.sidePrediction;
      if (sideAmount > 0 && sideBet) {
        if (sideBet.predictionType === 'hero') {
          const valid = (sideBet.heroOptions || []).some((option) => option.uid === String(sidePrediction || ''));
          if (!valid) {
            socket.emit('bettingError', { message: 'Choose a valid hero for the side bet.' });
            return;
          }
          sidePrediction = String(sidePrediction || '');
        } else {
          const num = Number(sidePrediction);
          if (!Number.isFinite(num)) {
            socket.emit('bettingError', { message: 'Side bet prediction must be numeric.' });
            return;
          }
          sidePrediction = Math.floor(num);
        }
      } else {
        sidePrediction = null;
      }

      lobby.bets[playerId] = {
        primaryPick,
        primaryAmount,
        sideAmount,
        sidePrediction,
        submittedAt: Date.now()
      };

      emitLobbyState(lobby);
    });
  };

  const onAuthenticated = (socket) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const existingCode = lobbyCodeByPlayerId.get(playerId);
    if (!existingCode) {
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
      return;
    }

    const lobby = lobbiesByCode.get(existingCode);
    if (!lobby || !lobby.players.has(playerId)) {
      lobbyCodeByPlayerId.delete(playerId);
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
      return;
    }

    lobbyCodeBySocketId.set(socket.id, existingCode);
    playerIdBySocketId.set(socket.id, playerId);
    socket.join(roomForLobby(existingCode));

    const player = lobby.players.get(playerId);
    player.socketId = socket.id;
    player.online = true;
    player.username = getPlayerName(socket);
    player.lastSeenAt = Date.now();

    emitLobbyState(lobby);
  };

  const onDisconnect = (socket) => {
    const lobby = getLobbyForSocket(socket.id);
    const playerId = playerIdBySocketId.get(socket.id);
    lobbyCodeBySocketId.delete(socket.id);
    playerIdBySocketId.delete(socket.id);
    if (!lobby || !playerId) return;
    const player = lobby.players.get(playerId);
    if (!player) return;
    player.socketId = null;
    player.online = false;
    player.lastSeenAt = Date.now();
    emitLobbyState(lobby);
  };

  return {
    onConnection,
    onAuthenticated,
    onDisconnect
  };
}
