import React, { Suspense, lazy, useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from '../components/game/GameCanvas';
import MainMenu from '../components/game/MainMenu';
import {
  getSelectedSkin,
  getEquippedUpgrades,
  calculateRunCoinReward,
  processGameOver,
} from '../lib/gameStore';
import {
  ensureSaveLoaded,
  pushLocalSaveToCloud,
  pullCloudSaveToLocal,
} from '../lib/cloudSave';
import { syncCheckoutSession, syncGooglePlayPurchases } from '../lib/payments';
import { areExternalPurchasesEnabled } from '../lib/releaseConfig';
import { useAuth } from '../lib/AuthContext';
import audioManager from '../lib/audioManager';
import useAudioUnlock from '../lib/useAudioUnlock';
import { isReviveAdsEnabled, primeReviveRewardedAd, showReviveRewardedAd } from '../lib/reviveAds';
import { getRuntimeDefaultSettings } from '../config/gameConfig.js';

const MIC_DISCLOSURE_KEY = 'firepilot_mic_disclosure_acknowledged';
const MobileTouchControls = lazy(() => import('../components/game/MobileTouchControls'));

const DEFAULT_SETTINGS = getRuntimeDefaultSettings();

function hasAcceptedMicDisclosure() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MIC_DISCLOSURE_KEY) === '1';
  } catch {
    return false;
  }
}

function acceptMicDisclosure() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MIC_DISCLOSURE_KEY, '1');
  } catch {}
}

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem('firepilot_settings');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function detectIosRuntime() {
  if (typeof window === 'undefined') return false;
  const platform = window.Capacitor?.getPlatform?.();
  if (platform === 'ios') return true;

  const ua = window.navigator?.userAgent || '';
  const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
  const isIosUa = /iPad|iPhone|iPod/i.test(ua);
  const isIpadDesktopUa = /Macintosh/i.test(ua) && touchPoints > 1;
  return isIosUa || isIpadDesktopUa;
}

function isEditableEventTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

