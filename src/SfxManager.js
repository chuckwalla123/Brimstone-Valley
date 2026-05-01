// SfxManager.js - Handles sound effect volume settings

const STORAGE_KEY = 'bsv_sfx_volume';

class SfxManager {
  constructor() {
    this.volume = this.loadVolume();
    this.activePlaybacks = new Set();
    this.pendingPlaybacks = new Set();
  }

  // Load saved volume preference (default: 0.5)
  loadVolume() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const vol = parseFloat(saved);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          return vol;
        }
      }
    } catch {}
    return 0.5;
  }

  // Save volume preference
  saveVolume(volume) {
    try {
      localStorage.setItem(STORAGE_KEY, volume.toString());
    } catch {}
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
  }

  clampVolume(volume, fallback = 1) {
    const parsed = Number(volume);
    if (!Number.isFinite(parsed)) return Math.max(0, Math.min(1, fallback));
    return Math.max(0, Math.min(1, parsed));
  }

  normalizeWindow(startTime, endTime) {
    const normalizedStart = Number.isFinite(Number(startTime)) ? Math.max(0, Number(startTime)) : 0;
    const normalizedEnd = Number.isFinite(Number(endTime)) ? Math.max(0, Number(endTime)) : null;

    return {
      startTime: normalizedStart,
      endTime: normalizedEnd != null && normalizedEnd > normalizedStart ? normalizedEnd : null
    };
  }

  playSound({ src, baseVolume = 1, startTime = 0, endTime = null, delayMs = 0 } = {}) {
    if (!src || typeof Audio === 'undefined') return null;

    const audio = new Audio(src);
    const { startTime: clipStart, endTime: clipEnd } = this.normalizeWindow(startTime, endTime);
    const playbackDelayMs = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : 0;
    let stopTimer = null;
    let delayTimer = null;

    const cleanup = () => {
      if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
      this.pendingPlaybacks.delete(audio);
      this.activePlaybacks.delete(audio);
    };

    const scheduleStop = () => {
      if (clipEnd == null) return;
      const playbackEnd = Number.isFinite(audio.duration) ? Math.min(clipEnd, audio.duration) : clipEnd;
      if (!(playbackEnd > audio.currentTime)) return;

      stopTimer = setTimeout(() => {
        try {
          audio.pause();
          audio.currentTime = playbackEnd;
        } catch {}
        cleanup();
      }, Math.max(0, (playbackEnd - audio.currentTime) * 1000));
    };

    const beginPlayback = () => {
      try {
        if (clipStart > 0) {
          const durationCap = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.001) : clipStart;
          audio.currentTime = Math.min(clipStart, durationCap);
        }
      } catch {}

      audio.volume = this.clampVolume(baseVolume) * this.getVolume();
      this.pendingPlaybacks.delete(audio);
      this.activePlaybacks.add(audio);
      scheduleStop();
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => cleanup());
      }
    };

    const startPlayback = () => {
      if (playbackDelayMs > 0) {
        this.pendingPlaybacks.add(audio);
        delayTimer = setTimeout(() => {
          delayTimer = null;
          beginPlayback();
        }, playbackDelayMs);
        return;
      }

      beginPlayback();
    };

    audio.preload = 'auto';
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });

    if (clipStart > 0 || clipEnd != null) {
      if (audio.readyState >= 1) {
        startPlayback();
      } else {
        audio.addEventListener('loadedmetadata', startPlayback, { once: true });
        audio.load();
      }
    } else {
      startPlayback();
    }

    return audio;
  }
}

const sfxManager = new SfxManager();

export default sfxManager;
