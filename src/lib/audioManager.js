import { gameConfig } from '../config/gameConfig.js';

function detectIosRuntime() {
  if (typeof window === 'undefined') return false;
  const platform = window.Capacitor?.getPlatform?.();
  if (platform === 'ios') return true;
  const ua = window.navigator?.userAgent || '';
  const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
  return /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1);
}

class AudioManager {
  constructor() {
    this.music = {};
    this.sfx = {};
    this.currentMusic = null;
    this.isUnlocked = false;
    this.synth = {
      context: null,
      gainNode: null,
      timer: null,
      step: 0,
      playing: false,
    };

    this.settings = {
      masterMuted: false,
      musicMuted: !gameConfig.audio.musicEnabledByDefault,
      sfxMuted: !gameConfig.audio.sfxEnabledByDefault,
      musicVolume: gameConfig.audio.musicVolume,
      sfxVolume: gameConfig.audio.sfxVolume,
    };
    this.isIosRuntime = detectIosRuntime();
    this.sfxPool = {};
    this.sfxPoolSize = this.isIosRuntime ? 3 : 4;
    this.maxConcurrentSfx = this.isIosRuntime ? 4 : 8;
    this.activeSfxNodes = new Set();
    this.lowPrioritySfx = new Set(['shoot', 'hit', 'coin', 'explosion']);
    this.sfxLastPlayedAt = {};
    this.sfxMinIntervalMs = {
      shoot: 34,
      explosion: 44,
      powerup: 48,
      shield: 52,
      coin: 56,
    };
    if (this.isIosRuntime) {
      this.sfxMinIntervalMs = {
        ...this.sfxMinIntervalMs,
        shoot: 72,
        explosion: 96,
        hit: 66,
        powerup: 84,
        shield: 90,
        coin: 84,
      };
    }

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
    this.sfx.powerup = this.createAudio('/audio/sfx/powerup.wav', false);
    Object.entries(this.sfx).forEach(([name, audio]) => {
      this.sfxPool[name] = [audio];
    });
    this.prewarmSfxPools();

    this.applyVolumes();
  }

  prewarmSfxPools() {
    const entries = Object.entries(this.sfxPool);
    for (let i = 0; i < entries.length; i++) {
      const [name, pool] = entries[i];
      const base = this.sfx[name];
      if (!base || !Array.isArray(pool)) continue;
      while (pool.length < this.sfxPoolSize) {
        pool.push(base.cloneNode());
      }
    }
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
    this.initSynth();
  }

