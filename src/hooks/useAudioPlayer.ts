import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicTrack } from '../types/studio';

export function useAudioPlayer(activeTrack: MusicTrack | null, enabled: boolean, defaultVolume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(defaultVolume);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'none';
      audio.addEventListener('playing', () => {
        setIsPlaying(true);
        setIsLoading(false);
      });
      audio.addEventListener('pause', () => {
        setIsPlaying(false);
      });
      audio.addEventListener('waiting', () => {
        setIsLoading(true);
      });
      audio.addEventListener('canplay', () => {
        setIsLoading(false);
      });
      audio.addEventListener('error', () => {
        setIsLoading(false);
        setIsPlaying(false);
        setAudioError('Não foi possível reproduzir esta faixa.');
      });
      audioRef.current = audio;
    }

    return () => {
      // Persistent across route transitions; only pause on unmount of root App
    };
  }, []);

  useEffect(() => {
    setVolume(defaultVolume);
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, defaultVolume));
    }
  }, [defaultVolume]);

  useEffect(() => {
    if (!enabled && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) return;

    if (activeUrlRef.current !== activeTrack.streamUrl) {
      const wasPlaying = !audio.paused;
      activeUrlRef.current = activeTrack.streamUrl;
      audio.src = activeTrack.streamUrl;
      audio.volume = Math.max(0, Math.min(1, volume));
      if (wasPlaying && enabled) {
        audio.play().catch(() => setIsPlaying(false));
      }
    }
  }, [activeTrack, enabled, volume]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !activeTrack || !enabled) return;

    setAudioError(null);
    if (!audio.src) {
      audio.src = activeTrack.streamUrl;
      activeUrlRef.current = activeTrack.streamUrl;
    }
    audio.volume = Math.max(0, Math.min(1, volume));

    if (audio.paused) {
      setIsLoading(true);
      try {
        await audio.play();
      } catch {
        setIsLoading(false);
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  }, [activeTrack, enabled, volume]);

  const changeVolume = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  return {
    isPlaying,
    isLoading,
    volume,
    audioError,
    togglePlay,
    changeVolume,
  };
}
