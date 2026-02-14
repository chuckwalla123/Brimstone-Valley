const PLAYFAB_TITLE_ID = import.meta.env.VITE_PLAYFAB_TITLE_ID;

const apiRequest = async (path, body, sessionTicket = null) => {
  if (!PLAYFAB_TITLE_ID) {
    throw new Error('Missing VITE_PLAYFAB_TITLE_ID');
  }
  const url = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Client/${path}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const headers = { 'Content-Type': 'application/json' };
  if (sessionTicket) {
    headers['X-Authorization'] = sessionTicket;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  }).catch((e) => {
    clearTimeout(timeout);
    throw e;
  });
  clearTimeout(timeout);
  const data = await res.json();
  
  if (!res.ok || data.error) {
    const msg = data?.errorMessage || data?.error || 'PlayFab request failed';
    const details = data?.errorDetails ? JSON.stringify(data.errorDetails) : '';
    const status = res?.status ? `HTTP ${res.status}` : '';
    throw new Error([msg, details, status].filter(Boolean).join(' | '));
  }
  return data.data;
};

export const loginWithEmail = async ({ email, password }) => {
  const data = await apiRequest('LoginWithEmailAddress', {
    Email: email,
    Password: password,
    TitleId: PLAYFAB_TITLE_ID
  });
  persistSession(data);
  return data;
};

export const registerWithEmail = async ({ email, password, username }) => {
  const payload = {
    Email: email,
    Password: password,
    TitleId: PLAYFAB_TITLE_ID,
    RequireBothUsernameAndEmail: false
  };
  if (username) payload.Username = username;
  const data = await apiRequest('RegisterPlayFabUser', payload);
  persistSession(data);
  return data;
};

export const persistSession = (data) => {
  try {
    if (!data) return;
    const session = {
      sessionTicket: data.SessionTicket,
      playFabId: data.PlayFabId,
      username: data.Username || null
    };
    localStorage.setItem('playfabSession', JSON.stringify(session));
  } catch (e) {}
};

export const getStoredSession = () => {
  try {
    const raw = localStorage.getItem('playfabSession');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const clearSession = () => {
  try { localStorage.removeItem('playfabSession'); } catch (e) {}
};

// Update stored session with username (called when server auth confirms username)
export const updateSessionUsername = (username) => {
  try {
    const session = getStoredSession();
    if (session && username) {
      session.username = username;
      localStorage.setItem('playfabSession', JSON.stringify(session));
    }
  } catch (e) {}
};

// Fetch player statistics (wins, losses, draws)
export const getPlayerStatistics = async () => {
  const session = getStoredSession();
  if (!session || !session.sessionTicket) {
    throw new Error('Not logged in');
  }
  const data = await apiRequest('GetPlayerStatistics', {
    StatisticNames: ['Wins', 'Losses', 'Draws']
  }, session.sessionTicket);
  // Convert array to object for easier use
  const stats = { Wins: 0, Losses: 0, Draws: 0 };
  if (data && data.Statistics) {
    for (const stat of data.Statistics) {
      if (stat.StatisticName && typeof stat.Value === 'number') {
        stats[stat.StatisticName] = stat.Value;
      }
    }
  }
  return stats;
};
