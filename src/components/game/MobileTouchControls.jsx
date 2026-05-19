import React, { useState } from 'react';

function TouchButton({ label, onPress, onRelease, color, wide = false }) {
  const [pressed, setPressed] = useState(false);

  const handleDown = (event) => {
    event.preventDefault();
    setPressed(true);
    onPress?.();
  };

  const handleUp = (event) => {
    event.preventDefault();
    setPressed(false);
    onRelease?.();
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={handleUp}
      onContextMenu={(event) => event.preventDefault()}
      className={`rounded-2xl font-display font-black tracking-[0.16em] ${
        wide ? 'w-full py-2.5 text-sm' : 'px-3 py-2 text-[10px]'
      }`}
      style={{
        color: '#edf8ff',
        border: `1px solid ${pressed ? `${color}88` : `${color}44`}`,
        background: pressed
          ? `linear-gradient(180deg, ${color}55, rgba(12,22,34,0.88))`
          : `linear-gradient(180deg, ${color}33, rgba(12,22,34,0.92))`,
        boxShadow: pressed
          ? `0 0 12px ${color}66, inset 0 0 14px ${color}44`
          : `0 0 6px ${color}44`,
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}

export default function MobileTouchControls({
  gameState,
  buttonLayout = 'fly-left',
  showBlastTrigger,
  showSpecialTrigger,
  onFlap,
  onFireStart,
  onFireStop,
  onBlast,
  onSpecial,
  onMicTrigger,
  micEnabled = false,
  micStatus = 'idle',
  micLevel = 0,
  micSignalVisible = false,
  micActionReady = false,
}) {
  if (gameState !== 'playing') return null;
  const flyOnLeft = buttonLayout !== 'fly-right';
  const fireBeaconColor = showSpecialTrigger ? '#ff8b3d' : showBlastTrigger ? '#ff4dff' : '#ffe66d';
  const fireBeaconLabel = showSpecialTrigger
    ? 'SPECIAL READY'
    : showBlastTrigger
      ? 'BLAST READY'
      : 'SPECIAL CHARGING';
  const leftAction = flyOnLeft
    ? { label: 'FLAP', onPress: onFlap, onRelease: undefined, color: '#7de3ff' }
    : { label: 'FIRE', onPress: onFireStart, onRelease: onFireStop, color: fireBeaconColor };
  const rightAction = flyOnLeft
    ? { label: 'FIRE', onPress: onFireStart, onRelease: onFireStop, color: fireBeaconColor }
    : { label: 'FLAP', onPress: onFlap, onRelease: undefined, color: '#7de3ff' };
  const micStatusLabel = micSignalVisible
    ? 'MIC HEARD'
    : micStatus === 'listening'
      ? 'MIC LISTENING'
      : micStatus === 'requesting'
        ? 'MIC REQUEST'
      : micStatus === 'unsupported'
          ? 'MIC UNSUPPORTED'
          : micStatus === 'unavailable'
            ? 'MIC CHECK'
            : micStatus === 'blocked'
              ? 'MIC BLOCKED'
              : 'MIC IDLE';

  return (
    <div
      className="w-full mt-0.5 pointer-events-auto"
      style={{ paddingBottom: '2px' }}
    >
      <div className="grid grid-cols-2 gap-2">
        <TouchButton
          label={leftAction.label}
          onPress={leftAction.onPress}
          onRelease={leftAction.onRelease}
          color={leftAction.color}
          wide
        />
        <TouchButton
          label={rightAction.label}
          onPress={rightAction.onPress}
          onRelease={rightAction.onRelease}
          color={rightAction.color}
          wide
        />
      </div>

      <div className="mt-1.5 h-5 flex items-center justify-center">
        <span
          className="font-mono text-[10px] tracking-[0.14em]"
          style={{ color: fireBeaconColor, opacity: showBlastTrigger || showSpecialTrigger ? 1 : 0.68 }}
        >
          {fireBeaconLabel}
        </span>
      </div>

      <div className={`mt-1.5 h-8 flex gap-2 ${flyOnLeft ? 'justify-end' : 'justify-start'}`}>
        <button
          type="button"
          onClick={() => showBlastTrigger && onBlast?.()}
          disabled={!showBlastTrigger}
          className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold tracking-[0.14em]"
          style={{
            minWidth: 72,
            background: showBlastTrigger ? 'hsla(300,100%,50%,0.14)' : 'hsla(0,0%,100%,0.06)',
            color: showBlastTrigger ? '#ff8cff' : 'rgba(255,255,255,0.38)',
            border: showBlastTrigger
              ? '1px solid hsla(300,100%,50%,0.32)'
              : '1px solid rgba(255,255,255,0.14)',
            cursor: showBlastTrigger ? 'pointer' : 'default',
          }}
        >
          BLAST
        </button>
        <button
          type="button"
          onClick={() => showSpecialTrigger && onSpecial?.()}
          disabled={!showSpecialTrigger}
          className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold tracking-[0.14em]"
          style={{
            minWidth: 72,
            background: showSpecialTrigger ? 'hsla(25,100%,50%,0.15)' : 'hsla(0,0%,100%,0.06)',
            color: showSpecialTrigger ? '#ffbe8e' : 'rgba(255,255,255,0.38)',
            border: showSpecialTrigger
              ? '1px solid hsla(25,100%,50%,0.34)'
              : '1px solid rgba(255,255,255,0.14)',
            cursor: showSpecialTrigger ? 'pointer' : 'default',
          }}
        >
          SPECIAL
        </button>
      </div>

      {micEnabled && (
        <div
          className="mt-1.5 rounded-lg px-2.5 py-1.5"
          style={{
            background: 'rgba(4,10,16,0.76)',
            border: '1px solid rgba(157,220,255,0.24)',
            boxShadow: '0 0 12px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: '#eaf6ff' }}>
              {micStatusLabel}
            </span>
            <span className="font-mono text-[10px]" style={{ color: '#9ddcff' }}>
              {Math.round(Math.min(1, Math.max(0, micLevel)) * 100)}%
            </span>
          </div>
          <div
            className="mt-1 h-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(Math.min(1, Math.max(0, micLevel)) * 100)}%`,
                background: micSignalVisible ? '#7de3ff' : '#ffc785',
                boxShadow: micSignalVisible ? '0 0 8px #7de3ff' : '0 0 6px #ffc785',
                transition: 'width 60ms linear',
              }}
            />
          </div>
          <div
            className="mt-1.5 h-3.5 font-mono text-[9px] tracking-[0.1em]"
            style={{ color: micActionReady ? '#7de3ff' : 'rgba(225,235,242,0.52)' }}
          >
            {micActionReady ? 'BLOW TO TRIGGER SPECIAL' : 'SPECIAL CHARGING'}
          </div>
          <button
            type="button"
            onClick={() => micActionReady && onMicTrigger?.()}
            disabled={!micActionReady}
            className="mt-1.5 w-full rounded-md px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em]"
            style={{
              background: micActionReady ? 'rgba(125,227,255,0.16)' : 'rgba(255,255,255,0.06)',
              color: micActionReady ? '#7de3ff' : 'rgba(225,235,242,0.42)',
              border: micActionReady
                ? '1px solid rgba(125,227,255,0.4)'
                : '1px solid rgba(255,255,255,0.14)',
              cursor: micActionReady ? 'pointer' : 'default',
            }}
          >
            MIC TRIGGER
          </button>
        </div>
      )}
    </div>
  );
}
