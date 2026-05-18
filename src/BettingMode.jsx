import React, { useEffect, useMemo, useState } from 'react';
import BattlePhase from './BattlePhase';
import getAssetPath from './utils/assetPath';

function countdownText(deadlineTs, nowMs = Date.now()) {
  if (!deadlineTs) return '00:00';
  const leftMs = Math.max(0, Number(deadlineTs) - Number(nowMs));
  const sec = Math.floor(leftMs / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function HeroTile({ tile }) {
  const tileWidth = 82;
  const tileHeight = 112;
  const portraitHeight = 64;
  const heroImage = tile?.hero?.image ? getAssetPath(tile.hero.image) : '';

  if (!tile || !tile.hero) {
    return <div style={{ width: tileWidth, height: tileHeight, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)' }} />;
  }

  return (
    <div style={{ width: tileWidth, minHeight: tileHeight, borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(20,20,28,0.8)', overflow: 'hidden' }}>
      <div style={{ height: portraitHeight, background: 'rgba(0,0,0,0.35)' }}>
        <img
          src={heroImage}
          alt={tile.hero.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div style={{ padding: '4px 6px', fontSize: 11, color: '#fff', fontWeight: 700 }}>{tile.hero.name}</div>
      <div style={{ padding: '0 6px 6px', fontSize: 10, color: '#cfd3ff' }}>
        HP {tile.hero.health} | AR {tile.hero.armor} | SP {tile.hero.speed}
      </div>
    </div>
  );
}

function TeamBoard({ teamName, main, reserve }) {
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center', maxWidth: '100%' }}>
      <div style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>{teamName}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 82px)', gap: 8 }}>
        {(main || []).map((tile, idx) => <HeroTile key={`m-${idx}`} tile={tile} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(reserve || []).map((tile, idx) => <HeroTile key={`r-${idx}`} tile={tile} />)}
      </div>
    </div>
  );
}

function getSideBetWinConditionText(sideBet) {
  if (!sideBet) return '';
  if (sideBet.id === 1) return 'Win condition: closest prediction to winning team total Health.';
  if (sideBet.id === 3) return 'Win condition: closest prediction to winning team total Energy.';
  if (sideBet.id === 2) return 'Win condition: closest prediction to the ending round.';
  if (sideBet.id === 9) return 'Win condition: closest prediction to any round tied for the highest death count.';
  return 'Win condition: closest prediction wins.';
}

function formatSideBetCorrectAnswer(roundSummary) {
  const sideBet = roundSummary?.sideBet;
  const outcome = roundSummary?.sideBetOutcome || {};
  const heroNameByUid = outcome.heroNameByUid || {};
  if (!sideBet) return 'Unavailable';

  const heroList = (uids) => {
    const names = (uids || []).map((uid) => heroNameByUid[uid] || String(uid)).filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'None';
  };

  if (sideBet.id === 1) return `Winning team total Health: ${Number(outcome.winningTeamHealth || 0)}`;
  if (sideBet.id === 2) return `Game ended on round: ${Number(roundSummary?.endRound || 0)}`;
  if (sideBet.id === 3) return `Winning team total Energy: ${Number(outcome.winningTeamEnergy || 0)}`;
  if (sideBet.id === 4) return `Hero with most damage: ${heroList(outcome.mostDamageHeroes)}`;
  if (sideBet.id === 5) return `Hero with least casts (alive): ${heroList(outcome.leastCastsAliveHeroes)}`;
  if (sideBet.id === 6) return `Hero with most casts (alive): ${heroList(outcome.mostCastsAliveHeroes)}`;
  if (sideBet.id === 7) return `First hero to die: ${heroList(outcome.firstToDieHeroes)}`;
  if (sideBet.id === 8) return `Last hero to die on losing team: ${heroList(outcome.lastDieOnLosingTeamHeroes)}`;
  if (sideBet.id === 9) {
    const rounds = Array.isArray(outcome.roundsWithMostDeaths) ? outcome.roundsWithMostDeaths : [];
    return `Round with most hero deaths: ${rounds.length > 0 ? rounds.join(', ') : 'N/A'}`;
  }
  return 'Unavailable';
}

function getBattleSnapshotRound(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  return Number(snapshot?.roundNumber || snapshot?.state?.roundNumber || 0);
}

function getBattleSnapshotSeq(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  return Number(snapshot?.seq || snapshot?.state?.seq || 0);
}

export default function BettingMode({ socket, onExit }) {
  const [lobbyState, setLobbyState] = useState(null);
  const [lobbyBrowser, setLobbyBrowser] = useState([]);
  const [status, setStatus] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createVisibility, setCreateVisibility] = useState('public');
  const [primaryPick, setPrimaryPick] = useState('p1');
  const [primaryAmount, setPrimaryAmount] = useState(1);
  const [sideAmount, setSideAmount] = useState('0');
  const [sidePrediction, setSidePrediction] = useState('');
  const [localBetSubmitted, setLocalBetSubmitted] = useState(false);
  const [battleVisualCompleteAcked, setBattleVisualCompleteAcked] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [stableCoinsByPlayer, setStableCoinsByPlayer] = useState({});
  const [isSocketConnected, setIsSocketConnected] = useState(!!socket?.connected);
  const [liveBattleState, setLiveBattleState] = useState(null);
  const [battleSyncVersion, setBattleSyncVersion] = useState(0);
  const battleUiActiveRef = React.useRef(false);
  const currentRoundRef = React.useRef(0);
  const syncedBattleSeqRef = React.useRef(0);
  const battleStepActivityAtRef = React.useRef(0);
  const battleSocketHandlerMapRef = React.useRef(new Map());
  const latestBattleSnapshotSeqRef = React.useRef(0);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    battleUiActiveRef.current = lobbyState?.phase === 'battle';
  }, [lobbyState?.phase]);

  useEffect(() => {
    if (!socket || lobbyState?.phase === 'battle') return undefined;
    battleSocketHandlerMapRef.current.forEach((wrapped) => {
      socket.off('bettingBattleStep', wrapped);
    });
    battleSocketHandlerMapRef.current.clear();
    return undefined;
  }, [lobbyState?.phase, socket]);

  useEffect(() => {
    currentRoundRef.current = Number(lobbyState?.currentRound || 0);
  }, [lobbyState?.currentRound]);

  useEffect(() => {
    if (!socket) return undefined;

    setIsSocketConnected(!!socket.connected);

    const onLobbyState = (payload) => {
      if (payload && Number.isFinite(Number(payload.serverNowTs))) {
        setServerTimeOffsetMs(Number(payload.serverNowTs) - Date.now());
      }
      const lobbyRound = Number(payload?.currentRound || 0);
      const nextLiveState = payload?.battle?.liveState || null;
      const nextLiveRound = getBattleSnapshotRound(nextLiveState);
      const nextLiveSeq = getBattleSnapshotSeq(nextLiveState);
      if (payload?.phase === 'battle' && nextLiveState && nextLiveRound === lobbyRound && nextLiveSeq >= Number(latestBattleSnapshotSeqRef.current || 0)) {
        latestBattleSnapshotSeqRef.current = nextLiveSeq;
        battleStepActivityAtRef.current = Date.now();
        setLiveBattleState(nextLiveState);
      } else if (payload?.phase !== 'battle') {
        setLiveBattleState(null);
      }
      setLobbyState(payload || null);
      setStatus('');
    };
    const onBattleState = (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const activeRound = Number(currentRoundRef.current || 0);
      const payloadRound = getBattleSnapshotRound(payload);
      if (activeRound > 0 && payloadRound > 0 && payloadRound !== activeRound) return;
      const payloadSeq = getBattleSnapshotSeq(payload);
      if (payload.forceSync) {
        syncedBattleSeqRef.current = Math.max(syncedBattleSeqRef.current, Number(payload?.seq || 0));
        latestBattleSnapshotSeqRef.current = Math.max(latestBattleSnapshotSeqRef.current, payloadSeq);
        battleStepActivityAtRef.current = Date.now();
        setLiveBattleState(payload);
        if (Number(payload?.seq || 0) > 0) {
          socket.emit('bettingBattleStepAck', { seq: Number(payload.seq) });
        }
        setBattleSyncVersion((value) => value + 1);
        return;
      }
      if (payloadSeq < Number(latestBattleSnapshotSeqRef.current || 0)) {
        return;
      }
      latestBattleSnapshotSeqRef.current = payloadSeq;
      battleStepActivityAtRef.current = Date.now();
      if (battleUiActiveRef.current) {
        return;
      }
      setLiveBattleState(payload);
    };
    const onError = (payload) => {
      const message = payload?.message || 'Betting mode error.';
      setStatus(message);
      // If submission was rejected, allow another attempt.
      if (!/already submitted/i.test(String(message))) {
        setLocalBetSubmitted(false);
      }
    };
    const onLeft = () => {
      setLobbyState(null);
      setLiveBattleState(null);
      setLocalBetSubmitted(false);
      setBattleVisualCompleteAcked(false);
      socket.emit('listBettingLobbies');
    };
    const onBrowser = (payload) => setLobbyBrowser(Array.isArray(payload?.lobbies) ? payload.lobbies : []);
    const onConnect = () => {
      setIsSocketConnected(true);
      socket.emit('listBettingLobbies');
      if (currentRoundRef.current > 0) {
        socket.emit('requestBettingBattleSync');
      }
    };
    const onDisconnect = () => {
      setIsSocketConnected(false);
      setStatus('Connection lost. Reconnecting...');
    };
    const onConnectError = () => {
      setIsSocketConnected(false);
    };

    socket.on('bettingLobbyState', onLobbyState);
    socket.on('bettingError', onError);
    socket.on('bettingLeftLobby', onLeft);
    socket.on('bettingLobbyBrowser', onBrowser);
    socket.on('bettingBattleState', onBattleState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.emit('listBettingLobbies');

    return () => {
      socket.off('bettingLobbyState', onLobbyState);
      socket.off('bettingError', onError);
      socket.off('bettingLeftLobby', onLeft);
      socket.off('bettingLobbyBrowser', onBrowser);
      socket.off('bettingBattleState', onBattleState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      battleSocketHandlerMapRef.current.forEach((wrapped) => {
        socket.off('bettingBattleStep', wrapped);
      });
      battleSocketHandlerMapRef.current.clear();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !isSocketConnected) return undefined;
    if (lobbyState) return undefined;
    const intervalId = setInterval(() => {
      socket.emit('listBettingLobbies');
    }, 5000);
    return () => clearInterval(intervalId);
  }, [socket, isSocketConnected, lobbyState]);

  useEffect(() => {
    if (!socket) return undefined;
    const onVisibilityChange = () => {
      if (document.hidden) return;
      if (currentRoundRef.current <= 0) return;
      if (battleUiActiveRef.current) {
        socket.emit('requestBettingBattleSync');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [socket]);

  useEffect(() => {
    if (!socket || !lobbyState || lobbyState.phase !== 'battle') return undefined;
    battleStepActivityAtRef.current = Date.now();
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      const idleMs = Date.now() - Number(battleStepActivityAtRef.current || 0);
      if (idleMs < 10000) return;
      battleStepActivityAtRef.current = Date.now();
      socket.emit('requestBettingBattleSync');
    }, 3000);
    return () => clearInterval(intervalId);
  }, [socket, lobbyState?.phase, lobbyState?.currentRound]);

  useEffect(() => {
    if (lobbyState?.phase !== 'betting') return;
    const sideBet = lobbyState?.battle?.sideBet;
    setPrimaryAmount((prev) => Math.max(1, Number(prev || 1)));
    setSideAmount((prev) => {
      if (prev === '') return '';
      return String(Math.max(0, Number(prev || 0)));
    });

    if (sideBet?.predictionType === 'hero') {
      const options = sideBet.heroOptions || [];
      setSidePrediction((prev) => {
        const hasCurrent = options.some((opt) => String(opt.uid) === String(prev));
        if (hasCurrent) return String(prev);
        return options.length > 0 ? String(options[0].uid) : '';
      });
    } else if (sideBet?.predictionType === 'number') {
      setSidePrediction((prev) => {
        const raw = String(prev ?? '').trim();
        return /^-?\d+$/.test(raw) ? raw : '1';
      });
    } else {
      setSidePrediction('');
    }
  }, [lobbyState?.phase, lobbyState?.currentRound, lobbyState?.battle?.sideBet?.id]);

  useEffect(() => {
    if (lobbyState?.phase !== 'betting') {
      setLocalBetSubmitted(false);
      return;
    }
    // New betting round: clear local lock first.
    setLocalBetSubmitted(false);
  }, [lobbyState?.phase, lobbyState?.currentRound]);

  useEffect(() => {
    if (lobbyState?.phase !== 'betting') return;
    if (lobbyState?.me?.hasSubmittedBet) {
      setLocalBetSubmitted(true);
    }
  }, [lobbyState?.phase, lobbyState?.me?.hasSubmittedBet]);

  useEffect(() => {
    setBattleVisualCompleteAcked(false);
  }, [lobbyState?.code, lobbyState?.currentRound]);

  useEffect(() => {
    if (lobbyState?.phase === 'battle') return;
    syncedBattleSeqRef.current = 0;
    battleStepActivityAtRef.current = 0;
    latestBattleSnapshotSeqRef.current = 0;
  }, [lobbyState?.phase, lobbyState?.code, lobbyState?.currentRound]);

  useEffect(() => {
    if (!lobbyState || !Array.isArray(lobbyState.players)) {
      setStableCoinsByPlayer({});
      return;
    }
    if (lobbyState.phase === 'battle') return;
    const next = {};
    lobbyState.players.forEach((player) => {
      if (!player || player.id == null) return;
      next[String(player.id)] = Number(player.coins || 0);
    });
    setStableCoinsByPlayer(next);
  }, [lobbyState?.phase, lobbyState?.players]);


  const me = lobbyState?.me || null;
  const battle = lobbyState?.battle || null;
  const sideBet = battle?.sideBet || null;
  const hasSubmittedBet = lobbyState?.phase === 'betting' && (localBetSubmitted || !!lobbyState?.me?.hasSubmittedBet);
  const canUseDesperationBet = lobbyState?.phase === 'betting' && !!lobbyState?.me?.canUseDesperationBet;

  const isHost = useMemo(() => {
    if (!lobbyState || !me) return false;
    return String(lobbyState.hostId) === String(me.id);
  }, [lobbyState, me]);

  const syncedNowMs = nowMs + serverTimeOffsetMs;
  const shouldRenderBattle = lobbyState?.phase === 'battle' || (!!liveBattleState && lobbyState?.phase === 'settling');

  const getVisibleCoins = (playerId, fallbackCoins = 0) => {
    const id = String(playerId || '');
    if (lobbyState?.phase === 'battle' && Object.prototype.hasOwnProperty.call(stableCoinsByPlayer, id)) {
      return Number(stableCoinsByPlayer[id] || 0);
    }
    return Number(fallbackCoins || 0);
  };

  const battleGameState = useMemo(() => {
    if (liveBattleState) {
      return {
        ...liveBattleState,
        gameMode: 'classic'
      };
    }
    if (!battle) return null;
    return {
      p1Main: battle.p1Main || [],
      p2Main: battle.p2Main || [],
      p1Reserve: battle.p1Reserve || [],
      p2Reserve: battle.p2Reserve || [],
      phase: 'battle',
      gameMode: 'classic',
      roundNumber: Number(lobbyState?.currentRound || 1),
      priorityPlayer: 'player1',
      lastAction: null
    };
  }, [battle, lobbyState?.currentRound, liveBattleState]);

  const bettingBattleSocket = useMemo(() => ({
    on: (eventName, callback) => {
      if (!socket || typeof callback !== 'function') return;
      const mapped = eventName === 'step' ? 'bettingBattleStep' : eventName;
      if (mapped === 'bettingBattleStep') {
        const wrapped = (payload) => {
          const seq = Number(payload?.seq || 0);
          if (seq > 0 && seq <= Number(syncedBattleSeqRef.current || 0)) {
            socket.emit('bettingBattleStepAck', { seq });
            battleStepActivityAtRef.current = Date.now();
            return;
          }
          battleStepActivityAtRef.current = Date.now();
          callback(payload);
        };
        battleSocketHandlerMapRef.current.set(callback, wrapped);
        socket.on(mapped, wrapped);
        return;
      }
      socket.on(mapped, callback);
    },
    off: (eventName, callback) => {
      if (!socket) return;
      const mapped = eventName === 'step' ? 'bettingBattleStep' : eventName;
      if (mapped === 'bettingBattleStep') {
        const wrapped = battleSocketHandlerMapRef.current.get(callback);
        if (wrapped) {
          socket.off(mapped, wrapped);
          battleSocketHandlerMapRef.current.delete(callback);
          return;
        }
      }
      socket.off(mapped, callback);
    },
    emit: (eventName, payload) => {
      if (!socket) return;
      if (eventName === 'stepAck') {
        socket.emit('bettingBattleStepAck', payload || {});
      } else if (eventName === 'makeMove' && payload?.type === 'syncBattleState') {
        socket.emit('requestBettingBattleSync');
      } else if (eventName === 'forceBattleSync') {
        socket.emit('requestBettingBattleSync');
      }
    }
  }), [socket]);

  const leaveLobby = () => {
    if (!socket) return;
    socket.emit('leaveBettingLobby');
    setLobbyState(null);
  };

  const exitMode = () => {
    if (socket) socket.emit('leaveBettingLobby');
    onExit();
  };

  const placeBet = () => {
    if (!socket || !lobbyState || lobbyState.phase !== 'betting') return;
    if (hasSubmittedBet) return;
    const normalizedPrimaryAmount = canUseDesperationBet ? 1 : Number(primaryAmount || 0);
    const normalizedSideAmount = canUseDesperationBet ? 0 : Number(sideAmount === '' ? 0 : sideAmount);
    const normalizedSidePrediction = sideBet?.predictionType === 'number'
      ? (() => {
          const numeric = Number(sidePrediction);
          return Number.isFinite(numeric) ? String(Math.floor(numeric)) : '1';
        })()
      : sidePrediction;
    setLocalBetSubmitted(true);
    setStatus('');
    socket.emit('placeBettingBet', {
      primaryPick,
      primaryAmount: normalizedPrimaryAmount,
      sideAmount: normalizedSideAmount,
      sidePrediction: normalizedSidePrediction
    });
  };

  const renderLobbyEntry = () => (
    <div style={{ width: '100%', maxWidth: 520, padding: 18, borderRadius: 14, background: 'rgba(14, 16, 25, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Online Betting Lobbies</div>
      <div style={{ color: '#c8cff3', marginBottom: 12, fontSize: 14 }}>
        Create a lobby or join with a code. Host can start at 2-12 players.
      </div>
      <div style={{ marginBottom: 10, fontSize: 12, color: isSocketConnected ? '#97f4a9' : '#ffd166' }}>
        Connection: {isSocketConnected ? 'Connected' : 'Disconnected'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={createVisibility}
          onChange={(e) => setCreateVisibility(e.target.value)}
          style={{ padding: '10px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(0,0,0,0.26)', color: '#fff' }}
        >
          <option value="public" style={{ color: '#111' }}>Public</option>
          <option value="private" style={{ color: '#111' }}>Private</option>
        </select>
        <button
          onClick={() => {
            if (!socket || !isSocketConnected) {
              setStatus('Not connected to server. Please wait for reconnect.');
              return;
            }
            socket.emit('createBettingLobbyWithVisibility', { visibility: createVisibility });
          }}
          disabled={!isSocketConnected}
          style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#35a66a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
        >
          {createVisibility === 'private' ? 'Create Private Lobby' : 'Create Public Lobby'}
        </button>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode((e.target.value || '').toUpperCase())}
          placeholder="LOBBY CODE"
          maxLength={8}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(0,0,0,0.26)', color: '#fff', width: 160 }}
        />
        <button
          onClick={() => {
            if (!socket || !isSocketConnected) {
              setStatus('Not connected to server. Please wait for reconnect.');
              return;
            }
            socket.emit('joinBettingLobby', { code: joinCode });
          }}
          disabled={!isSocketConnected}
          style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#3f63d8', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
        >
          Join Lobby
        </button>
        <button
          onClick={() => {
            if (!socket || !isSocketConnected) {
              setStatus('Not connected to server. Please wait for reconnect.');
              return;
            }
            socket.emit('listBettingLobbies');
          }}
          disabled={!isSocketConnected}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#c8cff3' }}>
        Note: Private lobbies do not appear in the public browser list.
      </div>

      <div style={{ marginTop: 12, maxHeight: 220, overflow: 'auto', display: 'grid', gap: 6 }}>
        {lobbyBrowser.length === 0 && <div style={{ color: '#9ca3d5', fontSize: 13 }}>No public lobbies available.</div>}
        {lobbyBrowser.map((row) => (
          <div key={`${row.code}-${row.phase}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{row.code}</div>
              <div style={{ fontSize: 12, color: '#c8cff3' }}>{row.hostUsername}</div>
              {row.serverInstanceId && <div style={{ fontSize: 11, color: '#9ca3d5' }}>Instance: {row.serverInstanceId}</div>}
            </div>
            <div style={{ fontSize: 12 }}>Phase: {row.phase}</div>
            <div style={{ fontSize: 12 }}>{row.onlinePlayers}/{row.totalPlayers}</div>
            <button
              disabled={!row.canJoin}
              onClick={() => socket && socket.emit('joinBettingLobby', { code: row.code })}
              style={{ padding: '6px 8px', borderRadius: 8, border: 'none', background: row.canJoin ? '#3f63d8' : '#555', color: '#fff', cursor: row.canJoin ? 'pointer' : 'not-allowed', fontWeight: 700 }}
            >
              Join
            </button>
          </div>
        ))}
      </div>

      {status && <div style={{ marginTop: 10, color: '#ffd166' }}>{status}</div>}

      <button
        onClick={exitMode}
        style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.28)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
      >
        Back
      </button>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '20px', boxSizing: 'border-box', color: '#fff' }}>
      {!lobbyState && renderLobbyEntry()}

      {lobbyState && (
        <>
          <div style={{ position: 'fixed', left: 18, top: 14, zIndex: 100, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.64)', border: '1px solid rgba(255,255,255,0.24)', fontWeight: 800 }}>
            Coins: {me ? getVisibleCoins(me.id, me.coins) : 0}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Betting Lobby {lobbyState.code}</div>
            <div style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.14)', fontSize: 13 }}>Round {lobbyState.currentRound}/{lobbyState.totalRounds}</div>
            <div style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.14)', fontSize: 13 }}>Phase: {lobbyState.phase}</div>
            <button onClick={leaveLobby} style={{ marginLeft: 'auto', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.24)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Leave Lobby</button>
            <button onClick={exitMode} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.24)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Exit Mode</button>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', minWidth: 300, maxWidth: 360, padding: 12, borderRadius: 12, background: 'rgba(9, 10, 16, 0.75)', border: '1px solid rgba(255,255,255,0.22)' }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Players ({lobbyState.players.length}/12) • {lobbyState.visibility}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {lobbyState.players.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>
                    <span>{p.username}{p.isHost ? ' (Host)' : ''}{p.online === false ? ' (Offline)' : ''}</span>
                    <span>{getVisibleCoins(p.id, p.coins)} coins</span>
                  </div>
                ))}
              </div>
              {lobbyState.phase === 'lobby' && (
                <button
                  onClick={() => socket && socket.emit('startBettingGame')}
                  disabled={!isHost || !lobbyState.canStart}
                  style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: isHost ? '#e6682e' : '#555', color: '#fff', cursor: isHost ? 'pointer' : 'not-allowed', fontWeight: 800 }}
                >
                  Start Game (Host Only)
                </button>
              )}
            </div>

            <div style={{ flex: '2 1 620px', minWidth: 320, maxWidth: '100%', overflowX: 'hidden', padding: 12, borderRadius: 12, background: 'rgba(9, 10, 16, 0.75)', border: '1px solid rgba(255,255,255,0.22)' }}>
              {battle && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800 }}>AI Match: {battle.bots.p1} vs {battle.bots.p2}</div>
                    {lobbyState.phase === 'betting' && <div style={{ fontWeight: 800, color: '#ffcf7a' }}>Bet Timer: {countdownText(lobbyState.betDeadlineTs, syncedNowMs)}</div>}
                    {lobbyState.phase === 'settling' && <div style={{ fontWeight: 800, color: '#ffd166' }}>Preparing Battle Replay...</div>}
                    {lobbyState.phase === 'battle' && <div style={{ fontWeight: 800, color: '#97f4a9' }}>Watching Battle (4x): live</div>}
                    {lobbyState.phase === 'summary' && <div style={{ fontWeight: 800, color: '#9ad4ff' }}>Next Round: {countdownText(lobbyState.summaryDeadlineTs, syncedNowMs)}</div>}
                  </div>

                  {shouldRenderBattle && battleGameState ? (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 8, borderRadius: 10, overflow: 'hidden' }}>
                      <BattlePhase
                        key={`bet-live-${lobbyState.code}-${lobbyState.currentRound}-${battleSyncVersion}`}
                        gameState={battleGameState}
                        socket={bettingBattleSocket}
                        onGameEnd={() => {}}
                        onBattleVisualComplete={() => {
                          if (!socket || battleVisualCompleteAcked) return;
                          setBattleVisualCompleteAcked(true);
                          socket.emit('bettingBattleVisualComplete', { round: lobbyState?.currentRound });
                        }}
                        aiDifficulty={null}
                        autoPlay={false}
                        localSide="p1"
                        showReturnToMenu={false}
                        disableBackgroundFastForward={false}
                        battleSpeedMultiplier={4}
                        matchPlayers={{ p1: battle.bots.p1, p2: battle.bots.p2 }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start', justifyItems: 'center', width: '100%' }}>
                      <TeamBoard teamName={battle.bots.p1} main={battle.p1Main} reserve={battle.p1Reserve} />
                      <TeamBoard teamName={battle.bots.p2} main={battle.p2Main} reserve={battle.p2Reserve} />
                    </div>
                  )}
                </div>
              )}

              {lobbyState.phase === 'betting' && sideBet && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 12, display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>Primary Bet ({canUseDesperationBet ? 'desperation bet: 1 coin only' : 'minimum 1 coin'})</div>
                  {canUseDesperationBet && (
                    <div style={{ fontSize: 13, color: '#ffd166' }}>
                      You are out of coins. You may place one desperation bet on the main winner only. If you win, you come back with 1 coin.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label>Pick Winner</label>
                    <select value={primaryPick} onChange={(e) => setPrimaryPick(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
                      <option value="p1">{battle.bots.p1}</option>
                      <option value="p2">{battle.bots.p2}</option>
                    </select>
                    <label>Amount</label>
                    <input type="number" min={1} value={canUseDesperationBet ? 1 : primaryAmount} disabled={canUseDesperationBet} onChange={(e) => setPrimaryAmount(e.target.value)} style={{ width: 90, padding: 8, borderRadius: 8, opacity: canUseDesperationBet ? 0.7 : 1 }} />
                  </div>

                  <div style={{ fontWeight: 900, marginTop: 4 }}>Side Bet ({sideBet.title})</div>
                  <div style={{ fontSize: 13, color: '#c8cff3' }}>{sideBet.prompt} | Max 5 coins | Pays {sideBet.multiplier}x</div>
                  {canUseDesperationBet && <div style={{ fontSize: 12, color: '#e8d9b8' }}>Side bets are disabled while using a desperation bet.</div>}
                  <div style={{ fontSize: 12, color: '#e8d9b8' }}>{getSideBetWinConditionText(sideBet)}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label>Side Amount</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={canUseDesperationBet ? '0' : sideAmount}
                      disabled={canUseDesperationBet}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setSideAmount('');
                          return;
                        }
                        const next = Math.max(0, Math.min(5, Number(raw)));
                        setSideAmount(String(next));
                      }}
                      style={{ width: 90, padding: 8, borderRadius: 8, opacity: canUseDesperationBet ? 0.7 : 1 }}
                    />

                    {sideBet.predictionType === 'hero' && (
                      <>
                        <label>Pick Hero</label>
                        <select value={sidePrediction} disabled={canUseDesperationBet} onChange={(e) => setSidePrediction(e.target.value)} style={{ minWidth: 220, padding: 8, borderRadius: 8, opacity: canUseDesperationBet ? 0.7 : 1 }}>
                          {(sideBet.heroOptions || []).map((option) => (
                            <option key={option.uid} value={option.uid}>{option.name} ({option.team})</option>
                          ))}
                        </select>
                      </>
                    )}

                    {sideBet.predictionType === 'number' && (
                      <>
                        <label>Prediction</label>
                        <input value={sidePrediction} disabled={canUseDesperationBet} onChange={(e) => setSidePrediction(e.target.value)} type="number" min={0} style={{ width: 120, padding: 8, borderRadius: 8, opacity: canUseDesperationBet ? 0.7 : 1 }} />
                      </>
                    )}
                  </div>

                  <button
                    onClick={placeBet}
                    disabled={hasSubmittedBet}
                    style={{
                      width: 180,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: hasSubmittedBet ? '#596171' : '#2f9d73',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: hasSubmittedBet ? 'not-allowed' : 'pointer',
                      opacity: hasSubmittedBet ? 0.75 : 1
                    }}
                  >
                    Submit Bet
                  </button>
                  {status && <div style={{ color: '#ffd166' }}>{status}</div>}
                </div>
              )}

              {lobbyState.phase === 'summary' && lobbyState.roundSummary && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Round {lobbyState.roundSummary.round} Summary</div>
                  <div style={{ fontSize: 14, marginBottom: 10 }}>
                    Winner: {lobbyState.roundSummary.winnerName} | Ended on round {lobbyState.roundSummary.endRound}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 6, color: '#d6dcff' }}>
                    Main Bet Correct Answer: {lobbyState.roundSummary.winnerName}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 10, color: '#d6dcff' }}>
                    Side Bet Correct Answer: {formatSideBetCorrectAnswer(lobbyState.roundSummary)}
                  </div>
                  {lobbyState.roundSummary.debug && (
                    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', fontSize: 12, color: '#c8cff3' }}>
                      Debug: source={String(lobbyState.roundSummary.debug.outcomeSource || 'unknown')} | simMs={Number(lobbyState.roundSummary.debug.simulationElapsedMs || 0)} | simTimeout={String(!!lobbyState.roundSummary.debug.simulationTimedOut)} | replaySteps={Number(lobbyState.roundSummary.debug.replaySteps || 0)} | settleMs={Number(lobbyState.roundSummary.debug.settleElapsedMs || 0)}
                    </div>
                  )}
                  <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 6 }}>
                    {(lobbyState.roundSummary.rows || []).map((row) => (
                      <div key={row.playerId} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px', fontSize: 13, alignItems: 'center' }}>
                        <span>{row.username}</span>
                        <span>{row.coinsBefore} {'->'} {row.coinsAfter}</span>
                        <span>Main: {row.wonPrimary ? '+' : '-'}{Number(row.primaryAmount || 0)}</span>
                        <span>
                          Side: {row.wonSide
                            ? `+${Math.max(0, Number(row.sideAmount || 0) * (Number(lobbyState.roundSummary.sideBet?.multiplier || 0) - 1))}`
                            : `-${Number(row.sideAmount || 0)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lobbyState.phase === 'complete' && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 12 }}>
                  {Array.isArray(lobbyState.finalStandings) && lobbyState.finalStandings.length > 0 && (
                    <div style={{ marginBottom: 10, borderRadius: 10, background: 'linear-gradient(135deg, rgba(248,190,67,0.22), rgba(154,102,34,0.22))', border: '1px solid rgba(255,224,142,0.45)', padding: '10px 12px' }}>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>Victory: {lobbyState.finalStandings[0].username}</div>
                      <div style={{ fontSize: 13, color: '#ffe8b8' }}>Champion after {lobbyState.totalRounds} rounds with {lobbyState.finalStandings[0].coins} coins</div>
                    </div>
                  )}
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Final Winners</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {(lobbyState.finalStandings || []).map((row, index) => (
                      <div key={`${row.username}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px' }}>
                        <span>#{index + 1} {row.username}</span>
                        <span>{row.coins} coins</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
