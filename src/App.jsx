import React, { useState, useEffect, useRef } from "react";
import io from 'socket.io-client';
import StartScreen from "./StartScreen";
import { getStoredSession } from "./playfabClient";
import DifficultySelect from "./DifficultySelect";
import DraftBoard from "./DraftBoard";
import BattlePhase from "./BattlePhase";
import TestBattle from "./TestBattle";
import SpellLab from './SpellLab';
import musicManager from "./MusicManager";
import { createOfflineSocket } from "./offline/LocalGameEngine";
import getAssetPath from "./utils/assetPath";
import { TowerMode } from "./tower";
import { StoryMode } from "./story";
import League4Mode from "./League4Mode";
import BettingMode from "./BettingMode";

const resolveServerUrl = () => {
  const fromEnv = (import.meta.env.VITE_SERVER_URL || '').trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (!isLocalHost) {
      return window.location.origin;
    }
  }
  return 'http://localhost:3002';
};

const SERVER_URL = resolveServerUrl();

const isLocalServerUrl = (url) => {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

// Check if we're running in Electron or offline mode
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
const forceOffline = typeof window !== 'undefined' && (
  new URLSearchParams(window.location.search).has('offline') ||
  localStorage.getItem('forceOffline') === 'true'
);

// Initialize UI scale on app load
function initializeUIScale() {
  if (typeof window === 'undefined') return;
  
  const UI_SCALE_OPTIONS = ['ui-scale-100', 'ui-scale-125', 'ui-scale-150', 'ui-scale-175', 'ui-scale-200'];
  const saved = localStorage.getItem('uiScale');
  
  let scale = saved;
  if (!scale) {
    // Auto-detect based on screen width
    const width = window.screen.width;
    if (width >= 3840) scale = '175';
    else if (width >= 3000) scale = '150';
    else if (width >= 2560) scale = '125';
    else scale = '100';
  }
  
  const html = document.documentElement;
  UI_SCALE_OPTIONS.forEach(cls => html.classList.remove(cls));
  html.classList.add(`ui-scale-${scale}`);
}

// Run initialization
initializeUIScale();

function App() {
  // If the URL contains ?testBattle, render the TestBattle harness
  const params = new URLSearchParams(window.location.search);
  const spellLabMode = params.has('spellLab');
  const testMode = params.has("testBattle");

  const [currentScreen, setCurrentScreen] = useState('start');
  const [aiDifficulty, setAiDifficulty] = useState(null);
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const pendingResetRef = useRef(false);
  const [forceDraft, setForceDraft] = useState(false);
  const [playFabUser, setPlayFabUser] = useState(null);
  const [localSide, setLocalSide] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState(null); // { p1: username, p2: username, p3?: username }
  const [offlineMode, setOfflineMode] = useState(forceOffline);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [gameMode, setGameMode] = useState('classic');
  const [autoPlayLocal, setAutoPlayLocal] = useState(false);
  
  // Separate sockets for online (multiplayer) and local (single-player) modes
  const [onlineSocket, setOnlineSocket] = useState(null);
  const [localSocket, setLocalSocket] = useState(null);
  const [isSinglePlayer, setIsSinglePlayer] = useState(false);
  const isSinglePlayerRef = useRef(false); // Ref for use in event handlers

  // Music phase management
  useEffect(() => {
    if (currentScreen === 'tower') return;

    // Determine current music phase based on screen/game state
    let musicPhase = 'menu';
    
    // Check if we're in battle
    const phase = gameState?.phase || null;
    const battleActive = !forceDraft && phase && phase !== 'draft';
    
    if (currentScreen === 'start' || currentScreen === 'difficulty') {
      musicPhase = 'menu';
    } else if (currentScreen === 'draft' && !battleActive) {
      musicPhase = 'draft';
    } else if (battleActive) {
      musicPhase = 'battle';
    }
    
    musicManager.playPhase(musicPhase);
  }, [currentScreen, gameState, forceDraft]);

  useEffect(() => {
    // Don't connect to server in dev harness modes.
    if (testMode || spellLabMode) return;

    // If forcing offline mode, use local engine
    if (forceOffline || offlineMode) {
      
      const localSocket = createOfflineSocket();
      setSocket(localSocket);
      setConnectionStatus('offline');
      
      localSocket.on('gameState', (state) => {
        
        setGameState(state);
        if (state && state.phase === 'draft') {
          setForceDraft(false);
        }
      });

      localSocket.on('authResult', (payload) => {
        if (payload && payload.ok) {
          setPlayFabUser(payload.user ? { ...payload.user, serverInstanceId: payload.serverInstanceId || null } : null);
        }
      });

      localSocket.on('error', (msg) => {
        console.error('[Offline] Error:', msg);
      });

      // Trigger initial connection event
      localSocket._emit('connect');
      
      return () => {
        localSocket.close();
      };
    }
    
    // Try to connect to server
    const localServer = isLocalServerUrl(SERVER_URL);
    const newSocket = io(SERVER_URL, {
      timeout: 15000,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Use websocket-first everywhere, but keep polling as fallback when ws handshake is rejected.
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      rememberUpgrade: !localServer
    });
    setSocket(newSocket);
    setOnlineSocket(newSocket); // Keep reference to online socket

    newSocket.on('connect', () => {
      
      setConnectionStatus('online');
      setOfflineMode(false);
      const session = getStoredSession();
      if (session && session.sessionTicket) {
        newSocket.emit('auth', { sessionTicket: session.sessionTicket });
      }
      if (pendingResetRef.current) {
        newSocket.emit('resetGame');
        pendingResetRef.current = false;
      }
    });

    newSocket.on('gameState', (state) => {
      // Only apply game state from online socket if we're not in single-player mode
      // (single-player uses its own localSocket)
      
      if (!isSinglePlayerRef.current) {
        setGameState(state);
        if (state && state.phase === 'draft') {
          setForceDraft(false);
        }
      }
    });

    newSocket.on('authResult', (payload) => {
      if (payload && payload.ok) {
        setPlayFabUser(payload.user ? { ...payload.user, serverInstanceId: payload.serverInstanceId || null } : null);
        
        // Update stored session with username from server (login response doesn't include it)
        if (payload.user?.username) {
          import('./playfabClient.js').then(m => m.updateSessionUsername(payload.user.username));
        }
      } else {
        console.warn('[PlayFab] Server auth failed');
      }
    });

    newSocket.on('error', (msg) => {
      console.error('Server error:', msg);
    });

    // Handle connection errors - fallback to offline mode
    newSocket.on('connect_error', (error) => {
      const extra = error && typeof error === 'object'
        ? {
            message: error.message,
            description: error.description,
            context: error.context,
            type: error.type
          }
        : { message: String(error || 'unknown') };
      console.warn('[App] Connection error:', extra);
      setConnectionStatus('error');
    });

    // After max reconnection attempts, remain in online mode and surface error.
    // Automatically switching to offline can make matchmaking/auth appear broken.
    newSocket.io.on('reconnect_failed', () => {
      setConnectionStatus('offline');
      console.warn('[App] Reconnect attempts exhausted; staying online socket for manual retry');
    });

    // Handle opponent disconnecting or leaving during a match
    newSocket.on('opponentDisconnected', (payload) => {
      
      alert('Your opponent disconnected. Returning to main menu.');
      setCurrentScreen('start');
      setLocalSide(null);
      setGameState(null);
    });

    newSocket.on('opponentLeft', (payload) => {
      
      alert('Your opponent left the match. Returning to main menu.');
      setCurrentScreen('start');
      setLocalSide(null);
      setGameState(null);
    });

    return () => {
      if (newSocket) newSocket.close();
    };
  }, [testMode, spellLabMode, offlineMode]);

  const resetGameOnServer = () => {
    pendingResetRef.current = true;
    // In offline mode, socket.connected is always true (it's a local engine property)
    if (socket) {
      socket.emit('resetGame');
    }
    setGameState(null);
  };

  const handleSelectMode = (mode) => {
    setForceDraft(true);
    if (mode === 'bettingOnline') {
      setIsSinglePlayer(false);
      isSinglePlayerRef.current = false;
      setGameState(null);
      setAiDifficulty(null);
      setLocalSide(null);
      if (onlineSocket) {
        setSocket(onlineSocket);
        try {
          if (!onlineSocket.connected) onlineSocket.connect();
        } catch (e) {}
      }
      setCurrentScreen('betting');
      return;
    }
    if (mode === 'ffa3Local') {
      setGameMode('ffa3');
      setIsSinglePlayer(true);
      isSinglePlayerRef.current = true;
      setAiDifficulty(null);
      setLocalSide(null);
      setGameState(null);
      setAutoPlayLocal(true);

      if (localSocket) {
        localSocket.close();
      }
      const newLocalSocket = createOfflineSocket();
      setLocalSocket(newLocalSocket);
      setSocket(newLocalSocket);

      newLocalSocket.on('gameState', (state) => {
        setGameState(state);
        if (state && state.phase === 'draft') {
          setForceDraft(false);
        }
      });

      newLocalSocket._emit('connect');
      newLocalSocket.emit('resetGame', { gameMode: 'ffa3' });

      setCurrentScreen('draft');
      return;
    }
    if (mode === 'tower') {
      // Tower of Shattered Champions mode
      setIsSinglePlayer(true);
      isSinglePlayerRef.current = true;
      setCurrentScreen('tower');
      return;
    }
    if (mode === 'story') {
      setIsSinglePlayer(true);
      isSinglePlayerRef.current = true;
      setCurrentScreen('story');
      return;
    }
    if (mode === 'multiplayerLocal') {
      // Local multiplayer uses the shared server
      setIsSinglePlayer(false);
      isSinglePlayerRef.current = false;
      setGameMode('classic');
      setAutoPlayLocal(true);
      if (onlineSocket) {
        setSocket(onlineSocket);
        onlineSocket.emit('resetGame', { gameMode: 'classic' });
      }
      setCurrentScreen('draft');
      setAiDifficulty(null);
      setLocalSide(null);
    } else if (mode === 'singlePlayer') {
      // Single player will use a local socket (set in handleSelectDifficulty)
      setIsSinglePlayer(true);
      isSinglePlayerRef.current = true;
      setAutoPlayLocal(false);
      setCurrentScreen('difficulty');
    }
  };

  const handleMatchFound = (payload) => {
    setForceDraft(true);
    setAiDifficulty(null);
    setGameMode(payload?.gameMode || 'classic');
    setLocalSide(payload?.side || null);
    // Store player names for display - use stored session as fallback
    const session = getStoredSession();
    const myUsername = session?.username || playFabUser?.username || 'You';

    if (payload?.players) {
      setMatchPlayers({
        p1: payload.players.p1 || 'Player 1',
        p2: payload.players.p2 || 'Player 2',
        p3: payload.players.p3 || 'Player 3',
        p4: payload.players.p4 || 'Player 4'
      });
    } else {
      const opponentUsername = payload?.opponent?.username || 'Opponent';
      if (payload?.side === 'p1') {
        setMatchPlayers({ p1: myUsername, p2: opponentUsername });
      } else {
        setMatchPlayers({ p1: opponentUsername, p2: myUsername });
      }
    }
    if ((payload?.gameMode || 'classic') === 'league4') {
      setCurrentScreen('league4');
    } else {
      setCurrentScreen('draft');
    }
  };

  const handleSelectDifficulty = (difficulty) => {
    setForceDraft(true);
    setAiDifficulty(difficulty);
    setGameMode('classic');
    setLocalSide(null);
    setGameState(null);
    setAutoPlayLocal(true);
    
    // Create a fresh local socket for single-player games
    // This prevents interfering with other players on the shared server
    if (localSocket) {
      localSocket.close();
    }
    const newLocalSocket = createOfflineSocket();
    setLocalSocket(newLocalSocket);
    setSocket(newLocalSocket);
    
    newLocalSocket.on('gameState', (state) => {
      setGameState(state);
      if (state && state.phase === 'draft') {
        setForceDraft(false);
      }
    });
    
    // Trigger connection and reset
    newLocalSocket._emit('connect');
    newLocalSocket.emit('resetGame');
    
    setCurrentScreen('draft');
  };

  const handleBackToMenu = () => {
    // If in an online match, notify server we're leaving
    if (localSide && onlineSocket && onlineSocket.connected) {
      onlineSocket.emit('leaveMatch');
    }
    
    // Clean up local socket if we were in single-player mode
    if (isSinglePlayer && localSocket) {
      localSocket.close();
      setLocalSocket(null);
    }
    
    // Restore online socket for menu/matchmaking
    if (onlineSocket) {
      setSocket(onlineSocket);
    }
    
    setGameState(null);
    setCurrentScreen('start');
    setAiDifficulty(null);
    setLocalSide(null);
    setMatchPlayers(null);
    setIsSinglePlayer(false);
    isSinglePlayerRef.current = false;
  };

  if (spellLabMode) {
    return <SpellLab />;
  }

  if (testMode) {
    return <TestBattle />;
  }

  const phase = gameState?.phase || null;
  const inBattle = !forceDraft && phase && phase !== 'draft';

  const handleLoginSuccess = (data) => {
    try {
      setPlayFabUser(null);
      const session = getStoredSession();
      if (socket && socket.connected && session && session.sessionTicket) {
        socket.emit('auth', { sessionTicket: session.sessionTicket });
      }
    } catch (e) {}
  };

  return (
    <div className="app-container">
      {/* Static Background Image */}
      <img
        className="video-background"
        src={getAssetPath("/images/background/BSVBackground.png")}
        alt=""
      />
      
      <div className="app-content">
        {currentScreen === 'start' && <StartScreen onSelectMode={handleSelectMode} onLoginSuccess={handleLoginSuccess} onMatchFound={handleMatchFound} socket={socket} playFabUser={playFabUser} />}
        {currentScreen === 'difficulty' && (
          <DifficultySelect 
            onSelectDifficulty={handleSelectDifficulty} 
            onBack={handleBackToMenu}
          />
        )}
        {currentScreen === 'tower' && <TowerMode onExit={handleBackToMenu} />}
        {currentScreen === 'story' && <StoryMode onExit={handleBackToMenu} />}
        {currentScreen === 'league4' && <League4Mode gameState={gameState} socket={socket} localSide={localSide} matchPlayers={matchPlayers} onExit={handleBackToMenu} />}
        {currentScreen === 'betting' && <BettingMode socket={socket} onExit={handleBackToMenu} />}
        {currentScreen === 'draft' && !inBattle && <DraftBoard aiDifficulty={aiDifficulty} socket={socket} gameState={gameState} localSide={localSide} matchPlayers={matchPlayers} />}
        {currentScreen === 'draft' && inBattle && (
          <BattlePhase
            gameState={gameState}
            socket={socket}
            onGameEnd={handleBackToMenu}
            aiDifficulty={aiDifficulty}
            autoPlay={autoPlayLocal || !!aiDifficulty || !!localSide}
            localSide={localSide}
            disableBackgroundFastForward={true}
            matchPlayers={matchPlayers}
          />
        )}
      </div>
    </div>
  );
}

export default App;