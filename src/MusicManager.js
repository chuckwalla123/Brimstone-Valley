// MusicManager.js - Handles background music for different game phases
import getAssetPath from './utils/assetPath';

const MUSIC_TRACKS = {
  menu: {
    modern: '/images/sounds/Menu.mp3',
    retro: '/images/sounds/Menu_8bit.mp3',
  },
  draft: {
    modern: '/images/sounds/Draft.mp3',
    retro: '/images/sounds/Draft_8bit.mp3',
  },
  battle: {
    modern: '/images/sounds/Battle.mp3',
    retro: '/images/sounds/Battle_8bit.mp3',
  },
};

// Storage keys
const STORAGE_KEYS = {
  musicType: 'bsv_music_type',
  musicVolume: 'bsv_music_volume',
};

class MusicManager {
  constructor() {
    this.audio = null;
    this.currentPhase = null;
    this.musicType = this.loadMusicType();
    this.volume = this.loadVolume();
    this.isPlaying = false;
  }

  // Load saved music type preference (default: modern)
  loadMusicType() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.musicType);
      return saved === 'retro' ? 'retro' : 'modern';
    } catch {
      return 'modern';
    }
  }

  // Load saved volume preference (default: 0.5)
  loadVolume() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.musicVolume);
      if (saved !== null) {
        const vol = parseFloat(saved);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          return vol;
        }
      }
    } catch {}
    return 0.5;
  }

  // Save music type preference
  saveMusicType(type) {
    try {
      localStorage.setItem(STORAGE_KEYS.musicType, type);
    } catch {}
  }

  // Save volume preference
  saveVolume(volume) {
    try {
      localStorage.setItem(STORAGE_KEYS.musicVolume, volume.toString());
    } catch {}
  }

  // Get current music type
  getMusicType() {
    return this.musicType;
  }

  // Set music type (modern or retro)
  setMusicType(type) {
    if (type !== 'modern' && type !== 'retro') return;
    if (this.musicType === type) return;
    
    this.musicType = type;
    this.saveMusicType(type);
    
    // If currently playing, switch to the new track type
    if (this.isPlaying && this.currentPhase) {
      this.playPhase(this.currentPhase);
    }
  }

  // Get current volume
  getVolume() {
    return this.volume;
  }

  // Set volume (0 to 1)
  setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    this.volume = vol;
    this.saveVolume(vol);
    
    if (this.audio) {
      this.audio.volume = vol;
    }
  }

  // Play music for a specific phase
  playPhase(phase) {
    if (!MUSIC_TRACKS[phase]) {
      console.warn(`[MusicManager] Unknown phase: ${phase}`);
      return;
    }

    // If already playing this phase with same music type, don't restart
    if (this.currentPhase === phase && this.isPlaying && this.audio) {
      const expectedSrc = MUSIC_TRACKS[phase][this.musicType];
      if (this.audio.src.endsWith(expectedSrc.replace(/^\//, ''))) {
        return;
      }
    }

    this.stop();
    
    const trackUrl = getAssetPath(MUSIC_TRACKS[phase][this.musicType]);
    this.audio = new Audio(trackUrl);
    this.audio.loop = true;
    this.audio.volume = this.volume;
    this.currentPhase = phase;

    // Play with user interaction handling
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isPlaying = true;
        })
        .catch((error) => {
          // Auto-play was prevented, will need user interaction
          console.log('[MusicManager] Autoplay prevented, waiting for user interaction');
          this.isPlaying = false;
        });
    }
  }

  // Stop current music
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.isPlaying = false;
  }

  // Pause current music
  pause() {
    if (this.audio && this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  // Resume current music
  resume() {
    if (this.audio && !this.isPlaying) {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isPlaying = true;
          })
          .catch(() => {
            this.isPlaying = false;
          });
      }
    }
  }

  // Attempt to start music (useful after user interaction)
  tryPlay() {
    if (this.audio && !this.isPlaying) {
      this.resume();
    } else if (this.currentPhase) {
      this.playPhase(this.currentPhase);
    }
  }
}

// Singleton instance
const musicManager = new MusicManager();

export default musicManager;
export { MUSIC_TRACKS };
