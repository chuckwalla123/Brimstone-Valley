// SfxManager.js - Handles sound effect volume settings

const STORAGE_KEY = 'bsv_sfx_volume';

class SfxManager {
  constructor() {
    this.volume = this.loadVolume();
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
}

const sfxManager = new SfxManager();

export default sfxManager;
