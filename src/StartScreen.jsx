import React, { useEffect, useState } from 'react';
import { loginWithEmail, registerWithEmail, getStoredSession, clearSession, getPlayerStatisticsFromSocket } from './playfabClient';
import OptionsModal from './OptionsModal';
import musicManager from './MusicManager';

export default function StartScreen({ onSelectMode, onLoginSuccess, onMatchFound, socket, playFabUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [session, setSession] = useState(null);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchInfo, setMatchInfo] = useState(null);
  const [showOnlineMenu, setShowOnlineMenu] = useState(false);
  const [showLocalMenu, setShowLocalMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [playerStats, setPlayerStats] = useState(null);
  const [playerStatsStatus, setPlayerStatsStatus] = useState('idle');
  const [playerStatsError, setPlayerStatsError] = useState('');
  const [pendingMatchRequest, setPendingMatchRequest] = useState(null); // { payload, searchingMessage }
  const [serverInstanceId, setServerInstanceId] = useState('');

  const sessionPlayFabId = String(session?.playFabId || '');
  const serverAuthedPlayFabId = String(playFabUser?.playFabId || '');
  const hasMatchingServerAuth = !!sessionPlayFabId && sessionPlayFabId === serverAuthedPlayFabId;

  // Fetch player stats when session changes or online menu is shown
  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      if (!session) {
        setPlayerStats(null);
        setPlayerStatsStatus('idle');
        setPlayerStatsError('');
        return;
      }

      if (!showOnlineMenu) return;

      if (!socket?.connected) {
        setPlayerStats(null);
        setPlayerStatsStatus('loading');
        setPlayerStatsError('');
        return;
      }

      if (sessionPlayFabId && !hasMatchingServerAuth) {
        setPlayerStats(null);
        setPlayerStatsStatus('loading');
        setPlayerStatsError('');
        return;
      }

      setPlayerStatsStatus('loading');
      setPlayerStatsError('');

      try {
        const stats = await getPlayerStatisticsFromSocket(socket);

        if (cancelled) return;
        setPlayerStats(stats);
        setPlayerStatsStatus('loaded');
      } catch (e) {
        if (cancelled) return;
        console.error('[PlayFab] Could not fetch stats:', e.message, e);
        setPlayerStats(null);
        setPlayerStatsStatus('error');
        setPlayerStatsError(e.message || 'Could not load player stats.');
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [session, showOnlineMenu, socket, hasMatchingServerAuth, sessionPlayFabId]);

  useEffect(() => {
    const s = getStoredSession();
    if (s) {
      setSession(s);
      setAuthStatus(`Logged in${s.username ? ` as ${s.username}` : ''}`);
    }
    try {
      const cachedEmail = localStorage.getItem('lastLoginEmail');
      if (cachedEmail) setEmail(cachedEmail);
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      if (email) localStorage.setItem('lastLoginEmail', email);
    } catch (e) {}
  }, [email]);

  useEffect(() => {
    if (!socket) return;
    const onQueued = (payload) => {
      const pos = payload && typeof payload.position === 'number' ? ` (queue #${payload.position})` : '';
      const nextServerInstanceId = payload?.serverInstanceId ? String(payload.serverInstanceId) : '';
      if (nextServerInstanceId) {
        setServerInstanceId(nextServerInstanceId);
      }
      const instanceText = nextServerInstanceId ? ` on ${nextServerInstanceId}` : '';
      setMatchStatus(`Searching for match...${pos}${instanceText}`);
    };
    const onFound = (payload) => {
      if (payload?.serverInstanceId) {
        setServerInstanceId(String(payload.serverInstanceId));
      }
      setMatchStatus('Match found!');
      setMatchInfo(payload || null);
      if (onMatchFound) onMatchFound(payload || null);
    };
    const onError = (payload) => setMatchStatus(payload?.message || 'Match error');
    const onCanceled = () => setMatchStatus('Matchmaking canceled');
    socket.on('matchQueued', onQueued);
    socket.on('matchFound', onFound);
    socket.on('matchError', onError);
    socket.on('matchCanceled', onCanceled);
    return () => {
      socket.off('matchQueued', onQueued);
      socket.off('matchFound', onFound);
      socket.off('matchError', onError);
      socket.off('matchCanceled', onCanceled);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !pendingMatchRequest) return;
    if (!socket.connected || !hasMatchingServerAuth) return;

    setMatchStatus(pendingMatchRequest.searchingMessage || 'Searching for match...');
    socket.emit('findMatch', pendingMatchRequest.payload || {});
    setPendingMatchRequest(null);
  }, [socket, pendingMatchRequest, hasMatchingServerAuth]);

  useEffect(() => {
    if (!socket) return;
    const emitAuth = () => {
      if (session?.sessionTicket) {
        socket.emit('auth', { sessionTicket: session.sessionTicket });
      }
    };
    const onConnect = () => emitAuth();
    socket.on('connect', onConnect);
    if (socket.connected && session?.sessionTicket && !playFabUser) {
      emitAuth();
    }
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, session?.sessionTicket, playFabUser]);

  useEffect(() => {
    const nextServerInstanceId = playFabUser?.serverInstanceId ? String(playFabUser.serverInstanceId) : '';
    if (nextServerInstanceId) {
      setServerInstanceId(nextServerInstanceId);
    }
  }, [playFabUser?.serverInstanceId]);
  const buttonStyle = {
    width: '350px',
    height: '90px',
    fontSize: '1.5rem',
    fontWeight: '700',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const activeButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #434343 0%, #2a2a2a 100%)',
    color: '#888',
    cursor: 'not-allowed',
    opacity: 0.6,
  };

  const requestMatch = (payload, searchingMessage) => {
    setMatchInfo(null);

    if (!socket) {
      setMatchStatus('Socket unavailable.');
      return;
    }

    const doRequest = () => {
      const currentSession = getStoredSession();
      const currentSessionPlayFabId = String(currentSession?.playFabId || session?.playFabId || '');
      const currentServerPlayFabId = String(playFabUser?.playFabId || '');
      if (!currentSessionPlayFabId || currentServerPlayFabId !== currentSessionPlayFabId) {
        setPendingMatchRequest({ payload: payload || {}, searchingMessage });
        setMatchStatus('Waiting for server auth...');
        if (currentSession?.sessionTicket) socket.emit('auth', { sessionTicket: currentSession.sessionTicket });
        return;
      }
      setMatchStatus(searchingMessage);
      socket.emit('findMatch', payload || {});
    };

    if (socket.connected) {
      doRequest();
      return;
    }

    setMatchStatus('Reconnecting to server...');
    let settled = false;
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };
    const onConnect = () => {
      if (settled) return;
      settled = true;
      cleanup();
      doRequest();
    };
    const onConnectError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      setMatchStatus('Could not connect to server.');
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
    try {
      socket.connect();
    } catch (e) {
      onConnectError();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        gap: '20px',
        padding: '20px',
        zIndex: 1000,
      }}
    >
      <h1
        style={{
          fontSize: '3.5rem',
          fontWeight: '900',
          color: '#fff',
          marginBottom: '30px',
          textShadow: '0 4px 8px rgba(0,0,0,0.5)',
          letterSpacing: '2px',
        }}
      >
        BRIMSTONE VALLEY
      </h1>

      {showOnlineMenu && (
      <div style={{ width: '100%', maxWidth: 520, background: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>PlayFab Login</div>
        {/* Show logged-in user prominently */}
        {session && session.username && (
          <div style={{ 
            padding: '12px 16px', 
            marginBottom: 12, 
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
            borderRadius: 8,
            border: '1px solid rgba(102, 126, 234, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ fontSize: 24 }}>👤</div>
            <div>
              <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase' }}>Logged in as</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{session.username}</div>
            </div>
          </div>
        )}
        {authStatus && !session?.username && <div style={{ fontSize: 14, marginBottom: 8, color: '#fff', fontWeight: 600 }}>{authStatus}</div>}
        {!session && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
              <input
                placeholder="Username (required for new accounts)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
                onClick={async () => {
                  try {
                    
                    if (!email || !password) {
                      setAuthStatus('Enter email and password to log in.');
                      return;
                    }
                    setAuthStatus('Logging in...');
                    
                    const data = await loginWithEmail({ email, password });
                    
                    const s = getStoredSession();
                    setSession(s);
                    setAuthStatus(`Logged in${s?.username ? ` as ${s.username}` : ''}`);
                    onLoginSuccess && onLoginSuccess(data);
                  } catch (e) {
                    console.error('PlayFab login failed:', e);
                    setAuthStatus(`Login failed: ${e.message}`);
                  }
                }}
              >
                Log In
              </button>
              <button
                style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
                onClick={async () => {
                  try {
                    
                    if (!email || !password) {
                      setAuthStatus('Enter email and password to create an account.');
                      return;
                    }
                    if (!username || username.trim().length < 3) {
                      setAuthStatus('Username is required (at least 3 characters).');
                      return;
                    }
                    setAuthStatus('Creating account...');
                    
                    const data = await registerWithEmail({ email, password, username });
                    
                    const s = getStoredSession();
                    setSession(s);
                    setAuthStatus(`Account created${s?.username ? ` as ${s.username}` : ''}`);
                    onLoginSuccess && onLoginSuccess(data);
                  } catch (e) {
                    console.error('PlayFab register failed:', e);
                    setAuthStatus(`Create failed: ${e.message}`);
                  }
                }}
              >
                Create Account
              </button>
            </div>
          </>
        )}
        {session && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
              onClick={() => {
                clearSession();
                setSession(null);
                setPlayerStats(null);
                setPlayerStatsStatus('idle');
                setPlayerStatsError('');
                setAuthStatus('Logged out');
              }}
            >
              Log Out
            </button>
          </div>
        )}
        {!import.meta.env.VITE_PLAYFAB_TITLE_ID && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#ffd166' }}>
            Missing VITE_PLAYFAB_TITLE_ID in .env
          </div>
        )}
      </div>
      )}

      {!showOnlineMenu && !showLocalMenu && (
        <>
          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              onSelectMode('singlePlayer');
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Single Player vs. Computer
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              onSelectMode('story');
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Relic Hunt (Story)
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              onSelectMode('tower');
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Tower of Shattered Champions
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              setShowLocalMenu(true);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Local Play
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              setShowOnlineMenu(true);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Multiplayer Online
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => {
              // Try to start music on user interaction (helps with autoplay restrictions)
              musicManager.tryPlay();
              setShowOptions(true);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Options
          </button>
        </>
      )}

      {showLocalMenu && (
        <>
          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              onSelectMode('multiplayerLocal');
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Multiplayer Local
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => {
              musicManager.tryPlay();
              onSelectMode('ffa3Local');
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Local 1v1v1 (3 Players)
          </button>

          <button
            style={activeButtonStyle}
            onClick={() => setShowLocalMenu(false)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }}
          >
            Back
          </button>
        </>
      )}

      {showOnlineMenu && session && (
      <div style={{ width: '100%', maxWidth: 520, background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 12, marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Online Matchmaking</div>
        <div style={{ fontSize: 12, marginBottom: 6, color: '#fff', fontWeight: 600 }}>
          Server auth: {hasMatchingServerAuth ? 'OK' : (playFabUser ? 'Refreshing' : 'Pending')}
        </div>
        {serverInstanceId && (
          <div style={{ fontSize: 11, marginBottom: 8, color: 'rgba(255,255,255,0.7)' }}>
            Server instance: {serverInstanceId}
          </div>
        )}
        {sessionPlayFabId && serverAuthedPlayFabId && !hasMatchingServerAuth && (
          <div style={{ fontSize: 11, marginBottom: 8, color: '#ffd166' }}>
            Waiting for server to switch accounts before matchmaking.
          </div>
        )}
        {/* Player Stats Display */}
        {session && playerStats && (
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            marginBottom: 12, 
            padding: '10px 14px',
            background: 'rgba(102, 126, 234, 0.2)',
            borderRadius: 8,
            border: '1px solid rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80' }}>{playerStats.Wins || 0}</div>
              <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase' }}>Wins</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f87171' }}>{playerStats.Losses || 0}</div>
              <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase' }}>Losses</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>{playerStats.Draws || 0}</div>
              <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase' }}>Draws</div>
            </div>
            <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {((playerStats.Wins || 0) + (playerStats.Losses || 0) + (playerStats.Draws || 0)) > 0 
                  ? Math.round(((playerStats.Wins || 0) / ((playerStats.Wins || 0) + (playerStats.Losses || 0) + (playerStats.Draws || 0))) * 100) 
                  : 0}%
              </div>
              <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase' }}>Win Rate</div>
            </div>
          </div>
        )}
        {/* Show loading/status message if logged in but no stats yet */}
        {session && playerStatsStatus === 'loading' && !playerStats && (
          <div style={{ 
            fontSize: 12, 
            marginBottom: 8, 
            color: '#888', 
            fontStyle: 'italic' 
          }}>
            Loading player stats...
          </div>
        )}
        {session && playerStatsStatus === 'error' && (
          <div style={{
            fontSize: 12,
            marginBottom: 8,
            color: '#fca5a5'
          }}>
            Could not load player stats: {playerStatsError}
          </div>
        )}
        {matchStatus && <div style={{ fontSize: 14, marginBottom: 8, color: '#fff', fontWeight: 600 }}>{matchStatus}</div>}
        {matchInfo && (
          <div style={{ fontSize: 13, marginBottom: 8, color: '#fff' }}>
            Match ID: {matchInfo.matchId} • You are {matchInfo.side}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
            disabled={!session || !socket}
            onClick={() => {
              requestMatch({}, 'Searching for match...');
            }}
          >
            Find a 1v1 match
          </button>
          <button
            style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
            disabled={!session || !socket}
            onClick={() => {
              requestMatch({ gameMode: 'ffa3' }, 'Searching for 1v1v1 match...');
            }}
          >
            Find a 1v1v1 match
          </button>
          <button
            style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
            disabled={!session || !socket}
            onClick={() => {
              requestMatch({ gameMode: 'league4' }, 'Searching for 4-player league...');
            }}
          >
            Find 4P League match
          </button>
          <button
            style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
            disabled={!socket}
            onClick={() => socket.emit('cancelMatch')}
          >
            Cancel
          </button>
          <button
            style={{ ...buttonStyle, height: 46, width: 'auto', fontSize: '0.9rem' }}
            disabled={!session || !socket}
            onClick={() => onSelectMode('bettingOnline')}
          >
            Open Betting Lobbies
          </button>
        </div>
      </div>
      )}

      {showOnlineMenu && (
        <button
          onClick={() => setShowOnlineMenu(false)}
          style={{
            marginTop: '20px',
            padding: '12px 30px',
            fontSize: '1rem',
            fontWeight: '600',
            border: '2px solid #fff',
            borderRadius: '8px',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#1e1e2e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#fff';
          }}
        >
          ← Back to Main Menu
        </button>
      )}

      {/* Options Modal */}
      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}