export default function Game() {
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [diamondsEarned, setDiamondsEarned] = useState(0);
  const [skinId, setSkinId] = useState(getSelectedSkin());
  const [blastReady, setBlastReady] = useState(false);
  const [tunnelBombReady, setTunnelBombReady] = useState(false);
  const [comboSpecialReady, setComboSpecialReady] = useState(false);
  const [settings, setSettings] = useState(loadSettings());
  const [micStatus, setMicStatus] = useState('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [lastMicSignalAt, setLastMicSignalAt] = useState(0);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [mobileViewportHeight, setMobileViewportHeight] = useState(0);
  const [appIsForeground, setAppIsForeground] = useState(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );
  const [micDisclosureAccepted, setMicDisclosureAccepted] = useState(hasAcceptedMicDisclosure());
  const [skipMicForRun, setSkipMicForRun] = useState(false);
  const [pendingRunResult, setPendingRunResult] = useState(null);
  const [runHasRevived, setRunHasRevived] = useState(false);
  const [reviveBusy, setReviveBusy] = useState(false);
  const [reviveMessage, setReviveMessage] = useState('');
  const [reviveRetryAt, setReviveRetryAt] = useState(0);
  const [, setReviveRetryTicker] = useState(0);
  const [milestoneBonusCoins, setMilestoneBonusCoins] = useState(0);
  const [newBadgesUnlocked, setNewBadgesUnlocked] = useState([]);
  const [dailyMissionCompletions, setDailyMissionCompletions] = useState(0);

  const killsRef = useRef(0);
  const saveSyncTimerRef = useRef(null);
  const blowCooldownRef = useRef(0);
  const micMeterTickRef = useRef(0);
  const tunnelBombReadyRef = useRef(false);

  const jumpRef = useRef(null);
  const shootRef = useRef(null);
  const blastRef = useRef(null);
  const tunnelBombRef = useRef(null);
  const comboSpecialRef = useRef(null);
  const reviveRef = useRef(null);
  const startFireRef = useRef(null);
  const stopFireRef = useRef(null);

  const { user } = useAuth();
  const isIosNative = detectIosRuntime();

  useAudioUnlock();

  const triggerBlast = useCallback(() => {
    if (blastReady) {
      blastRef.current?.();
    }
  }, [blastReady]);

  const tryTriggerTunnelBomb = useCallback(() => {
    const trigger = tunnelBombRef.current;
    if (typeof trigger !== 'function') return false;
    return Boolean(trigger());
  }, []);

  const triggerSpecial = useCallback(() => {
    if (tryTriggerTunnelBomb()) {
      return;
    }
    if (comboSpecialReady) {
      comboSpecialRef.current?.();
      return;
    }
  }, [comboSpecialReady, tryTriggerTunnelBomb]);

  const resetMicTransientState = useCallback((hardReset = false) => {
    blowCooldownRef.current = 0;
    micMeterTickRef.current = 0;
    setLastMicSignalAt(0);
    if (hardReset) {
      setMicLevel(0);
    }
  }, []);

  const triggerMicSpecial = useCallback(() => {
    if (tryTriggerTunnelBomb()) return true;
    if (comboSpecialReady) {
      comboSpecialRef.current?.();
      return true;
    }
    return false;
  }, [comboSpecialReady, tryTriggerTunnelBomb]);

  useEffect(() => {
    tunnelBombReadyRef.current = tunnelBombReady;
  }, [tunnelBombReady]);

  useEffect(() => {
    const refreshSettings = () => setSettings(loadSettings());

    refreshSettings();

    const handleStorage = () => {
      refreshSettings();
    };
    const handleSettingsChanged = () => refreshSettings();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('firepilot-local-save-updated', handleStorage);
    window.addEventListener('firepilot-settings-changed', handleSettingsChanged);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('firepilot-local-save-updated', handleStorage);
      window.removeEventListener('firepilot-settings-changed', handleSettingsChanged);
    };
  }, []);

  useEffect(() => {
    const updateOrientationHint = () => {
      const nativeCapacitor = Boolean(window.Capacitor?.isNativePlatform?.());
      const capacitorPlatform = window.Capacitor?.getPlatform?.();
      const isNativeMobileApp =
        nativeCapacitor &&
        (capacitorPlatform === 'android' || capacitorPlatform === 'ios');

      setIsMobileDevice(isNativeMobileApp);
      setShowRotateHint(isNativeMobileApp && window.innerHeight > window.innerWidth);
      setMobileViewportHeight(Math.round(window.visualViewport?.height || window.innerHeight || 0));
    };

    updateOrientationHint();
    window.addEventListener('resize', updateOrientationHint);
    window.addEventListener('orientationchange', updateOrientationHint);
    window.visualViewport?.addEventListener?.('resize', updateOrientationHint);

    return () => {
      window.removeEventListener('resize', updateOrientationHint);
      window.removeEventListener('orientationchange', updateOrientationHint);
      window.visualViewport?.removeEventListener?.('resize', updateOrientationHint);
    };
  }, []);

  useEffect(() => {
    const syncChangedLocalSave = () => {
      if (!user?.id) return;

      if (saveSyncTimerRef.current) {
        clearTimeout(saveSyncTimerRef.current);
      }

      saveSyncTimerRef.current = setTimeout(async () => {
        try {
          await pushLocalSaveToCloud();
        } catch (error) {
          console.error('Changed local save cloud sync failed:', error);
        }
      }, 900);
    };

    window.addEventListener('firepilot-local-save-changed', syncChangedLocalSave);

    return () => {
      window.removeEventListener('firepilot-local-save-changed', syncChangedLocalSave);
      if (saveSyncTimerRef.current) {
        clearTimeout(saveSyncTimerRef.current);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (gameState !== 'playing') {
      setSkipMicForRun(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'ready' && isMobileDevice) {
      setGameState('playing');
    }
  }, [gameState, isMobileDevice]);

  useEffect(() => {
    const onVisibility = () => {
      setAppIsForeground(document.visibilityState !== 'hidden');
    };
    const onPageHide = () => setAppIsForeground(false);
    const onPageShow = () => setAppIsForeground(true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    if (
      gameState !== 'playing' ||
      !appIsForeground ||
      settings.mobileSpecialControl !== 'blow' ||
      !settings.mobileMicEnabled ||
      skipMicForRun
    ) {
      setMicStatus('idle');
      setMicLevel(0);
      return undefined;
    }

    if (!micDisclosureAccepted) {
      setMicStatus('needs-disclosure');
      setMicLevel(0);
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('unsupported');
      setMicLevel(0);
      return undefined;
    }

    let active = true;
    let audioContext;
    let source;
    let rafId;
    let stream;
    const samples = new Uint8Array(256);
    const freqSamples = new Uint8Array(128);

    const stopMic = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (source) source.disconnect();
      if (audioContext) audioContext.close().catch(() => {});
      if (stream) stream.getTracks().forEach((track) => track.stop());
      setMicLevel(0);
    };

    const startMic = async () => {
      try {
        setMicStatus('requesting');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          setMicStatus('unsupported');
          return;
        }

        audioContext = new AudioContextClass();
        source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = isIosNative ? 128 : 512;
        analyser.smoothingTimeConstant = isIosNative ? 0.42 : 0.35;
        source.connect(analyser);
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        setMicStatus('listening');
        let ambientLevel = 4;
        let ambientLowBand = 9;
        let ambientHighBand = 8;
        let quietFrames = 0;
        let burstFrames = 0;
        let gateReady = false;
        let holdoffUntil = 0;
        let previousSignalStrength = 0;
        let sampleTick = 0;
        const sampleStride = isIosNative ? 4 : 1;
        const lowBandEnd = isIosNative ? 18 : 24;
        const highBandStart = isIosNative ? 20 : 28;
        const highBandEnd = isIosNative ? 64 : 96;
        const lowBandDenom = Math.max(1, lowBandEnd - 2);
        const highBandDenom = Math.max(1, highBandEnd - highBandStart);
        const micBurstFramesRequired = isIosNative ? 2 : 2;
        const micCooldownMs = isIosNative ? 1000 : 900;
        const micBurstStrengthThreshold = isIosNative ? 1.14 : 1.16;
        const micFinalStrengthThreshold = isIosNative ? 1.2 : 1.22;
        const micRiseThreshold = isIosNative ? 0.1 : 0.13;

        const readMic = () => {
          sampleTick = (sampleTick + 1) % sampleStride;
          if (sampleTick !== 0) {
            rafId = requestAnimationFrame(readMic);
            return;
          }

          analyser.getByteTimeDomainData(samples);
          analyser.getByteFrequencyData(freqSamples);
          let peak = 0;
          let sumDeviation = 0;
          let lowBandSum = 0;
          let highBandSum = 0;

          for (const sample of samples) {
            const deviation = Math.abs(sample - 128);
            peak = Math.max(peak, deviation);
            sumDeviation += deviation;
          }
          for (let i = 2; i < lowBandEnd; i++) {
            lowBandSum += freqSamples[i] || 0;
          }
          for (let i = highBandStart; i < highBandEnd; i++) {
            highBandSum += freqSamples[i] || 0;
          }
          const averageDeviation = sumDeviation / samples.length;
          const lowBandEnergy = lowBandSum / lowBandDenom;
          const highBandEnergy = highBandSum / highBandDenom;
          ambientLevel = ambientLevel * 0.96 + averageDeviation * 0.04;
          ambientLowBand = ambientLowBand * 0.97 + lowBandEnergy * 0.03;
          ambientHighBand = ambientHighBand * 0.97 + highBandEnergy * 0.03;

          const now = Date.now();
          const peakThreshold = Math.max(24, ambientLevel * 2.65);
          const averageThreshold = Math.max(12, ambientLevel + 9);
          const lowBandThreshold = Math.max(34, ambientLowBand * 2.4);
          const highBandThreshold = Math.max(20, ambientHighBand * 1.95);
          const spectralRatio = (highBandEnergy + 1) / (lowBandEnergy + 1);
          const rawDetected =
            (peak > peakThreshold && averageDeviation > averageThreshold) ||
            (highBandEnergy > highBandThreshold && spectralRatio > 0.84) ||
            lowBandEnergy > lowBandThreshold;
          const signalStrength = Math.max(
            peak / Math.max(1, peakThreshold),
            averageDeviation / Math.max(1, averageThreshold),
            lowBandEnergy / Math.max(1, lowBandThreshold),
            highBandEnergy / Math.max(1, highBandThreshold)
          );
          const signalRise = signalStrength - previousSignalStrength;
          previousSignalStrength = signalStrength;

          if (signalStrength < 0.74) {
            quietFrames++;
            if (quietFrames > 4) {
              gateReady = true;
            }
          } else {
            quietFrames = 0;
          }

          const gateOpen = gateReady && now >= holdoffUntil;
          const burstDetected =
            gateOpen && signalStrength > micBurstStrengthThreshold && signalRise > micRiseThreshold;
          burstFrames = burstDetected ? burstFrames + 1 : 0;
          const iosFastPathDetected =
            isIosNative &&
            gateOpen &&
            rawDetected &&
            signalStrength > 1.34 &&
            now - blowCooldownRef.current > 640;
          const blowDetected =
            iosFastPathDetected ||
            (rawDetected &&
              burstFrames >= micBurstFramesRequired &&
              signalStrength > micFinalStrengthThreshold &&
              now - blowCooldownRef.current > micCooldownMs);

          micMeterTickRef.current = (micMeterTickRef.current + 1) % (isIosNative ? 4 : 3);
          if (micMeterTickRef.current === 0) {
            setMicLevel(Math.min(1, signalStrength));
          }

          if (blowDetected) {
            if (!tunnelBombReadyRef.current) {
              holdoffUntil = now + 180;
              gateReady = false;
              quietFrames = 0;
              burstFrames = 0;
              rafId = requestAnimationFrame(readMic);
              return;
            }

            const triggered = triggerMicSpecial();
            holdoffUntil = now + 520;
            gateReady = false;
            quietFrames = 0;
            burstFrames = 0;
            setLastMicSignalAt(now);

            if (triggered) {
              blowCooldownRef.current = now;
            }
          }

          rafId = requestAnimationFrame(readMic);
        };

        readMic();
      } catch (error) {
        console.error('Mobile mic control failed:', error);
        if (active) {
          const errorName = String(error?.name || '').toLowerCase();
          if (errorName.includes('notallowed') || errorName.includes('security')) {
            setMicStatus('blocked');
          } else if (
            errorName.includes('notfound') ||
            errorName.includes('notreadable') ||
            errorName.includes('overconstrained') ||
            errorName.includes('abort')
          ) {
            setMicStatus('unavailable');
          } else {
            setMicStatus('blocked');
          }
          setMicLevel(0);
        }
      }
    };

    startMic();

    return () => {
      active = false;
      stopMic();
    };
  }, [
    gameState,
    isIosNative,
    appIsForeground,
    micDisclosureAccepted,
    settings.mobileMicEnabled,
    settings.mobileSpecialControl,
    skipMicForRun,
    triggerMicSpecial,
  ]);

  useEffect(() => {
    let mounted = true;

    const syncSaveForUser = async () => {
      if (!user?.id) return;

      try {
        const result = await ensureSaveLoaded();
        if (!mounted) return;

        if (result?.ok) {
          const playSyncResult = await syncGooglePlayPurchases(user.id);
          if (playSyncResult?.ok && playSyncResult.processed > 0) {
            await pullCloudSaveToLocal();
          }
          setSkinId(getSelectedSkin());
        }
      } catch (error) {
        console.error('User save sync failed:', error);
      }
    };

    syncSaveForUser();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const syncAfterCheckout = async () => {
      if (!areExternalPurchasesEnabled) return;

      const params = new URLSearchParams(window.location.search);
      const checkout = params.get('checkout');
      const sessionId = params.get('session_id');

      if (checkout === 'success' && user) {
        try {
          if (sessionId) {
            await syncCheckoutSession(sessionId);
          }

          const result = await pullCloudSaveToLocal();
          if (!mounted) return;

          if (result?.ok) {
            setSkinId(getSelectedSkin());
          }
        } catch (error) {
          console.error('Post-checkout cloud sync failed:', error);
        } finally {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, '', cleanUrl);
        }
      }

      if (checkout === 'cancelled') {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    };

    syncAfterCheckout();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    audioManager.setMusicMuted(!settings.musicEnabled);
    audioManager.setSfxMuted(!settings.sfxEnabled);
    audioManager.setMusicVolume(settings.musicVolume);
    audioManager.setSfxVolume(settings.sfxVolume);
  }, [settings.musicEnabled, settings.sfxEnabled, settings.musicVolume, settings.sfxVolume]);

  useEffect(() => {
    if (!settings.musicEnabled) {
      audioManager.stopAllMusic();
      audioManager.stopAllSfx();
      return;
    }

    if (gameState === 'idle') {
      audioManager.playMusic('menuTheme');
      return;
    }

    if (gameState === 'playing') {
      audioManager.playMusic('gameTheme');
      return;
    }

    audioManager.stopAllMusic();
  }, [gameState, settings.musicEnabled]);

  useEffect(() => {
    if (appIsForeground) {
      if (!settings.musicEnabled) return;
      if (gameState === 'playing') {
        audioManager.playMusic('gameTheme');
      } else if (gameState === 'idle') {
        audioManager.playMusic('menuTheme');
      }
      return;
    }
    audioManager.pauseMusic();
    audioManager.stopAllSfx();
  }, [appIsForeground, gameState, settings.musicEnabled]);

  useEffect(() => {
    return () => {
      audioManager.stopAllMusic();
    };
  }, []);

  useEffect(() => {
    const startOnFirstInput = (event) => {
      if (isEditableEventTarget(event?.target)) return;

      setGameState((prev) => {
        if (prev === 'ready') {
          return 'playing';
        }
        return prev;
      });
    };

    window.addEventListener('keydown', startOnFirstInput);
    window.addEventListener('mousedown', startOnFirstInput);
    window.addEventListener('touchstart', startOnFirstInput);

    return () => {
      window.removeEventListener('keydown', startOnFirstInput);
      window.removeEventListener('mousedown', startOnFirstInput);
      window.removeEventListener('touchstart', startOnFirstInput);
    };
  }, []);

  const finalizeRunResult = useCallback(async (outcome) => {
    if (!outcome) return;

    const safeScore = Math.max(0, Number(outcome.finalScore || 0));
    const safeKills = Math.max(0, Number(outcome.finalKills || 0));
    const safeDiamonds = Math.max(0, Number(outcome.diamondsThisRun || 0));

    const runResult = processGameOver(safeScore, safeKills);
    const earned = Number(runResult.coinsEarned || 0);
    const milestoneAward = Number(runResult.milestoneCoinsAwarded || 0);
    const unlockedBadges = Array.isArray(runResult.newlyUnlockedBadges)
      ? runResult.newlyUnlockedBadges
      : [];
    const completedMissions = Array.isArray(runResult?.dailyMissionProgress?.newlyCompleted)
      ? runResult.dailyMissionProgress.newlyCompleted.length
      : 0;

    setCoinsEarned(earned + milestoneAward);
    setDiamondsEarned(safeDiamonds);
    setMilestoneBonusCoins(milestoneAward);
    setNewBadgesUnlocked(unlockedBadges);
    setDailyMissionCompletions(completedMissions);

    try {
      await pushLocalSaveToCloud();
    } catch (error) {
      console.error('Game over cloud save failed:', error);
    }
  }, []);

  const commitPendingRunIfNeeded = useCallback(async () => {
    if (!pendingRunResult) return;
    await finalizeRunResult(pendingRunResult);
    setPendingRunResult(null);
  }, [finalizeRunResult, pendingRunResult]);

  const handleStart = useCallback(async () => {
    await commitPendingRunIfNeeded();
    audioManager.unlock();
    audioManager.playSfx('click');
    const equipped = getEquippedUpgrades();
    const hasTunnelBomb = Number(equipped?.tunnelbomb || 0) > 0;

    setScore(0);
    setKills(0);
    setCoinsEarned(0);
    setDiamondsEarned(0);
    setBlastReady(false);
    setTunnelBombReady(hasTunnelBomb);
    tunnelBombReadyRef.current = hasTunnelBomb;
    setComboSpecialReady(false);
    setReviveBusy(false);
    setReviveMessage('');
    setReviveRetryAt(0);
    setMilestoneBonusCoins(0);
    setNewBadgesUnlocked([]);
    setDailyMissionCompletions(0);
    setRunHasRevived(false);
    setSkipMicForRun(false);
    resetMicTransientState(true);
    killsRef.current = 0;
    setGameState('ready');
  }, [commitPendingRunIfNeeded, resetMicTransientState]);

  const handleReturnToMenu = useCallback(async () => {
    await commitPendingRunIfNeeded();
    audioManager.playSfx('click');
    setBlastReady(false);
    setTunnelBombReady(false);
    tunnelBombReadyRef.current = false;
    setComboSpecialReady(false);
    setCoinsEarned(0);
    setDiamondsEarned(0);
    setReviveBusy(false);
    setReviveMessage('');
    setReviveRetryAt(0);
    setPendingRunResult(null);
    setRunHasRevived(false);
    setMilestoneBonusCoins(0);
    setNewBadgesUnlocked([]);
    setDailyMissionCompletions(0);
    setScore(0);
    setKills(0);
    killsRef.current = 0;
    setSkipMicForRun(false);
    resetMicTransientState(true);
    setSkinId(getSelectedSkin());
    setGameState('idle');
  }, [commitPendingRunIfNeeded, resetMicTransientState]);

  const handleGameOver = useCallback(async (finalScore, finalKills, diamondsThisRun = 0) => {
    const k = finalKills ?? killsRef.current;
    const outcome = {
      finalScore: Math.max(0, Number(finalScore || 0)),
      finalKills: Math.max(0, Number(k || 0)),
      diamondsThisRun: Math.max(0, Number(diamondsThisRun || 0)),
    };

    setScore(outcome.finalScore);
    setKills(outcome.finalKills);
    setBlastReady(false);
    setTunnelBombReady(false);
    setComboSpecialReady(false);
    setReviveBusy(false);
    setMilestoneBonusCoins(0);
    setNewBadgesUnlocked([]);
    setDailyMissionCompletions(0);

    const canOfferRevive = isReviveAdsEnabled() && !runHasRevived;
    if (canOfferRevive) {
      primeReviveRewardedAd({ userId: user?.id || '' }).catch((error) => {
        console.warn('Revive ad preload failed:', error);
      });
      setPendingRunResult(outcome);
      setCoinsEarned(calculateRunCoinReward(outcome.finalScore, outcome.finalKills));
      setDiamondsEarned(outcome.diamondsThisRun);
      setReviveMessage('');
      setReviveRetryAt(0);
    } else {
      setPendingRunResult(null);
      await finalizeRunResult(outcome);
      setReviveMessage('');
      setReviveRetryAt(0);
    }

    setGameState('gameover');

    audioManager.stopAllMusic();
    audioManager.playSfx('gameOver');
  }, [finalizeRunResult, runHasRevived, user?.id]);

  const handleReviveAttempt = useCallback(async () => {
    if (!pendingRunResult || reviveBusy) return;

    setReviveBusy(true);
    setReviveMessage('');

    try {
      const adResult = await showReviveRewardedAd({ userId: user?.id || '' });
      if (!adResult?.ok || !adResult?.rewarded) {
        setReviveRetryAt(0);
        const message = String(adResult?.message || '').trim();
        const reason = String(adResult?.reason || '').trim();
        if (message) {
          setReviveMessage(`Revive ad unavailable: ${message}`);
        } else if (reason) {
          setReviveMessage(`Revive ad unavailable: ${reason}`);
        } else {
          setReviveMessage('Revive ad unavailable right now. Try again.');
        }
        return;
      }

      const resumed = reviveRef.current?.();
      if (!resumed) {
        setReviveMessage('Revive could not resume this run. Reboot to continue.');
        return;
      }

      setPendingRunResult(null);
      setRunHasRevived(true);
      setReviveRetryAt(0);
      setCoinsEarned(0);
      setDiamondsEarned(0);
      setSkipMicForRun(false);
      resetMicTransientState(true);
      setGameState('playing');
      setReviveMessage('');
    } catch (error) {
      console.error('Revive ad flow failed:', error);
      setReviveRetryAt(0);
      setReviveMessage(error?.message || 'Revive ad unavailable right now.');
    } finally {
      setReviveBusy(false);
    }
  }, [pendingRunResult, resetMicTransientState, reviveBusy, user?.id]);

  useEffect(() => {
    if (reviveRetryAt <= Date.now()) return undefined;
    const timerId = window.setInterval(() => {
      setReviveRetryTicker((value) => value + 1);
    }, 250);
    return () => window.clearInterval(timerId);
  }, [reviveRetryAt]);

  const handleScore = useCallback((newScore, newKills) => {
    setScore(newScore);
    if (newKills !== undefined) {
      killsRef.current = newKills;
      setKills(newKills);
    }
  }, []);

  const handleBlastReadyChange = useCallback((ready) => setBlastReady(ready), []);
  const handleTunnelBombReadyChange = useCallback((ready) => {
    const value = Boolean(ready);
    tunnelBombReadyRef.current = value;
    setTunnelBombReady(value);
  }, []);
  const handleComboSpecialReadyChange = useCallback((ready) => setComboSpecialReady(ready), []);
  const handleSkinChange = useCallback((id) => setSkinId(id), []);

  const isPlaying = gameState === 'playing';
  const mobileGameplayLayout = isPlaying && isMobileDevice;
  const showMobileTouchControls = isPlaying && isMobileDevice;
  const showBlastTrigger = blastReady;
  const showSpecialTrigger = comboSpecialReady || tunnelBombReady;
  const showMicPrompt = settings.mobileSpecialControl === 'blow' && settings.mobileMicEnabled;
  const micActionReady = tunnelBombReady || comboSpecialReady;
  const micSignalVisible = Date.now() - lastMicSignalAt < 850;
  const mobileMenuLayout = gameState !== 'playing' && isMobileDevice;
  const reviveRetrySeconds = Math.max(0, Math.ceil((reviveRetryAt - Date.now()) / 1000));
  const canUseRevive = gameState === 'gameover' && Boolean(pendingRunResult) && !runHasRevived;
  const mobileFullLayout = mobileGameplayLayout || mobileMenuLayout;
  const mobileControlReserve = showMobileTouchControls ? (showMicPrompt ? 96 : 72) : 0;
  const mobileCanvasAspect = 800 / 500;
  const fallbackViewportHeight =
    typeof window === 'undefined' ? 0 : Number(window.innerHeight || 0);
  const availableMobileCanvasHeight = Math.max(
    0,
    (mobileViewportHeight || fallbackViewportHeight) - mobileControlReserve
  );
  const mobileCanvasWidthPx = Math.floor(availableMobileCanvasHeight * mobileCanvasAspect);
  const mobileCanvasWidth =
    mobileGameplayLayout && mobileCanvasWidthPx > 0
      ? `min(100%, ${mobileCanvasWidthPx}px)`
      : '100%';
  const shellBackground =
    'radial-gradient(circle at top, rgba(127,198,238,0.18), rgba(0,0,0,0) 30%), radial-gradient(circle at 80% 18%, rgba(255,174,128,0.12), rgba(0,0,0,0) 22%), linear-gradient(180deg, #09131b 0%, #081019 38%, #05080c 100%)';

  return (
    <div
      className={`min-h-screen flex flex-col items-center select-none ${
        mobileFullLayout ? 'justify-start p-0' : 'justify-center p-1 md:p-2'
      }`}
      style={{
        background: shellBackground,
        overflowY: mobileGameplayLayout ? 'hidden' : mobileFullLayout ? 'auto' : 'hidden',
        height: mobileFullLayout && mobileViewportHeight ? `${mobileViewportHeight}px` : undefined,
      }}
    >
      <div
        className={`relative w-full ${mobileFullLayout ? 'rounded-none p-0' : 'rounded-[34px] p-2 md:p-3'}`}
        style={{
          maxWidth: mobileFullLayout ? '100%' : 'min(1480px, calc(100vw - 12px))',
          height:
            mobileFullLayout && mobileViewportHeight
              ? `${mobileViewportHeight}px`
              : mobileFullLayout
              ? '100dvh'
              : undefined,
          maxHeight:
            mobileFullLayout && mobileViewportHeight
              ? `${mobileViewportHeight}px`
              : mobileFullLayout
              ? '100dvh'
              : undefined,
          display: mobileFullLayout ? 'flex' : undefined,
          flexDirection: mobileFullLayout ? 'column' : undefined,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
          border: mobileFullLayout ? 'none' : '1px solid rgba(175,225,255,0.12)',
          boxShadow: mobileFullLayout ? 'none' : '0 32px 80px rgba(0,0,0,0.42)',
        }}
      >
        {showRotateHint && (
          <div
            className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.16em] md:hidden"
            style={{
              color: '#edf8ff',
              background: 'rgba(8,16,25,0.8)',
              border: '1px solid rgba(157,220,255,0.22)',
              boxShadow: '0 14px 28px rgba(0,0,0,0.34)',
              backdropFilter: isIosNative ? undefined : 'blur(8px)',
            }}
          >
            ROTATE TO LANDSCAPE FOR MOBILE CONTROLS
          </div>
        )}

        <div
          className={mobileGameplayLayout ? 'w-full flex-1 min-h-0 flex items-center justify-center' : undefined}
          style={
            mobileGameplayLayout
              ? {
                  paddingTop: 0,
                  paddingBottom: mobileControlReserve,
                }
              : undefined
          }
        >
          <div
            style={{
              width: mobileCanvasWidth,
              maxWidth: '100%',
              margin: '0 auto',
            }}
          >
            <GameCanvas
              gameState={gameState}
              score={score}
              skinId={skinId}
              isMobileDevice={isMobileDevice}
              onGameOver={handleGameOver}
              onScore={handleScore}
              onBlastReadyChange={handleBlastReadyChange}
              onTunnelBombReadyChange={handleTunnelBombReadyChange}
              onComboSpecialReadyChange={handleComboSpecialReadyChange}
              jumpRef={jumpRef}
              shootRef={shootRef}
              blastRef={blastRef}
              tunnelBombRef={tunnelBombRef}
              comboSpecialRef={comboSpecialRef}
              reviveRef={reviveRef}
              shootStartRef={startFireRef}
              shootStopRef={stopFireRef}
            />
          </div>
        </div>


        <MainMenu
          gameState={gameState}
          score={score}
          kills={kills}
          coinsEarned={coinsEarned}
          diamondsEarned={diamondsEarned}
          onStart={handleStart}
          onReturnToMenu={handleReturnToMenu}
          onSkinChange={handleSkinChange}
          onReviveAttempt={handleReviveAttempt}
          canUseRevive={canUseRevive}
          reviveBusy={reviveBusy}
          reviveRetrySeconds={reviveRetrySeconds}
          reviveMessage={reviveMessage}
          milestoneBonusCoins={milestoneBonusCoins}
          newBadgesUnlocked={newBadgesUnlocked}
          dailyMissionCompletions={dailyMissionCompletions}
        />

        {showMobileTouchControls && (
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none"
            style={{ zIndex: 1200, padding: '0 6px max(env(safe-area-inset-bottom), 6px)' }}
          >
            <div className="pointer-events-auto">
              <Suspense fallback={null}>
                <MobileTouchControls
                  gameState={gameState}
                  buttonLayout={settings.mobileButtonLayout}
                  showBlastTrigger={showBlastTrigger}
                  showSpecialTrigger={showSpecialTrigger}
                  onFlap={() => jumpRef.current?.()}
                  onFireStart={() => startFireRef.current?.()}
                  onFireStop={() => stopFireRef.current?.()}
                  onBlast={triggerBlast}
                  onSpecial={triggerSpecial}
                  onMicTrigger={triggerMicSpecial}
                  micEnabled={showMicPrompt}
                  micStatus={micStatus}
                  micLevel={micLevel}
                  micSignalVisible={micSignalVisible}
                  micActionReady={micActionReady}
                />
              </Suspense>
            </div>
          </div>
        )}

        {showMobileTouchControls && showMicPrompt && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
            <div
              className="absolute left-3 top-3 rounded-full px-3 py-2 font-mono text-[10px] tracking-[0.16em]"
              style={{
                background: 'rgba(0,0,0,0.42)',
                border: '1px solid rgba(255,255,255,0.14)',
                color:
                  micStatus === 'listening'
                    ? micActionReady
                      ? '#7de3ff'
                      : 'rgba(237,248,255,0.72)'
                    : '#ffc785',
                backdropFilter: isIosNative ? undefined : 'blur(10px)',
              }}
            >
              {micStatus === 'needs-disclosure'
                ? 'MIC READY'
                : micStatus === 'listening'
                ? micSignalVisible
                  ? micActionReady
                    ? 'BLOW DETECTED'
                    : 'MIC HEARD / SPECIAL NOT READY'
                  : micActionReady
                    ? 'BLOW NOW'
                    : 'MIC LISTENING'
                : micStatus === 'requesting'
                  ? 'MIC REQUEST'
                : micStatus === 'unsupported'
                    ? 'MIC UNSUPPORTED'
                    : micStatus === 'unavailable'
                      ? 'MIC DEVICE ISSUE'
                    : micStatus === 'blocked'
                      ? 'MIC BLOCKED'
                      : 'MIC OFF'}
            </div>

            {micStatus === 'needs-disclosure' && (
              <div
                className="absolute left-3 right-3 top-14 rounded-3xl p-4 pointer-events-auto"
                style={{
                  background: 'rgba(6,12,18,0.92)',
                  border: '1px solid rgba(157,220,255,0.2)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                  backdropFilter: isIosNative ? undefined : 'blur(12px)',
                }}
              >
                <div
                  className="font-display text-sm font-black tracking-[0.12em]"
                  style={{ color: '#edf8ff' }}
                >
                  OPTIONAL MICROPHONE CONTROL
                </div>
                <div
                  className="font-mono text-[11px] leading-5 mt-2"
                  style={{ color: 'rgba(225,235,242,0.76)' }}
                >
                  FirePilot can use the microphone during this run to detect a short blow and
                  trigger the available special action. The microphone input is used locally for gameplay
                  control and is not uploaded by the app.
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSkipMicForRun(true)}
                    className="rounded-full px-4 py-2 font-mono text-[10px] tracking-[0.16em]"
                    style={{
                      color: 'rgba(225,235,242,0.72)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    NOT NOW
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      acceptMicDisclosure();
                      setMicDisclosureAccepted(true);
                      setMicStatus('idle');
                    }}
                    className="rounded-full px-4 py-2 font-mono text-[10px] tracking-[0.16em]"
                    style={{
                      color: '#9ddcff',
                      background: 'rgba(157,220,255,0.08)',
                      border: '1px solid rgba(157,220,255,0.22)',
                    }}
                  >
                    ALLOW MIC
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!mobileGameplayLayout && (
        <p
          className="mt-3 font-mono text-xs tracking-[0.22em]"
          style={{ color: 'rgba(190,220,235,0.32)' }}
        >
          FIREPILOT FLAP WAR // FUTURE STRIKE BUILD
        </p>
      )}
    </div>
  );
}
