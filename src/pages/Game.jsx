import React, { useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from '../components/game/GameCanvas';
import MainMenu from '../components/game/MainMenu';
import {
  getSelectedSkin,
  processGameOver,
  getCoins,
} from '../lib/gameStore';
import {
  ensureSaveLoaded,
  pushLocalSaveToCloud,
  pullCloudSaveToLocal,
} from '../lib/cloudSave';
import { useAuth } from '../lib/AuthContext';
import audioManager from '../lib/audioManager';
import useAudioUnlock from '../lib/useAudioUnlock';

export default function Game() {
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [skinId, setSkinId] = useState(getSelectedSkin());
  const [blastReady, setBlastReady] = useState(false);
  const [tunnelBombReady, setTunnelBombReady] = useState(false);
  const [localCoins, setLocalCoins] = useState(getCoins());

  const killsRef = useRef(0);

  const jumpRef = useRef(null);
  const shootRef = useRef(null);
  const blastRef = useRef(null);
  const tunnelBombRef = useRef(null);

  const { user } = useAuth();

  useAudioUnlock();

  useEffect(() => {
    const refreshCoins = () => setLocalCoins(getCoins());

    refreshCoins();

    const handleStorage = () => refreshCoins();
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncSaveOnLoad = async () => {
      try {
        const result = await ensureSaveLoaded();
        if (!mounted) return;

        if (result?.ok) {
          setSkinId(getSelectedSkin());
          setLocalCoins(getCoins());
        }
      } catch (error) {
        console.error('Initial save sync failed:', error);
      }
    };

    syncSaveOnLoad();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncAfterCheckout = async () => {
      const params = new URLSearchParams(window.location.search);
      const checkout = params.get('checkout');

      if (checkout === 'success' && user) {
        try {
          const result = await pullCloudSaveToLocal();
          if (!mounted) return;

          if (result?.ok) {
            setSkinId(getSelectedSkin());
            setLocalCoins(getCoins());
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
    if (gameState === 'playing') {
      audioManager.playMusic('gameTheme');
    } else {
      audioManager.playMusic('menuTheme');
    }
  }, [gameState]);

  useEffect(() => {
    return () => {
      audioManager.stopAllMusic();
    };
  }, []);

  const handleStart = useCallback(() => {
    audioManager.unlock();
    audioManager.playSfx('click');

    setScore(0);
    setKills(0);
    setCoinsEarned(0);
    setBlastReady(false);
    setTunnelBombReady(false);
    killsRef.current = 0;
    setGameState('playing');
  }, []);

  const handleGameOver = useCallback(async (finalScore, finalKills) => {
    const k = finalKills ?? killsRef.current;

    setScore(finalScore);
    setKills(k);
    setBlastReady(false);
    setTunnelBombReady(false);

    const { coinsEarned: earned } = processGameOver(finalScore, k);
    setCoinsEarned(earned);
    setLocalCoins(getCoins());
    setGameState('gameover');

    audioManager.playSfx('gameOver');

    try {
      await pushLocalSaveToCloud();
    } catch (error) {
      console.error('Game over cloud save failed:', error);
    }
  }, []);

  const handleScore = useCallback((newScore, newKills) => {
    setScore(newScore);
    if (newKills !== undefined) {
      killsRef.current = newKills;
      setKills(newKills);
    }
  }, []);

  const handleBlastReadyChange = useCallback((ready) => setBlastReady(ready), []);
  const handleTunnelBombReadyChange = useCallback((ready) => setTunnelBombReady(ready), []);
  const handleSkinChange = useCallback((id) => setSkinId(id), []);

  const isPlaying = gameState === 'playing';
  const specialCount = (blastReady ? 1 : 0) + (tunnelBombReady ? 1 : 0);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-2 select-none">
      <div className="relative w-full" style={{ maxWidth: 800 }}>
        <GameCanvas
          gameState={gameState}
          score={score}
          skinId={skinId}
          onGameOver={handleGameOver}
          onScore={handleScore}
          onBlastReadyChange={handleBlastReadyChange}
          onTunnelBombReadyChange={handleTunnelBombReadyChange}
          jumpRef={jumpRef}
          shootRef={shootRef}
          blastRef={blastRef}
          tunnelBombRef={tunnelBombRef}
        />

        <MainMenu
          gameState={gameState}
          score={score}
          kills={kills}
          coinsEarned={coinsEarned}
          onStart={handleStart}
          onSkinChange={handleSkinChange}
        />

        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
            <MobileBtn
              onPress={() => jumpRef.current?.()}
              style={{ bottom: 14, left: 14 }}
              color="#00ffff"
              border="hsla(180,100%,50%,0.5)"
              bg="hsla(180,100%,50%,0.12)"
              icon="▲"
              label="FLY"
            />

            <MobileBtn
              onPress={() => shootRef.current?.()}
              style={{ bottom: 14, right: 14 + specialCount * 68, transition: 'right 0.2s' }}
              color="#ffff00"
              border="hsla(60,100%,50%,0.5)"
              bg="hsla(60,100%,50%,0.12)"
              icon="◄►"
              label="FIRE"
            />

            {blastReady && (
              <MobileBtn
                onPress={() => blastRef.current?.()}
                style={{
                  bottom: 14,
                  right: 14 + (tunnelBombReady ? 68 : 0),
                  animation: 'blastpulse 0.7s ease-in-out infinite alternate',
                }}
                color="#ff00ff"
                border="#ff00ff"
                bg="hsla(300,100%,50%,0.2)"
                icon="💥"
                label="BLAST"
                bold
              />
            )}

            {tunnelBombReady && (
              <MobileBtn
                onPress={() => tunnelBombRef.current?.()}
                style={{
                  bottom: 14,
                  right: 14,
                  animation: 'blastpulse 0.9s ease-in-out infinite alternate',
                }}
                color="#ff6600"
                border="#ff6600"
                bg="hsla(24,100%,50%,0.2)"
                icon="💣"
                label="BOMB"
                bold
              />
            )}
          </div>
        )}
      </div>

      <p className="mt-2 font-mono text-xs" style={{ color: 'hsla(180,100%,50%,0.2)' }}>
        FIREPILOT: FLAP WAR v1.0
      </p>

      <style>{`
        @keyframes blastpulse {
          from { box-shadow: 0 0 10px #ff00ff66; transform: scale(1); }
          to   { box-shadow: 0 0 26px #ff00ffcc; transform: scale(1.07); }
        }
      `}</style>
    </div>
  );
}

function MobileBtn({ onPress, style, color, border, bg, icon, label, bold }) {
  return (
    <button
      onTouchStart={(e) => {
        e.preventDefault();
        onPress();
      }}
      onClick={onPress}
      className="absolute pointer-events-auto"
      style={{
        width: 58,
        height: 58,
        borderRadius: '50%',
        background: bg,
        border: `1.5px solid ${border}`,
        color,
        fontFamily: 'Orbitron, sans-serif',
        fontWeight: bold ? 900 : 700,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        ...style,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 7 }}>{label}</span>
    </button>
  );
}