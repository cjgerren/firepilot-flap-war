class AudioManager {
  constructor() {
    this.music = {};
    this.sfx = {};
    this.currentMusic = null;
    this.isUnlocked = false;

    this.settings = {
      masterMuted: false,
      musicMuted: false,
      sfxMuted: false,
      musicVolume: 0.5,
      sfxVolume: 0.8,
    };

    this.loadSettings();
    this.preload();
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('firepilot_audio_settings');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.settings = {
        ...this.settings,
        ...parsed,
      };
    } catch (error) {
      console.error('[audio] Failed to load settings:', error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('firepilot_audio_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('[audio] Failed to save settings:', error);
    }
  }

  preload() {
    this.music.menuTheme = this.createAudio('/audio/music/menu-theme.mp3', true);
    this.music.gameTheme = this.createAudio('/audio/music/game-theme.mp3', true);

    this.sfx.click = this.createAudio('/audio/sfx/click.wav', false);
    this.sfx.coin = this.createAudio('/audio/sfx/coin.wav', false);
    this.sfx.shoot = this.createAudio('/audio/sfx/shoot.wav', false);
    this.sfx.hit = this.createAudio('/audio/sfx/hit.wav', false);
    this.sfx.explosion = this.createAudio('/audio/sfx/explosion.wav', false);
    this.sfx.gameOver = this.createAudio('/audio/sfx/game-over.wav', false);
    this.sfx.shield = this.createAudio('/audio/sfx/shield.wav', false);
    this.sfx.powerup = this.createAudio('/audio/sfx/power-up.wav', false);

    this.applyVolumes();
  }

  createAudio(src, loop = false) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = loop;
    return audio;
  }

  unlock() {
    if (this.isUnlocked) return;
    this.isUnlocked = true;
  }

  applyVolumes() {
    const musicVolume =
      this.settings.masterMuted || this.settings.musicMuted ? 0 : this.settings.musicVolume;

    const sfxVolume =
      this.settings.masterMuted || this.settings.sfxMuted ? 0 : this.settings.sfxVolume;

    Object.values(this.music).forEach((audio) => {
      audio.volume = musicVolume;
    });

    Object.values(this.sfx).forEach((audio) => {
      audio.volume = sfxVolume;
    });
  }

  setMasterMuted(value) {
    this.settings.masterMuted = !!value;
    this.applyVolumes();
    this.saveSettings();
  }

  setMusicMuted(value) {
    this.settings.musicMuted = !!value;
    this.applyVolumes();
    this.saveSettings();
  }

  setSfxMuted(value) {
    this.settings.sfxMuted = !!value;
    this.applyVolumes();
    this.saveSettings();
  }

  setMusicVolume(value) {
    const volume = Math.max(0, Math.min(1, Number(value) || 0));
    this.settings.musicVolume = volume;
    this.applyVolumes();
    this.saveSettings();
  }

  setSfxVolume(value) {
    const volume = Math.max(0, Math.min(1, Number(value) || 0));
    this.settings.sfxVolume = volume;
    this.applyVolumes();
    this.saveSettings();
  }

  stopAllMusic() {
    Object.values(this.music).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.currentMusic = null;
  }

  async playMusic(name) {
    if (!this.isUnlocked) return;
    if (!this.music[name]) return;
    if (this.currentMusic === name) return;

    if (this.currentMusic && this.music[this.currentMusic]) {
      this.music[this.currentMusic].pause();
      this.music[this.currentMusic].currentTime = 0;
    }

    this.currentMusic = name;
    this.applyVolumes();

    try {
      await this.music[name].play();
    } catch (error) {
      console.warn(`[audio] Music play blocked for ${name}:`, error);
    }
  }

  pauseMusic() {
    if (!this.currentMusic) return;
    const current = this.music[this.currentMusic];
    if (!current) return;
    current.pause();
  }

  resumeMusic() {
    if (!this.isUnlocked) return;
    if (!this.currentMusic) return;
    const current = this.music[this.currentMusic];
    if (!current) return;

    current.play().catch((error) => {
      console.warn('[audio] Resume music blocked:', error);
    });
  }

  async playSfx(name) {
    if (!this.isUnlocked) return;
    if (!this.sfx[name]) return;

    try {
      const base = this.sfx[name];
      const clone = base.cloneNode();
      clone.volume =
        this.settings.masterMuted || this.settings.sfxMuted ? 0 : this.settings.sfxVolume;
      await clone.play();
    } catch (error) {
      console.warn(`[audio] SFX play blocked for ${name}:`, error);
    }
  }

  getSettings() {
    return { ...this.settings };
  }
}

const audioManager = new AudioManager();

export default audioManager;
