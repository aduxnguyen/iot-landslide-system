import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export function AudioAlarm({ isMovement }) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);
  const intervalRef = useRef(null);

  const toggleAudio = () => {
    if (!isAudioEnabled) {
      // Khởi tạo AudioContext khi có tương tác người dùng
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setIsAudioEnabled(true);
    } else {
      stopBeep();
      setIsAudioEnabled(false);
    }
  };

  const playBeep = () => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz (A5)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  };

  const stopBeep = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isMovement && isAudioEnabled) {
      playBeep();
      if (!intervalRef.current) {
        intervalRef.current = setInterval(playBeep, 1000);
      }
    } else {
      stopBeep();
    }

    return () => stopBeep();
  }, [isMovement, isAudioEnabled]);

  return (
    <button
      onClick={toggleAudio}
      title={isAudioEnabled ? "Tắt âm thanh báo động" : "Bật âm thanh cảnh báo sạt lở"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        isAudioEnabled
          ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
      }`}
    >
      {isAudioEnabled ? <Volume2 className="w-4 h-4 text-red-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
      <span>{isAudioEnabled ? 'Còi Web: BẬT' : 'Còi Web: TẮT'}</span>
    </button>
  );
}
