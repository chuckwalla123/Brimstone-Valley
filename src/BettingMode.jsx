import React, { useEffect, useMemo, useRef, useState } from 'react';
import BattlePhase from './BattlePhase';

function countdownText(deadlineTs) {
  if (!deadlineTs) return '00:00';
  const leftMs = Math.max(0, Number(deadlineTs) - Date.now());
  const sec = Math.floor(leftMs / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function HeroTile({ tile }) {
  if (!tile || !tile.hero) {
    return <div style={{ width: 90, height: 120, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)' }} />;
  }

  return (
    <div style={{ width: 90, minHeight: 120, borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(20,20,28,0.8)', overflow: 'hidden' }}>
      <div style={{ height: 70, background: 'rgba(0,0,0,0.35)' }}>
        <img
          src={tile.hero.image}
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
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      <div style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>{teamName}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 90px)', gap: 8 }}>
        {(main || []).map((tile, idx) => <HeroTile key={`m-${idx}`} tile={tile} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(reserve || []).map((tile, idx) => <HeroTile key={`r-${idx}`} tile={tile} />)}
      </div>
    </div>
  );
}

export default function BettingMode({ socket, onExit }) {
  const [lobbyState, setLobbyState] = useState(null);
  const [lobbyBrowser, setLobbyBrowser] = useState([]);
  const [status, setStatus] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createVisibility, setCreateVisibility] = useState('public');
  const [primaryPick, setPrimaryPick] = useState('p1');
  const [primaryAmount, setPrimaryAmount] = useState(1);
  const [sideAmount, setSideAmount] = useState(0);
  const [sidePrediction, setSidePrediction] = useState('');
  const [timerTick, setTimerTick] = useState(0);
  const replayHandlersRef = useRef({ step: [] });
  const replayTimerRef = useRef(null);

  useEffect(() => {
    const tick = setInterval(() => setTimerTick((prev) => prev + 1), 500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const onLobbyState = (payload) => {
      setLobbyState(payload || null);
      setStatus('');
    };
    const onError = (payload) => setStatus(payload?.message || 'Betting mode error.');
    const onLeft = () => setLobbyState(null);
    const onBrowser = (payload) => setLobbyBrowser(Array.isArray(payload?.lobbies) ? payload.lobbies : []);

    socket.on('bettingLobbyState', onLobbyState);
    socket.on('bettingError', onError);
    socket.on('bettingLeftLobby', onLeft);
    socket.on('bettingLobbyBrowser', onBrowser);
    socket.emit('listBettingLobbies');

    return () => {
      socket.off('bettingLobbyState', onLobbyState);
      socket.off('bettingError', onError);
      socket.off('bettingLeftLobby', onLeft);
      socket.off('bettingLobbyBrowser', onBrowser);
      socket.emit('leaveBettingLobby');
    };
  }, [socket]);

  useEffect(() => {
    if (lobbyState?.phase !== 'betting') return;
    const sideBet = lobbyState?.battle?.sideBet;
    setPrimaryAmount((prev) => Math.max(1, Number(prev || 1)));
    setSideAmount((prev) => Math.max(0, Number(prev || 0)));

    if (sideBet?.predictionType === 'hero') {
      const options = sideBet.heroOptions || [];
      const hasCurrent = options.some((opt) => String(opt.uid) === String(sidePrediction));
      if (!hasCurrent && options.length > 0) {
        setSidePrediction(String(options[0].uid));
      }
    } else if (sideBet?.predictionType === 'number') {
      if (sidePrediction === '') setSidePrediction('1');
    }
  }, [lobbyState?.phase, lobbyState?.battle?.sideBet?.id]);

  const emitReplayStep = (step) => {
    const handlers = replayHandlersRef.current.step || [];
    handlers.forEach((fn) => {
      try {
        fn(step);
      } catch (e) {}
    });
  };

  useEffect(() => {
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }

    const replay = lobbyState?.battle?.replay;
    if (lobbyState?.phase !== 'battle' || !replay || !Array.isArray(replay.steps) || replay.steps.length === 0) return;

    let index = 0;
    const durationMs = Math.max(1200, Number((lobbyState?.battleDeadlineTs || 0) - Date.now()) || 8000);
    const stepMs = Math.max(6, Math.floor(durationMs / Math.max(1, replay.steps.length)));

    const tick = () => {
      if (index >= replay.steps.length) {
        replayTimerRef.current = null;
        return;
      }
      emitReplayStep(replay.steps[index]);
      index += 1;
      replayTimerRef.current = setTimeout(tick, stepMs);
    };
    tick();

    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [lobbyState?.phase, lobbyState?.battle?.replay, lobbyState?.battleDeadlineTs]);

  const replaySocket = useMemo(() => ({
    on: (eventName, callback) => {
      if (!eventName || typeof callback !== 'function') return;
      const key = String(eventName);
      if (!replayHandlersRef.current[key]) replayHandlersRef.current[key] = [];
      replayHandlersRef.current[key].push(callback);
    },
    off: (eventName, callback) => {
      const key = String(eventName || '');
      if (!replayHandlersRef.current[key]) return;
      if (!callback) {
        replayHandlersRef.current[key] = [];
        return;
      }
      replayHandlersRef.current[key] = replayHandlersRef.current[key].filter((fn) => fn !== callback);
    },
    emit: () => {}
  }), []);

  const me = lobbyState?.me || null;
  const battle = lobbyState?.battle || null;
  const sideBet = battle?.sideBet || null;

  const isHost = useMemo(() => {
    if (!lobbyState || !me) return false;
    return String(lobbyState.hostId) === String(me.id);
  }, [lobbyState, me]);

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
    socket.emit('placeBettingBet', {
      primaryPick,
      primaryAmount: Number(primaryAmount || 0),
      sideAmount: Number(sideAmount || 0),
      sidePrediction
    });
    setStatus('Bet submitted. You can resubmit before timer ends.');
  };

  const renderLobbyEntry = () => (
    <div style={{ width: '100%', maxWidth: 520, padding: 18, borderRadius: 14, background: 'rgba(14, 16, 25, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Online Betting Lobbies</div>
      <div style={{ color: '#c8cff3', marginBottom: 12, fontSize: 14 }}>
        Create a lobby or join with a code. Host can start at 2-12 players.
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
          onClick={() => socket && socket.emit('createBettingLobbyWithVisibility', { visibility: createVisibility })}
          style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#35a66a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
        >
          Create Lobby
        </button>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode((e.target.value || '').toUpperCase())}
          placeholder="LOBBY CODE"
          maxLength={8}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(0,0,0,0.26)', color: '#fff', width: 160 }}
        />
        <button
          onClick={() => socket && socket.emit('joinBettingLobby', { code: joinCode })}
          style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#3f63d8', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
        >
          Join Lobby
        </button>
        <button
          onClick={() => socket && socket.emit('listBettingLobbies')}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 12, maxHeight: 220, overflow: 'auto', display: 'grid', gap: 6 }}>
        {lobbyBrowser.length === 0 && <div style={{ color: '#9ca3d5', fontSize: 13 }}>No public lobbies available.</div>}
        {lobbyBrowser.map((row) => (
          <div key={`${row.code}-${row.phase}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{row.code}</div>
              <div style={{ fontSize: 12, color: '#c8cff3' }}>{row.hostUsername}</div>
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
    <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: 20, color: '#fff' }}>
      {!lobbyState && renderLobbyEntry()}

      {lobbyState && (
        <>
          <div style={{ position: 'fixed', right: 18, top: 14, zIndex: 100, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.64)', border: '1px solid rgba(255,255,255,0.24)', fontWeight: 800 }}>
            Coins: {me ? me.coins : 0}
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
                    <span>{p.coins} coins</span>
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

            <div style={{ flex: '2 1 620px', minWidth: 320, padding: 12, borderRadius: 12, background: 'rgba(9, 10, 16, 0.75)', border: '1px solid rgba(255,255,255,0.22)' }}>
              {battle && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800 }}>AI Match: {battle.bots.p1} vs {battle.bots.p2}</div>
                    {lobbyState.phase === 'betting' && <div style={{ fontWeight: 800, color: '#ffcf7a' }}>Bet Timer: {countdownText(lobbyState.betDeadlineTs + timerTick * 0)}</div>}
                    {lobbyState.phase === 'battle' && <div style={{ fontWeight: 800, color: '#97f4a9' }}>Watching Battle (4x): {countdownText(lobbyState.battleDeadlineTs + timerTick * 0)}</div>}
                    {lobbyState.phase === 'summary' && <div style={{ fontWeight: 800, color: '#9ad4ff' }}>Next Round: {countdownText(lobbyState.summaryDeadlineTs + timerTick * 0)}</div>}
                  </div>

                  {(lobbyState.phase !== 'battle') && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <TeamBoard teamName={battle.bots.p1} main={battle.p1Main} reserve={battle.p1Reserve} />
                    <TeamBoard teamName={battle.bots.p2} main={battle.p2Main} reserve={battle.p2Reserve} />
                    </div>
                  )}

                  {(lobbyState.phase === 'battle' && battle?.replay?.initialState) && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 8, borderRadius: 10, overflow: 'hidden' }}>
                      <BattlePhase
                        key={`bet-replay-${lobbyState.code}-${lobbyState.currentRound}`}
                        gameState={battle.replay.initialState}
                        socket={replaySocket}
                        onGameEnd={() => {}}
                        aiDifficulty={null}
                        autoPlay={false}
                        localSide="p1"
                        showReturnToMenu={false}
                        battleSpeedMultiplier={4}
                        matchPlayers={{ p1: battle.bots.p1, p2: battle.bots.p2 }}
                      />
                    </div>
                  )}
                </div>
              )}

              {lobbyState.phase === 'betting' && sideBet && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 12, display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>Primary Bet (minimum 1 coin)</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label>Pick Winner</label>
                    <select value={primaryPick} onChange={(e) => setPrimaryPick(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
                      <option value="p1">{battle.bots.p1}</option>
                      <option value="p2">{battle.bots.p2}</option>
                    </select>
                    <label>Amount</label>
                    <input type="number" min={1} value={primaryAmount} onChange={(e) => setPrimaryAmount(e.target.value)} style={{ width: 90, padding: 8, borderRadius: 8 }} />
                  </div>

                  <div style={{ fontWeight: 900, marginTop: 4 }}>Side Bet ({sideBet.title})</div>
                  <div style={{ fontSize: 13, color: '#c8cff3' }}>{sideBet.prompt} | Max 5 coins | Pays {sideBet.multiplier}x</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label>Side Amount</label>
                    <input type="number" min={0} max={5} value={sideAmount} onChange={(e) => setSideAmount(e.target.value)} style={{ width: 90, padding: 8, borderRadius: 8 }} />

                    {sideBet.predictionType === 'hero' && (
                      <>
                        <label>Pick Hero</label>
                        <select value={sidePrediction} onChange={(e) => setSidePrediction(e.target.value)} style={{ minWidth: 220, padding: 8, borderRadius: 8 }}>
                          {(sideBet.heroOptions || []).map((option) => (
                            <option key={option.uid} value={option.uid}>{option.name} ({option.team})</option>
                          ))}
                        </select>
                      </>
                    )}

                    {sideBet.predictionType === 'number' && (
                      <>
                        <label>Prediction</label>
                        <input value={sidePrediction} onChange={(e) => setSidePrediction(e.target.value)} type="number" min={0} style={{ width: 120, padding: 8, borderRadius: 8 }} />
                      </>
                    )}
                  </div>

                  <button onClick={placeBet} style={{ width: 180, padding: '10px 12px', borderRadius: 10, border: 'none', background: '#2f9d73', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
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
                  <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 6 }}>
                    {(lobbyState.roundSummary.rows || []).map((row) => (
                      <div key={row.playerId} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px', fontSize: 13 }}>
                        <span>{row.username}</span>
                        <span>{row.coinsBefore} {'->'} {row.coinsAfter}</span>
                        <span>Payout: {row.payout}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lobbyState.phase === 'complete' && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: 12 }}>
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
