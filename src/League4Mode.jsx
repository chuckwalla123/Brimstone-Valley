import React, { useEffect, useMemo, useRef, useState } from 'react';
import BattlePhase from './BattlePhase';
import getAssetPath from './utils/assetPath';

const CHESS_TIME_MS = 4 * 60 * 1000;
const LEAGUE_MAIN_SLOT_COUNT = 9;
const LEAGUE_RESERVE_SLOT_COUNT = 2;

const ROW_ORDER = {
  front: [2, 5, 8],
  middle: [1, 4, 7],
  back: [0, 3, 6]
};

const toPlayerKey = (side) => (
  side === 'p1' ? 'player1'
    : side === 'p2' ? 'player2'
      : side === 'p3' ? 'player3'
        : side === 'p4' ? 'player4'
          : null
);

export default function League4Mode({ gameState, socket, localSide, matchPlayers, onExit }) {
  const [now, setNow] = useState(Date.now());
  const [isCompact, setIsCompact] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const [arrangeMainIds, setArrangeMainIds] = useState(Array(LEAGUE_MAIN_SLOT_COUNT).fill(null));
  const [arrangeReserveIds, setArrangeReserveIds] = useState(Array(LEAGUE_RESERVE_SLOT_COUNT).fill(null));
  const [arrangeSelectedSlot, setArrangeSelectedSlot] = useState(null);
  const [arrangeDragSlot, setArrangeDragSlot] = useState(null);
  const [augmentSlotType, setAugmentSlotType] = useState('main');
  const [augmentSlotIndex, setAugmentSlotIndex] = useState(0);
  const [selectedAugmentId, setSelectedAugmentId] = useState(null);
  const [livePairState, setLivePairState] = useState(null);
  const [livePairMeta, setLivePairMeta] = useState(null);
  const [livePairKey, setLivePairKey] = useState(null);
  const [clockP1Ms, setClockP1Ms] = useState(CHESS_TIME_MS);
  const [clockP2Ms, setClockP2Ms] = useState(CHESS_TIME_MS);
  const [clockActive, setClockActive] = useState(null);
  const livePairKeyRef = useRef(null);
  const livePairExitTimerRef = useRef(null);
  const battleSocketHandlersRef = useRef({});
  const [draftMainIds, setDraftMainIds] = useState(Array(LEAGUE_MAIN_SLOT_COUNT).fill(null));
  const [draftReserveIds, setDraftReserveIds] = useState(Array(LEAGUE_RESERVE_SLOT_COUNT).fill(null));
  const [selectedDraftHeroId, setSelectedDraftHeroId] = useState(null);
  const [selectedDraftBoardSlot, setSelectedDraftBoardSlot] = useState(null);

  const league = gameState?.league4 || null;
  const myPlayerKey = useMemo(() => toPlayerKey(localSide), [localSide]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsCompact(window.innerWidth < 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const decision = league?.decision || { type: 'none', deadlineTs: 0, submissions: {} };
  const msLeft = Math.max(0, Number(decision.deadlineTs || 0) - now);
  const secondsLeft = Math.ceil(msLeft / 1000);
  const mySubmission = myPlayerKey ? decision.submissions?.[myPlayerKey] : null;
  const myTeam = myPlayerKey ? league.teams?.[myPlayerKey] : null;
  const shopState = league?.shopState || { offers: [], turnOrder: [], turnIndex: 0, purchases: [], passes: {} };
  const myEconomy = myPlayerKey ? (league?.economy?.[myPlayerKey] || { coins: 0, lossStreak: 0, totalEarned: 0, totalSpent: 0 }) : { coins: 0, lossStreak: 0, totalEarned: 0, totalSpent: 0 };
  const myOffers = Array.isArray(shopState?.offers) ? shopState.offers : [];
  const shopActivePlayerKey = decision.type === 'shop' ? (decision.activePlayerKey || null) : null;
  const isMyShopTurn = decision.type === 'shop' && !!myPlayerKey && shopActivePlayerKey === myPlayerKey;
  const myDraftPool = myPlayerKey ? (league.draftPools?.[myPlayerKey] || []) : [];

  const playerNameByKey = (playerKey) => {
    const idx = Number(String(playerKey || '').replace('player', '') || 0);
    return matchPlayers?.[`p${idx}`] || playerKey;
  };

  const positionLabel = (index) => {
    const inFront = ROW_ORDER.front.indexOf(index);
    if (inFront >= 0) return `Front ${String.fromCharCode(65 + inFront)}`;
    const inMiddle = ROW_ORDER.middle.indexOf(index);
    if (inMiddle >= 0) return `Middle ${String.fromCharCode(65 + inMiddle)}`;
    const inBack = ROW_ORDER.back.indexOf(index);
    if (inBack >= 0) return `Back ${String.fromCharCode(65 + inBack)}`;
    return `Slot ${index}`;
  };

  const heroName = (tile) => (tile && tile.hero ? (tile.hero.name || 'Hero') : 'Empty');

  const augmentCost = (offer) => {
    const tier = String(offer?.tier || 'common').toLowerCase();
    const byTier = {
      common: 5,
      uncommon: 7,
      rare: 9,
      epic: 12,
      legendary: 15
    };
    return Number(byTier[tier] || byTier.common);
  };

  const assignDraftHeroToSlot = (heroId, slotType, slotIndex) => {
    const main = [...draftMainIds];
    const reserve = [...draftReserveIds];
    const currentMainCount = main.filter(Boolean).length;
    const heroCurrentlyOnMain = main.includes(heroId);
    const targetCurrentHero = slotType === 'main' ? main[slotIndex] : reserve[slotIndex];
    const targetIsEmpty = !targetCurrentHero;

    if (
      slotType === 'main'
      && !heroCurrentlyOnMain
      && targetIsEmpty
      && currentMainCount >= 5
    ) {
      return;
    }

    for (let i = 0; i < main.length; i += 1) {
      if (main[i] === heroId) main[i] = null;
    }
    for (let i = 0; i < reserve.length; i += 1) {
      if (reserve[i] === heroId) reserve[i] = null;
    }

    if (slotType === 'main') main[slotIndex] = heroId;
    else reserve[slotIndex] = heroId;

    setDraftMainIds(main);
    setDraftReserveIds(reserve);
    setSelectedDraftHeroId(targetCurrentHero && targetCurrentHero !== heroId ? targetCurrentHero : (heroId || null));
    setSelectedDraftBoardSlot(null);
  };

  const swapDraftSlots = (a, b) => {
    const main = [...draftMainIds];
    const reserve = [...draftReserveIds];
    const getFrom = (slot) => (slot.slotType === 'reserve' ? reserve[slot.slotIndex] : main[slot.slotIndex]);
    const setTo = (slot, heroId) => {
      if (slot.slotType === 'reserve') reserve[slot.slotIndex] = heroId || null;
      else main[slot.slotIndex] = heroId || null;
    };
    const heroA = getFrom(a) || null;
    const heroB = getFrom(b) || null;
    setTo(a, heroB);
    setTo(b, heroA);
    setDraftMainIds(main);
    setDraftReserveIds(reserve);
  };

  const teamTileByHeroId = useMemo(() => {
    const map = new Map();
    const allTiles = [...(myTeam?.main || []), ...(myTeam?.reserve || [])];
    allTiles.forEach((tile) => {
      const heroId = tile?.hero?.id;
      if (heroId) map.set(String(heroId), tile);
    });
    return map;
  }, [myTeam]);

  const arrangedMain = useMemo(() => (
    arrangeMainIds.map((heroId) => (heroId ? teamTileByHeroId.get(String(heroId)) || null : null))
  ), [arrangeMainIds, teamTileByHeroId]);

  const arrangedReserve = useMemo(() => (
    arrangeReserveIds.map((heroId) => (heroId ? teamTileByHeroId.get(String(heroId)) || null : null))
  ), [arrangeReserveIds, teamTileByHeroId]);

  useEffect(() => {
    if (decision.type !== 'swap' || !Array.isArray(myTeam?.main)) return;
    if (mySubmission) return;
    setArrangeMainIds((myTeam.main || []).map((tile) => (tile?.hero?.id ? String(tile.hero.id) : null)));
    setArrangeReserveIds((myTeam.reserve || []).map((tile) => (tile?.hero?.id ? String(tile.hero.id) : null)));
    setArrangeSelectedSlot(null);
    setArrangeDragSlot(null);
  }, [decision.type, myTeam?.main, myTeam?.reserve, mySubmission]);

  useEffect(() => {
    const list = augmentSlotType === 'reserve' ? (myTeam?.reserve || []) : (myTeam?.main || []);
    const hasHeroAtIndex = !!(list?.[augmentSlotIndex] && list[augmentSlotIndex].hero);
    if (hasHeroAtIndex) return;
    const fallbackIndex = list.findIndex((tile) => tile && tile.hero);
    if (fallbackIndex >= 0) setAugmentSlotIndex(fallbackIndex);
    else setAugmentSlotIndex(0);
  }, [myTeam, augmentSlotType, augmentSlotIndex]);

  useEffect(() => {
    if (decision.type !== 'shop' || mySubmission) {
      setSelectedAugmentId(null);
    }
  }, [decision.type, mySubmission]);

  const onSubmitSwap = (noop = false) => {
    if (!socket || !myPlayerKey || decision.type !== 'swap') return;
    const placements = [];
    for (let i = 0; i < arrangeMainIds.length; i += 1) {
      const heroId = arrangeMainIds[i];
      if (!heroId) continue;
      placements.push({ heroId, slotType: 'main', slotIndex: i });
    }
    for (let i = 0; i < arrangeReserveIds.length; i += 1) {
      const heroId = arrangeReserveIds[i];
      if (!heroId) continue;
      placements.push({ heroId, slotType: 'reserve', slotIndex: i });
    }
    const mainCount = placements.filter((p) => p.slotType === 'main').length;
    const reserveCount = placements.filter((p) => p.slotType === 'reserve').length;
    const uniqueCount = new Set(placements.map((p) => String(p.heroId))).size;
    if (!noop && (mainCount !== 5 || reserveCount !== 2 || placements.length !== 7 || uniqueCount !== 7)) return;

    socket.emit('makeMove', {
      type: 'leagueSubmitSwap',
      noop,
      placements,
      sourceIndex: 0,
      targetIndex: 0
    });
  };

  const swapArrangeSlots = (a, b) => {
    const main = [...arrangeMainIds];
    const reserve = [...arrangeReserveIds];
    const getFrom = (slot) => (slot.slotType === 'reserve' ? reserve[slot.slotIndex] : main[slot.slotIndex]);
    const setTo = (slot, heroId) => {
      if (slot.slotType === 'reserve') reserve[slot.slotIndex] = heroId || null;
      else main[slot.slotIndex] = heroId || null;
    };
    const heroA = getFrom(a) || null;
    const heroB = getFrom(b) || null;
    setTo(a, heroB);
    setTo(b, heroA);
    setArrangeMainIds(main);
    setArrangeReserveIds(reserve);
  };

  const onSubmitShopBuy = (augmentId) => {
    if (!socket || !myPlayerKey || decision.type !== 'shop' || !isMyShopTurn) return;
    socket.emit('makeMove', {
      type: 'leagueShopAction',
      augmentId,
      slotType: augmentSlotType,
      slotIndex: Number(augmentSlotIndex)
    });
  };

  const onSubmitShopPass = () => {
    if (!socket || !myPlayerKey || decision.type !== 'shop' || !isMyShopTurn) return;
    socket.emit('makeMove', {
      type: 'leagueShopAction',
      pass: true
    });
  };

  const onSubmitDraft = () => {
    if (!socket || !myPlayerKey || decision.type !== 'draft') return;
    const placements = [];
    for (let i = 0; i < draftMainIds.length; i += 1) {
      const heroId = draftMainIds[i];
      if (!heroId) continue;
      placements.push({ heroId, slotType: 'main', slotIndex: i });
    }
    for (let i = 0; i < draftReserveIds.length; i += 1) {
      const heroId = draftReserveIds[i];
      if (!heroId) return;
      placements.push({ heroId, slotType: 'reserve', slotIndex: i });
    }
    const mainCount = placements.filter((p) => p.slotType === 'main').length;
    if (mainCount !== 5) return;
    if (placements.length !== 7) return;
    if (new Set(placements.map((p) => p.heroId)).size !== placements.length) return;
    socket.emit('makeMove', { type: 'leagueSubmitDraft', placements });
  };

  const standings = Array.isArray(league?.standingsSorted) ? league.standingsSorted : [];
  const latestCoinRewards = league?.latestCoinRewards || {};
  const hasCoinRewards = ['player1', 'player2', 'player3', 'player4'].some((pk) => {
    const rec = latestCoinRewards?.[pk];
    return rec && Number(rec.total || 0) > 0;
  });
  const formatResultTag = (result) => {
    if (result === 'win') return 'Win';
    if (result === 'loss') return 'Loss';
    return 'Draw';
  };
  const roundHistory = Array.isArray(league?.roundHistory) ? [...league.roundHistory].reverse() : [];
  const currentPairings = useMemo(() => {
    const schedule = Array.isArray(league?.roundSchedule) ? league.roundSchedule : [];
    const idx = Math.max(0, Math.min(schedule.length - 1, Number(league?.currentRound || 1) - 1));
    return Array.isArray(schedule[idx]) ? schedule[idx] : [];
  }, [league?.roundSchedule, league?.currentRound]);

  const nextRoundPairings = useMemo(() => {
    const schedule = Array.isArray(league?.roundSchedule) ? league.roundSchedule : [];
    const nextRound = Number(league?.currentRound || 1) + 1;
    if (nextRound > Number(league?.totalRounds || 0)) return [];
    const idx = Math.max(0, Math.min(schedule.length - 1, nextRound - 1));
    return Array.isArray(schedule[idx]) ? schedule[idx] : [];
  }, [league?.roundSchedule, league?.currentRound, league?.totalRounds]);

  const currentPairingForMe = useMemo(() => {
    if (!myPlayerKey) return null;
    const pair = (currentPairings || []).find((p) => Array.isArray(p) && p.includes(myPlayerKey));
    if (!pair) return null;
    const opponentKey = pair[0] === myPlayerKey ? pair[1] : pair[0];
    return { me: myPlayerKey, opponent: opponentKey };
  }, [currentPairings, myPlayerKey]);

  const currentPairKeyForMe = useMemo(() => {
    if (!currentPairingForMe) return null;
    return [currentPairingForMe.me, currentPairingForMe.opponent].sort().join('_vs_');
  }, [currentPairingForMe]);

  const pairAlreadyReported = useMemo(() => {
    if (!league || !currentPairKeyForMe) return false;
    return !!league.pendingMatchReports?.[currentPairKeyForMe];
  }, [league, currentPairKeyForMe]);

  const pairReportCount = useMemo(() => Object.keys(league?.pendingMatchReports || {}).length, [league?.pendingMatchReports]);
  const expectedPairReportCount = currentPairings.length;

  const waitingRoomActive = useMemo(() => {
    if (decision.type !== 'swap') return false;
    if (!mySubmission || !pairAlreadyReported) return false;
    return pairReportCount < expectedPairReportCount;
  }, [decision.type, mySubmission, pairAlreadyReported, pairReportCount, expectedPairReportCount]);

  useEffect(() => {
    if (decision.type !== 'draft' || !Array.isArray(myDraftPool) || myDraftPool.length === 0) return;
    if (mySubmission) return;
    setDraftMainIds(Array(LEAGUE_MAIN_SLOT_COUNT).fill(null));
    setDraftReserveIds(Array(LEAGUE_RESERVE_SLOT_COUNT).fill(null));
    setSelectedDraftHeroId(null);
    setSelectedDraftBoardSlot(null);
  }, [decision.type, myDraftPool, mySubmission]);

  useEffect(() => {
    livePairKeyRef.current = livePairKey;
  }, [livePairKey]);

  const scheduleLivePairExit = (delayMs = 3200) => {
    if (livePairExitTimerRef.current) {
      clearTimeout(livePairExitTimerRef.current);
      livePairExitTimerRef.current = null;
    }
    livePairExitTimerRef.current = setTimeout(() => {
      setLivePairState(null);
      setLivePairMeta(null);
      setLivePairKey(null);
      setClockActive(null);
      livePairExitTimerRef.current = null;
    }, Math.max(0, Number(delayMs || 0)));
  };

  useEffect(() => () => {
    if (livePairExitTimerRef.current) {
      clearTimeout(livePairExitTimerRef.current);
      livePairExitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!socket || !myPlayerKey) return;
    const handlePairState = (payload) => {
      if (!payload || !payload.pairKey || !payload.state) return;
      if (payload.a !== myPlayerKey && payload.b !== myPlayerKey) return;
      setLivePairKey(payload.pairKey);
      setLivePairMeta({ a: payload.a, b: payload.b });
      setLivePairState(payload.state);
    };
    const handlePairEnded = (payload) => {
      if (!payload || !payload.pairKey) return;
      if (payload.pairKey !== livePairKeyRef.current) return;
      scheduleLivePairExit(3200);
    };
    socket.on('leaguePairBattleState', handlePairState);
    socket.on('leaguePairBattleEnded', handlePairEnded);
    return () => {
      socket.off('leaguePairBattleState', handlePairState);
      socket.off('leaguePairBattleEnded', handlePairEnded);
    };
  }, [socket, myPlayerKey]);

  const liveBattleSocket = useMemo(() => {
    if (!socket) return null;
    return {
      on: (eventName, callback) => {
        if (eventName === 'step') {
          const handler = (payload) => {
            if (!payload || payload.pairKey !== livePairKeyRef.current) return;
            callback(payload);
          };
          battleSocketHandlersRef.current.step = handler;
          socket.on('leaguePairBattleStep', handler);
          return;
        }
        if (eventName === 'syncBattleAck') {
          battleSocketHandlersRef.current.syncBattleAck = callback;
          socket.on('syncBattleAck', callback);
        }
      },
      off: (eventName) => {
        const handler = battleSocketHandlersRef.current[eventName];
        if (!handler) return;
        if (eventName === 'step') {
          socket.off('leaguePairBattleStep', handler);
        } else if (eventName === 'syncBattleAck') {
          socket.off('syncBattleAck', handler);
        }
        delete battleSocketHandlersRef.current[eventName];
      },
      emit: (eventName, payload = {}) => {
        const pairKey = livePairKeyRef.current;
        if (!pairKey) return;
        if (eventName === 'movementMove') {
          socket.emit('movementMove', { ...payload, leaguePairKey: pairKey });
          return;
        }
        if (eventName === 'movementComplete') {
          socket.emit('movementComplete', { ...payload, leaguePairKey: pairKey });
          return;
        }
        if (eventName === 'stepAck') {
          socket.emit('stepAck', { ...payload, leaguePairKey: pairKey });
          return;
        }
        if (eventName === 'makeMove') {
          socket.emit('makeMove', { ...(payload || {}), leaguePairKey: pairKey });
        }
      }
    };
  }, [socket]);

  const formatClock = (ms) => {
    const safe = Math.max(0, Number(ms || 0));
    const totalSeconds = Math.ceil(safe / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!livePairState || !livePairMeta) {
      setClockActive(null);
      return;
    }
    if (livePairState.phase !== 'movement') {
      setClockActive(null);
      return;
    }
    const mover = livePairState?.movementPhase?.sequence?.[livePairState?.movementPhase?.index];
    if (mover === 'p1') setClockActive('player1');
    else if (mover === 'p2') setClockActive('player2');
    else setClockActive(null);
  }, [livePairState, livePairMeta]);

  useEffect(() => {
    if (!livePairState || !clockActive) return;
    const tickMs = 200;
    const timer = setInterval(() => {
      if (clockActive === 'player1') {
        setClockP1Ms((prev) => Math.max(0, prev - tickMs));
      } else if (clockActive === 'player2') {
        setClockP2Ms((prev) => Math.max(0, prev - tickMs));
      }
    }, tickMs);
    return () => clearInterval(timer);
  }, [clockActive, livePairState]);

  useEffect(() => {
    if (livePairState) return;
    setClockP1Ms(CHESS_TIME_MS);
    setClockP2Ms(CHESS_TIME_MS);
  }, [livePairState]);

  useEffect(() => {
    if (!livePairState) return;
    if (pairAlreadyReported) {
      scheduleLivePairExit(3200);
      return;
    }
    if (livePairKey && currentPairKeyForMe && livePairKey !== currentPairKeyForMe && decision.type === 'swap') {
      if (livePairExitTimerRef.current) {
        clearTimeout(livePairExitTimerRef.current);
        livePairExitTimerRef.current = null;
      }
      setLivePairState(null);
      setLivePairMeta(null);
      setLivePairKey(null);
      setClockActive(null);
    }
  }, [livePairState, pairAlreadyReported, livePairKey, currentPairKeyForMe, decision.type]);

  const draftHeroById = new Map(
    (myDraftPool || [])
      .filter((hero) => !!hero?.id)
      .map((hero) => [hero.id, hero])
  );

  const draftUsedIds = new Set([...draftMainIds, ...draftReserveIds].filter(Boolean));
  const draftReady = (() => {
    const mainCount = draftMainIds.filter(Boolean).length;
    const allReserve = draftReserveIds.every(Boolean);
    if (mainCount !== 5 || !allReserve) return false;
    return draftUsedIds.size === 7;
  })();

  const onArrangeTilePick = (slotType, slotIndex) => {
    if (mySubmission) return;
    const clicked = { slotType, slotIndex };
    if (!arrangeSelectedSlot) {
      setArrangeSelectedSlot(clicked);
      return;
    }
    if (arrangeSelectedSlot.slotType === clicked.slotType && arrangeSelectedSlot.slotIndex === clicked.slotIndex) {
      setArrangeSelectedSlot(null);
      return;
    }
    swapArrangeSlots(arrangeSelectedSlot, clicked);
    setArrangeSelectedSlot(null);
  };

  const arrangePlacements = useMemo(() => {
    const placements = [];
    for (let i = 0; i < arrangeMainIds.length; i += 1) {
      const heroId = arrangeMainIds[i];
      if (!heroId) continue;
      placements.push({ heroId, slotType: 'main', slotIndex: i });
    }
    for (let i = 0; i < arrangeReserveIds.length; i += 1) {
      const heroId = arrangeReserveIds[i];
      if (!heroId) continue;
      placements.push({ heroId, slotType: 'reserve', slotIndex: i });
    }
    return placements;
  }, [arrangeMainIds, arrangeReserveIds]);

  const arrangeReady = useMemo(() => {
    const mainCount = arrangePlacements.filter((p) => p.slotType === 'main').length;
    const reserveCount = arrangePlacements.filter((p) => p.slotType === 'reserve').length;
    if (mainCount !== 5 || reserveCount !== 2 || arrangePlacements.length !== 7) return false;
    return new Set(arrangePlacements.map((p) => String(p.heroId))).size === 7;
  }, [arrangePlacements]);

  if (!league) {
    return (
      <div style={{ padding: 24, color: '#fff' }}>
        Waiting for league state...
      </div>
    );
  }

  if (livePairState && livePairMeta && liveBattleSocket) {
    const meOnP1 = livePairMeta.a === myPlayerKey;
    const p1PlayerKey = livePairMeta.a;
    const p2PlayerKey = livePairMeta.b;
    return (
      <div style={{ minHeight: '100vh', background: '#0b1020' }}>
        <div style={{ padding: '8px 12px', color: '#fff', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>League Match: {playerNameByKey(p1PlayerKey)} vs {playerNameByKey(p2PlayerKey)}</span>
          <span style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: clockActive === 'player1' ? '#facc15' : '#e2e8f0' }}>{playerNameByKey(p1PlayerKey)} {formatClock(clockP1Ms)}</span>
            <span style={{ color: clockActive === 'player2' ? '#facc15' : '#e2e8f0' }}>{playerNameByKey(p2PlayerKey)} {formatClock(clockP2Ms)}</span>
          </span>
        </div>
        <BattlePhase
          key={`league-live-${livePairKey || 'pair'}-${Number(league?.currentRound || 0)}`}
          gameState={livePairState}
          socket={liveBattleSocket}
          onGameEnd={() => {}}
          aiDifficulty={null}
          autoPlay={true}
          battleSpeedMultiplier={4}
          localSide={meOnP1 ? 'p1' : 'p2'}
          showReturnToMenu={false}
          matchPlayers={{ p1: playerNameByKey(p1PlayerKey), p2: playerNameByKey(p2PlayerKey) }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: isCompact ? 10 : 16, color: '#fff', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'flex-start' : 'center', flexDirection: isCompact ? 'column' : 'row', gap: isCompact ? 8 : 0 }}>
        <div>
          <div style={{ fontSize: isCompact ? 22 : 28, fontWeight: 800 }}>League 4P</div>
          <div style={{ opacity: 0.9, fontSize: isCompact ? 13 : 15 }}>Round {league.currentRound} / {league.totalRounds} • Phase: {gameState.phase}</div>
        </div>
        <button onClick={onExit} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Leave</button>
      </div>

      {decision.type !== 'none' && !waitingRoomActive && (
        <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10 }}>
          Decision timer: <strong>{secondsLeft}s</strong>
          {mySubmission && <span style={{ marginLeft: 12, color: '#4ade80' }}>Submitted</span>}
        </div>
      )}

      {waitingRoomActive && (
        <div style={{ background: 'rgba(37,99,235,0.24)', border: '1px solid rgba(96,165,250,0.55)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Waiting Room</div>
          <div style={{ fontSize: 13, opacity: 0.92 }}>
            Your match is complete. Waiting for the other table to finish before the next round starts.
          </div>
        </div>
      )}

      {!league.completed && currentPairings.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Pairings</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 8 }}>
            {currentPairings.map((pair, idx) => {
              const a = Array.isArray(pair) ? pair[0] : null;
              const b = Array.isArray(pair) ? pair[1] : null;
              return (
                <div key={`pair-${idx}`} style={{ background: 'rgba(17,24,39,0.6)', borderRadius: 6, padding: '8px 10px' }}>
                  {playerNameByKey(a)} vs {playerNameByKey(b)}
                </div>
              );
            })}
          </div>
          {currentPairingForMe && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, opacity: 0.85 }}>
              Round-robin pairings are resolved from both players' submitted lineups once submissions are in.
            </div>
          )}
        </div>
      )}

      {!league.completed && nextRoundPairings.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Next Round Preview</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 8 }}>
            {nextRoundPairings.map((pair, idx) => {
              const a = Array.isArray(pair) ? pair[0] : null;
              const b = Array.isArray(pair) ? pair[1] : null;
              return (
                <div key={`next-pair-${idx}`} style={{ background: 'rgba(17,24,39,0.55)', borderRadius: 6, padding: '8px 10px' }}>
                  {playerNameByKey(a)} vs {playerNameByKey(b)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Standings</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Tie-break order: Points → Wins → Team Power
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isCompact ? 520 : 'auto', fontSize: isCompact ? 12 : 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>#</th>
              <th style={{ textAlign: 'left' }}>Player</th>
              <th>Pts</th>
              <th>W</th>
              <th>L</th>
              <th>D</th>
              <th>TB</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, rankIndex) => (
              <tr
                key={row.playerKey}
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  background: row.playerKey === myPlayerKey ? 'rgba(59,130,246,0.16)' : 'transparent'
                }}
              >
                <td style={{ padding: '4px 0' }}>{rankIndex + 1}</td>
                <td style={{ padding: '4px 0' }}>{row.username}{row.bot ? ' (Bot)' : ''}</td>
                <td style={{ textAlign: 'center' }}>{row.points}</td>
                <td style={{ textAlign: 'center' }}>{row.wins}</td>
                <td style={{ textAlign: 'center' }}>{row.losses}</td>
                <td style={{ textAlign: 'center' }}>{row.draws}</td>
                <td style={{ textAlign: 'center' }}>{row.tiebreakPower}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {hasCoinRewards && (
        <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Last Round Coin Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(220px, 1fr))', gap: 8 }}>
            {['player1', 'player2', 'player3', 'player4'].map((pk) => {
              const rec = latestCoinRewards?.[pk] || { base: 0, streakBonus: 0, catchupBonus: 0, total: 0, result: 'draw' };
              const isMe = pk === myPlayerKey;
              return (
                <div
                  key={`coins-${pk}`}
                  style={{
                    background: isMe ? 'rgba(59,130,246,0.18)' : 'rgba(2,6,23,0.45)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 13
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>{playerNameByKey(pk)}</strong>
                    <span style={{ opacity: 0.9 }}>{formatResultTag(rec.result)}</span>
                  </div>
                  <div style={{ opacity: 0.9 }}>Base: +{Number(rec.base || 0)}c</div>
                  <div style={{ opacity: 0.9 }}>Loss Streak: +{Number(rec.streakBonus || 0)}c</div>
                  <div style={{ opacity: 0.9 }}>Catch-up: +{Number(rec.catchupBonus || 0)}c</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: '#86efac' }}>Total: +{Number(rec.total || 0)}c</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {roundHistory.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10, maxHeight: isCompact ? 240 : 320, overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Battle Feed</div>
          {roundHistory.map((entry) => (
            <div key={`round-${entry.round}`} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Round {entry.round}</div>
              {(entry.results || []).map((r, idx) => {
                const aName = playerNameByKey(r.a);
                const bName = playerNameByKey(r.b);
                const wName = r.winner === 'draw' ? 'Draw' : playerNameByKey(r.winner);
                const hpA = Number(r?.remainingHealth?.[r.a] || 0);
                const hpB = Number(r?.remainingHealth?.[r.b] || 0);
                const reason = r.resolution === 'health_tiebreak' ? 'HP tie-break' : (r.resolution === 'knockout' ? 'Knockout' : 'Draw');
                return (
                  <div key={`${entry.round}-${idx}`} style={{ fontSize: 13, opacity: 0.95 }}>
                    {aName} vs {bName} → {wName} ({hpA}-{hpB}, {reason}, {r.roundsPlayed || 0} rounds)
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {decision.type === 'draft' && (
        <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Build Your Team (Pick 7 of 12)</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
            Choose 5 heroes for the 3x3 main board and 2 for reserve. Click or drag heroes onto slots.
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, var(--tile-size))', gap: 8 }}>
              {Array.from({ length: LEAGUE_MAIN_SLOT_COUNT }).map((_, slotIndex) => {
                const heroId = draftMainIds[slotIndex];
                const hero = heroId ? draftHeroById.get(heroId) : null;
                const selected = selectedDraftBoardSlot?.slotType === 'main' && selectedDraftBoardSlot?.slotIndex === slotIndex;
                const canDrop = !!selectedDraftHeroId && !mySubmission;
                return (
                  <div
                    key={`draft-main-${slotIndex}`}
                    className={`db-tile ${hero ? 'db-tile-occupied' : 'db-tile-empty'} ${canDrop ? 'db-tile-can-drop' : ''} ${selected ? 'db-tile-highlight-over' : ''}`}
                    onClick={() => {
                      if (selectedDraftHeroId) {
                        assignDraftHeroToSlot(selectedDraftHeroId, 'main', slotIndex);
                        return;
                      }
                      if (mySubmission) return;
                      const clicked = { slotType: 'main', slotIndex };
                      if (selectedDraftBoardSlot) {
                        if (selectedDraftBoardSlot.slotType === clicked.slotType && selectedDraftBoardSlot.slotIndex === clicked.slotIndex) {
                          setSelectedDraftBoardSlot(null);
                          return;
                        }
                        swapDraftSlots(selectedDraftBoardSlot, clicked);
                        setSelectedDraftBoardSlot(null);
                        return;
                      }
                      if (heroId) {
                        setSelectedDraftBoardSlot(clicked);
                      }
                    }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (mySubmission) return;
                      const heroIdFromDrag = e.dataTransfer.getData('text/plain');
                      if (heroIdFromDrag) assignDraftHeroToSlot(heroIdFromDrag, 'main', slotIndex);
                    }}
                    style={{ cursor: mySubmission ? 'default' : 'pointer', position: 'relative' }}
                  >
                    {hero?.image ? <img src={getAssetPath(hero.image)} alt={hero.name || 'Hero'} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0 }} /> : null}
                    {hero ? (
                      <div className="db-tile-name" style={{ zIndex: 2 }}>{hero.name}</div>
                    ) : (
                      <div className="db-tile-empty-text" style={{ textAlign: 'center', zIndex: 2 }}>
                        {positionLabel(slotIndex)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: LEAGUE_RESERVE_SLOT_COUNT }).map((_, slotIndex) => {
                const heroId = draftReserveIds[slotIndex];
                const hero = heroId ? draftHeroById.get(heroId) : null;
                const selected = selectedDraftBoardSlot?.slotType === 'reserve' && selectedDraftBoardSlot?.slotIndex === slotIndex;
                const canDrop = !!selectedDraftHeroId && !mySubmission;
                return (
                  <div
                    key={`draft-reserve-${slotIndex}`}
                    className={`db-tile ${hero ? 'db-tile-occupied' : 'db-tile-empty'} ${canDrop ? 'db-tile-can-drop' : ''} ${selected ? 'db-tile-highlight-over' : ''}`}
                    onClick={() => {
                      if (selectedDraftHeroId) {
                        assignDraftHeroToSlot(selectedDraftHeroId, 'reserve', slotIndex);
                        return;
                      }
                      if (mySubmission) return;
                      const clicked = { slotType: 'reserve', slotIndex };
                      if (selectedDraftBoardSlot) {
                        if (selectedDraftBoardSlot.slotType === clicked.slotType && selectedDraftBoardSlot.slotIndex === clicked.slotIndex) {
                          setSelectedDraftBoardSlot(null);
                          return;
                        }
                        swapDraftSlots(selectedDraftBoardSlot, clicked);
                        setSelectedDraftBoardSlot(null);
                        return;
                      }
                      if (heroId) {
                        setSelectedDraftBoardSlot(clicked);
                      }
                    }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (mySubmission) return;
                      const heroIdFromDrag = e.dataTransfer.getData('text/plain');
                      if (heroIdFromDrag) assignDraftHeroToSlot(heroIdFromDrag, 'reserve', slotIndex);
                    }}
                    style={{ cursor: mySubmission ? 'default' : 'pointer', position: 'relative' }}
                  >
                    {hero?.image ? <img src={getAssetPath(hero.image)} alt={hero.name || 'Hero'} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0 }} /> : null}
                    {hero ? (
                      <div className="db-tile-name" style={{ zIndex: 2 }}>{hero.name}</div>
                    ) : (
                      <div className="db-tile-empty-text" style={{ textAlign: 'center', zIndex: 2 }}>Reserve {slotIndex + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="db-hero-pool" style={{ marginBottom: 10 }}>
            {(myDraftPool || []).map((hero) => {
              const used = draftUsedIds.has(hero?.id);
              const selected = selectedDraftHeroId === hero?.id;
              return (
                <div
                  key={`draft-hero-${hero?.id || hero?.name}`}
                  className={`db-tile db-tile-occupied ${used ? 'db-tile-can-drag' : ''} ${selected ? 'db-tile-highlight-over' : ''}`}
                  draggable={!mySubmission}
                  onDragStart={(e) => {
                    setSelectedDraftHeroId(hero.id);
                    e.dataTransfer.setData('text/plain', hero.id);
                  }}
                  onClick={() => {
                    if (mySubmission) return;
                    setSelectedDraftHeroId(hero.id);
                    setSelectedDraftBoardSlot(null);
                  }}
                  style={{ cursor: mySubmission ? 'default' : 'grab', position: 'relative' }}
                  title={hero?.name || 'Hero'}
                >
                  {hero?.image ? <img src={getAssetPath(hero.image)} alt={hero.name || 'Hero'} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0, opacity: used ? 0.65 : 1 }} /> : null}
                  <div className="db-tile-name" style={{ zIndex: 2 }}>{hero?.name || 'Hero'}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onSubmitDraft}
              disabled={!!mySubmission || !draftReady}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
            >
              Confirm Team
            </button>
          </div>
        </div>
      )}

      {decision.type === 'swap' && myTeam && (
        <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Reposition Team</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
            Drag heroes between main and reserve slots (or click one slot then another to swap), then confirm your lineup.
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10, justifyContent: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, var(--tile-size))', gap: 8 }}>
              {Array.from({ length: 9 }).map((_, index) => {
                const tile = arrangedMain[index] || null;
                const selected = arrangeSelectedSlot?.slotType === 'main' && arrangeSelectedSlot?.slotIndex === index;
                const hero = tile?.hero || null;
                return (
                  <div
                    key={`swap-main-${index}`}
                    className={`db-tile ${hero ? 'db-tile-occupied' : 'db-tile-empty'} ${selected ? 'db-tile-highlight-over' : ''}`}
                    draggable={!mySubmission && !!hero}
                    onDragStart={(e) => {
                      if (mySubmission || !hero) return;
                      const slot = { slotType: 'main', slotIndex: index };
                      setArrangeDragSlot(slot);
                      if (e?.dataTransfer) {
                        e.dataTransfer.setData('text/plain', `main:${index}`);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (mySubmission) return;
                      const payload = e?.dataTransfer?.getData('text/plain') || '';
                      const [srcType, srcIndexRaw] = String(payload).split(':');
                      const srcIndex = Number(srcIndexRaw);
                      const sourceSlot = (Number.isInteger(srcIndex) && (srcType === 'main' || srcType === 'reserve'))
                        ? { slotType: srcType, slotIndex: srcIndex }
                        : arrangeDragSlot;
                      const targetSlot = { slotType: 'main', slotIndex: index };
                      if (!sourceSlot) return;
                      if (sourceSlot.slotType === targetSlot.slotType && sourceSlot.slotIndex === targetSlot.slotIndex) return;
                      swapArrangeSlots(sourceSlot, targetSlot);
                      setArrangeDragSlot(null);
                      setArrangeSelectedSlot(null);
                    }}
                    onClick={() => onArrangeTilePick('main', index)}
                    style={{ cursor: mySubmission ? 'default' : (hero ? 'grab' : 'pointer'), position: 'relative' }}
                    title={`${positionLabel(index)}${hero ? ` - ${hero.name}` : ''}`}
                  >
                    {hero?.image ? (
                      <img
                        src={getAssetPath(hero.image)}
                        alt={hero.name || 'Hero'}
                        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0 }}
                      />
                    ) : null}
                    {hero ? (
                      <div className="db-tile-name" style={{ zIndex: 2 }}>{hero.name}</div>
                    ) : (
                      <div className="db-tile-empty-text" style={{ textAlign: 'center', zIndex: 2 }}>{positionLabel(index)}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: LEAGUE_RESERVE_SLOT_COUNT }).map((_, index) => {
                const tile = arrangedReserve[index] || null;
                const selected = arrangeSelectedSlot?.slotType === 'reserve' && arrangeSelectedSlot?.slotIndex === index;
                const hero = tile?.hero || null;
                return (
                  <div
                    key={`swap-reserve-${index}`}
                    className={`db-tile ${hero ? 'db-tile-occupied' : 'db-tile-empty'} ${selected ? 'db-tile-highlight-over' : ''}`}
                    draggable={!mySubmission && !!hero}
                    onDragStart={(e) => {
                      if (mySubmission || !hero) return;
                      const slot = { slotType: 'reserve', slotIndex: index };
                      setArrangeDragSlot(slot);
                      if (e?.dataTransfer) {
                        e.dataTransfer.setData('text/plain', `reserve:${index}`);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (mySubmission) return;
                      const payload = e?.dataTransfer?.getData('text/plain') || '';
                      const [srcType, srcIndexRaw] = String(payload).split(':');
                      const srcIndex = Number(srcIndexRaw);
                      const sourceSlot = (Number.isInteger(srcIndex) && (srcType === 'main' || srcType === 'reserve'))
                        ? { slotType: srcType, slotIndex: srcIndex }
                        : arrangeDragSlot;
                      const targetSlot = { slotType: 'reserve', slotIndex: index };
                      if (!sourceSlot) return;
                      if (sourceSlot.slotType === targetSlot.slotType && sourceSlot.slotIndex === targetSlot.slotIndex) return;
                      swapArrangeSlots(sourceSlot, targetSlot);
                      setArrangeDragSlot(null);
                      setArrangeSelectedSlot(null);
                    }}
                    onClick={() => onArrangeTilePick('reserve', index)}
                    style={{ cursor: mySubmission ? 'default' : (hero ? 'grab' : 'pointer'), position: 'relative' }}
                    title={`Reserve ${index + 1}${hero ? ` - ${hero.name}` : ''}`}
                  >
                    {hero?.image ? (
                      <img
                        src={getAssetPath(hero.image)}
                        alt={hero.name || 'Hero'}
                        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0 }}
                      />
                    ) : null}
                    {hero ? (
                      <div className="db-tile-name" style={{ zIndex: 2 }}>{hero.name}</div>
                    ) : (
                      <div className="db-tile-empty-text" style={{ textAlign: 'center', zIndex: 2 }}>Reserve {index + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => onSubmitSwap(false)}
              disabled={!!mySubmission || !arrangeReady}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
            >
              Confirm Arrangement
            </button>
            <button
              onClick={() => {
                setArrangeMainIds((myTeam?.main || []).map((tile) => (tile?.hero?.id ? String(tile.hero.id) : null)));
                setArrangeReserveIds((myTeam?.reserve || []).map((tile) => (tile?.hero?.id ? String(tile.hero.id) : null)));
                setArrangeSelectedSlot(null);
              }}
              disabled={!!mySubmission}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
            >
              Reset Layout
            </button>
            <button onClick={() => onSubmitSwap(true)} disabled={!!mySubmission} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>No-op</button>
          </div>
        </div>
      )}

      {decision.type === 'shop' && (
        <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Augment Draft Shop</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
            Coins: <strong>{myEconomy.coins || 0}</strong> • Loss Streak: <strong>{myEconomy.lossStreak || 0}</strong>
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
            Turn: <strong>{shopActivePlayerKey ? playerNameByKey(shopActivePlayerKey) : 'None'}</strong>
            {isMyShopTurn ? ' (Your pick)' : ''}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
            Click a hero tile to choose your augment target, then buy from the shared 5-card shop.
          </div>

          {Array.isArray(shopState?.turnOrder) && shopState.turnOrder.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
              {shopState.turnOrder.map((pk, idx) => {
                const done = idx < Number(shopState?.turnIndex || 0);
                const active = idx === Number(shopState?.turnIndex || 0);
                return (
                  <div
                    key={`shop-order-${pk}-${idx}`}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: active ? '1px solid rgba(250,204,21,0.9)' : '1px solid rgba(255,255,255,0.15)',
                      background: done ? 'rgba(34,197,94,0.2)' : active ? 'rgba(250,204,21,0.2)' : 'rgba(17,24,39,0.65)',
                      color: '#fff'
                    }}
                  >
                    {idx + 1}. {playerNameByKey(pk)}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, var(--tile-size))', gap: 8 }}>
              {Array.from({ length: LEAGUE_MAIN_SLOT_COUNT }).map((_, index) => {
                const tile = (myTeam?.main || [])[index] || null;
                const hero = tile?.hero || null;
                const selected = augmentSlotType === 'main' && Number(augmentSlotIndex) === index;
                return (
                  <div
                    key={`augment-main-${index}`}
                    className={`db-tile ${hero ? 'db-tile-occupied' : 'db-tile-empty'} ${selected ? 'db-tile-highlight-over' : ''}`}
                    onClick={() => {
                      if (!hero || !isMyShopTurn || mySubmission) return;
                      setAugmentSlotType('main');
                      setAugmentSlotIndex(index);
                    }}
                    style={{ cursor: (!hero || !isMyShopTurn || mySubmission) ? 'default' : 'pointer', position: 'relative' }}
                    title={`${positionLabel(index)}${hero ? ` - ${hero.name}` : ''}`}
                  >
                    {hero?.image ? <img src={getAssetPath(hero.image)} alt={hero.name || 'Hero'} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0 }} /> : null}
                    {hero ? (
                      <div className="db-tile-name" style={{ zIndex: 2 }}>{hero.name}</div>
                    ) : (
                      <div className="db-tile-empty-text" style={{ textAlign: 'center', zIndex: 2 }}>{positionLabel(index)}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: LEAGUE_RESERVE_SLOT_COUNT }).map((_, index) => {
                const tile = (myTeam?.reserve || [])[index] || null;
                const hero = tile?.hero || null;
                const selected = augmentSlotType === 'reserve' && Number(augmentSlotIndex) === index;
                return (
                  <div
                    key={`augment-reserve-${index}`}
                    className={`db-tile ${hero ? 'db-tile-occupied' : 'db-tile-empty'} ${selected ? 'db-tile-highlight-over' : ''}`}
                    onClick={() => {
                      if (!hero || !isMyShopTurn || mySubmission) return;
                      setAugmentSlotType('reserve');
                      setAugmentSlotIndex(index);
                    }}
                    style={{ cursor: (!hero || !isMyShopTurn || mySubmission) ? 'default' : 'pointer', position: 'relative' }}
                    title={`Reserve ${index + 1}${hero ? ` - ${hero.name}` : ''}`}
                  >
                    {hero?.image ? <img src={getAssetPath(hero.image)} alt={hero.name || 'Hero'} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, zIndex: 0 }} /> : null}
                    {hero ? (
                      <div className="db-tile-name" style={{ zIndex: 2 }}>{hero.name}</div>
                    ) : (
                      <div className="db-tile-empty-text" style={{ textAlign: 'center', zIndex: 2 }}>Reserve {index + 1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {myOffers.map((offer) => (
              <button
                key={offer.id}
                onClick={() => {
                  if (mySubmission || !isMyShopTurn) return;
                  setSelectedAugmentId(offer.id);
                }}
                disabled={!!mySubmission || !isMyShopTurn}
                style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: selectedAugmentId === offer.id ? '1px solid rgba(96,165,250,0.9)' : '1px solid rgba(255,255,255,0.2)', background: selectedAugmentId === offer.id ? 'rgba(30,58,138,0.55)' : 'rgba(17,24,39,0.7)', color: '#fff', cursor: (!!mySubmission || !isMyShopTurn) ? 'default' : 'pointer' }}
              >
                <div style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{offer.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>{augmentCost(offer)}c</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{offer.tier}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{offer.description}</div>
              </button>
            ))}
            {myOffers.length === 0 && (
              <div style={{ fontSize: 13, opacity: 0.8 }}>All augments were bought this round.</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <button
              onClick={() => {
                if (!selectedAugmentId) return;
                onSubmitShopBuy(selectedAugmentId);
              }}
              disabled={!!mySubmission || !selectedAugmentId || !isMyShopTurn || (myEconomy.coins || 0) < augmentCost(myOffers.find((o) => o.id === selectedAugmentId))}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
            >
              Buy Augment
            </button>
            <button
              onClick={onSubmitShopPass}
              disabled={!!mySubmission || !isMyShopTurn}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {league.completed && (
        <div style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
            League complete! Winner: {matchPlayers?.[`p${Number((league.winner || '').replace('player', '') || 0)}`] || league.winner}
          </div>
          {league.summary?.mvpHero && (
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              MVP Hero: {league.summary.mvpHero.heroName} ({league.summary.mvpHero.slotType} {league.summary.mvpHero.slotIndex}) • Augments {league.summary.mvpHero.augmentCount}
            </div>
          )}
          {league.summary?.dominantMatch && (
            <div style={{ fontSize: 13 }}>
              Most Dominant Match: Round {league.summary.dominantMatch.round} — {playerNameByKey(league.summary.dominantMatch.a)} vs {playerNameByKey(league.summary.dominantMatch.b)}
              {' '}({playerNameByKey(league.summary.dominantMatch.winner)} won by {league.summary.dominantMatch.hpDiff} HP)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