  initSynth() {
    if (this.synth.context) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const gainNode = context.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(context.destination);
      this.synth.context = context;
      this.synth.gainNode = gainNode;
      this.updateSynthGain();
    } catch (error) {
      console.warn('[audio] Synth init failed:', error);
    }
  }

  updateSynthGain() {
    if (!this.synth.gainNode) return;
    const muted = this.settings.masterMuted || this.settings.musicMuted;
    const level = muted ? 0 : Math.max(0, Math.min(1, this.settings.musicVolume)) * 0.18;
    this.synth.gainNode.gain.setTargetAtTime(
      level,
      this.synth.context?.currentTime || 0,
      0.04
    );
  }

  scheduleSynthPulse() {
    if (!this.synth.context || !this.synth.gainNode) return;
    const context = this.synth.context;
    const now = context.currentTime;
    const noteSteps = [196, 220, 246.94, 293.66, 329.63, 392, 329.63, 293.66];
    const bassSteps = [98, 110, 123.47, 146.83];
    const note = noteSteps[this.synth.step % noteSteps.length];
    const bass = bassSteps[this.synth.step % bassSteps.length];
    this.synth.step++;

    const leadOsc = context.createOscillator();
    leadOsc.type = this.synth.step % 2 === 0 ? 'sawtooth' : 'square';
    leadOsc.frequency.setValueAtTime(note, now);

    const leadGain = context.createGain();
    leadGain.gain.setValueAtTime(0.0001, now);
    leadGain.gain.exponentialRampToValueAtTime(0.48, now + 0.02);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    const bassOsc = context.createOscillator();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(bass, now);

    const bassGain = context.createGain();
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.24, now + 0.03);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    leadOsc.connect(leadGain);
    bassOsc.connect(bassGain);
    leadGain.connect(this.synth.gainNode);
    bassGain.connect(this.synth.gainNode);

    leadOsc.start(now);
    bassOsc.start(now);
    leadOsc.stop(now + 0.24);
    bassOsc.stop(now + 0.3);
  }

  startGameSynth() {
    if (this.synth.playing) return;
    this.initSynth();
    if (!this.synth.context) return;

    if (this.synth.context.state === 'suspended') {
      this.synth.context.resume().catch(() => {});
    }

    this.synth.step = 0;
    this.synth.playing = true;
    this.updateSynthGain();
    this.synth.timer = setInterval(() => {
      if (!this.synth.playing) return;
      this.scheduleSynthPulse();
    }, 150);
  }

  stopGameSynth() {
    this.synth.playing = false;
    if (this.synth.timer) {
      clearInterval(this.synth.timer);
      this.synth.timer = null;
    }
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
    Object.values(this.sfxPool).forEach((pool) => {
      pool.forEach((audio) => {
        audio.volume = sfxVolume;
      });
    });

    this.updateSynthGain();
  }

  getSfxNode(name) {
    const base = this.sfx[name];
    if (!base) return null;

    let pool = this.sfxPool[name];
    if (!Array.isArray(pool)) {
      pool = [base];
      this.sfxPool[name] = pool;
    }

    for (const node of pool) {
      if (node.paused || node.ended) {
        return node;
      }
    }

    if (pool.length < this.sfxPoolSize) {
      const clone = base.cloneNode();
      pool.push(clone);
      return clone;
    }

    const fallback = pool.shift();
    pool.push(fallback);
    return fallback;
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
    this.stopGameSynth();
  }

  stopAllSfx() {
    const pools = Object.values(this.sfxPool);
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      if (!Array.isArray(pool)) continue;
      for (let j = 0; j < pool.length; j++) {
        const node = pool[j];
        node.pause();
        node.currentTime = 0;
      }
    }
    this.activeSfxNodes.clear();
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
    if (name === 'gameTheme') {
      this.startGameSynth();
    } else {
      this.stopGameSynth();
    }

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
    this.stopGameSynth();
  }

  resumeMusic() {
    if (!this.isUnlocked) return;
    if (!this.currentMusic) return;
    const current = this.music[this.currentMusic];
    if (!current) return;
    if (this.currentMusic === 'gameTheme') {
      this.startGameSynth();
    }

    current.play().catch((error) => {
      console.warn('[audio] Resume music blocked:', error);
    });
  }

  async playSfx(name) {
    if (!this.isUnlocked) return;
    if (!this.sfx[name]) return;
    if (this.settings.masterMuted || this.settings.sfxMuted || this.settings.sfxVolume <= 0) {
      return;
    }

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const minInterval = this.sfxMinIntervalMs[name] || 0;
    const lastPlayedAt = this.sfxLastPlayedAt[name] || 0;
    if (minInterval > 0 && now - lastPlayedAt < minInterval) {
      return;
    }
    if (
      this.isIosRuntime &&
      this.activeSfxNodes.size >= this.maxConcurrentSfx &&
      this.lowPrioritySfx.has(name)
    ) {
      return;
    }
    this.sfxLastPlayedAt[name] = now;

    try {
      const node = this.getSfxNode(name);
      if (!node) return;
      this.activeSfxNodes.delete(node);
      node.pause();
      node.currentTime = 0;
      node.volume = this.settings.sfxVolume;
      const clearNode = () => {
        this.activeSfxNodes.delete(node);
      };
      node.onended = clearNode;
      node.onpause = clearNode;
      this.activeSfxNodes.add(node);
      await node.play();
    } catch (error) {
      console.warn(`[audio] SFX play blocked for ${name}:`, error);
    }
  }

  getActiveSfxCount() {
    return this.activeSfxNodes.size;
  }

  getSettings() {
    return { ...this.settings };
  }
}

const audioManager = new AudioManager();

export default audioManager;
