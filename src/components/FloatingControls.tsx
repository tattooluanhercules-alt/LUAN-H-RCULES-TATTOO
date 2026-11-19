import { useState } from 'react';
import { MessageCircle, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type { MusicTrack, StudioConfig } from '../types/studio';

interface FloatingControlsProps {
  config: StudioConfig;
  activeTrack: MusicTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  onTogglePlay: () => void;
  onVolumeChange: (vol: number) => void;
}

export function FloatingControls({
  config,
  activeTrack,
  isPlaying,
  isLoading,
  volume,
  onTogglePlay,
  onVolumeChange,
}: FloatingControlsProps) {
  const [showVolume, setShowVolume] = useState(false);

  const whatsappHref = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(
    'Olá, Luan! Conheci seu trabalho pelo site e gostaria de conversar sobre uma tatuagem e agendamento.'
  )}`;

  return (
    <>
      {/* Bottom-Left: Persistent Ambient Soundtrack Player (user-click only) */}
      {config.playerEnabled && activeTrack && (
        <div
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 bg-[#151515]/95 backdrop-blur-md border border-[#C9A34A]/40 rounded-sm px-2.5 py-2 shadow-lg max-w-[calc(100vw-88px)] sm:max-w-xs"
          aria-label="Player de trilha sonora ambiente"
        >
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pausar trilha sonora' : 'Tocar trilha sonora'}
            className="w-9 h-9 flex items-center justify-center bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] rounded-sm shrink-0 transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] font-medium text-white truncate">
              {activeTrack.name}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#A5A5A5]">
              <span>
                {isLoading
                  ? 'Carregando...'
                  : isPlaying
                    ? 'Em reprodução'
                    : 'Clique para ouvir'}
              </span>
              {isPlaying && (
                <span className="inline-flex items-end gap-0.5 h-2.5" aria-hidden="true">
                  <span className="w-0.5 h-2 bg-[#C9A34A] animate-pulse" />
                  <span className="w-0.5 h-2.5 bg-[#E2C47A] animate-pulse" />
                  <span className="w-0.5 h-1.5 bg-[#C9A34A] animate-pulse" />
                </span>
              )}
            </div>
          </div>

          <div className="relative flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowVolume((v) => !v)}
              aria-label="Ajustar volume"
              className="w-8 h-8 flex items-center justify-center text-[#A5A5A5] hover:text-[#E2C47A] transition-colors cursor-pointer"
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {showVolume && (
              <div className="absolute bottom-12 right-0 bg-[#151515] border border-[#C9A34A]/40 rounded-sm p-3 shadow-xl flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  aria-label="Volume da trilha sonora"
                  className="w-24 accent-[#C9A34A] cursor-pointer"
                />
                <span className="font-mono-tabular text-[11px] text-[#E2C47A] w-8 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom-Right: Discreet Floating WhatsApp Button (never overlaps player) */}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar no WhatsApp com Luan Hércules"
        className="fixed bottom-4 right-4 z-40 w-12 h-12 sm:w-auto sm:h-12 sm:px-5 flex items-center justify-center gap-2.5 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] rounded-sm shadow-lg transition-transform hover:-translate-y-0.5 font-semibold text-xs tracking-[0.1em] uppercase"
      >
        <MessageCircle className="w-5 h-5 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">WhatsApp</span>
      </a>
    </>
  );
}
