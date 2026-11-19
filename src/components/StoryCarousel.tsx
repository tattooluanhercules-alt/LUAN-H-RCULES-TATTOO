import { useRef, useState, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { StoryChapter } from '../types/studio';
import { ResilientImage } from './ResilientImage';

interface StoryCarouselProps {
  title: string;
  closingQuote: string;
  chapters: StoryChapter[];
}

export function StoryCarousel({ title, closingQuote, chapters }: StoryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const safeChapters = chapters.length > 0 ? chapters : [];
  const total = safeChapters.length;
  const current = safeChapters[activeIndex];

  const prev = () => {
    if (total === 0) return;
    setActiveIndex((i) => (i === 0 ? total - 1 : i - 1));
  };

  const next = () => {
    if (total === 0) return;
    setActiveIndex((i) => (i === total - 1 ? 0 : i + 1));
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  if (total === 0) return null;

  const progressPct = ((activeIndex + 1) / total) * 100;

  return (
    <section
      id="historia"
      className="py-24 lg:py-32 bg-[#080808] border-b border-white/10"
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
              Trajetória · 12 Fotografias
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono-tabular text-sm text-[#A5A5A5]">
              <strong className="text-[#E2C47A] font-medium">
                {String(activeIndex + 1).padStart(2, '0')}
              </strong>
              {' / '}
              {String(total).padStart(2, '0')}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                aria-label="Fotografia anterior da história"
                className="w-11 h-11 flex items-center justify-center border border-white/15 bg-[#151515] hover:border-[#C9A34A] text-white hover:text-[#E2C47A] transition-colors rounded-sm cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Próxima fotografia da história"
                className="w-11 h-11 flex items-center justify-center border border-white/15 bg-[#151515] hover:border-[#C9A34A] text-white hover:text-[#E2C47A] transition-colors rounded-sm cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Cinematic Carousel Viewport */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch bg-[#151515] border border-white/10 rounded-sm overflow-hidden"
        >
          {/* Image Column */}
          <div className="lg:col-span-7 relative aspect-[4/3] lg:aspect-auto lg:min-h-[480px] bg-[#0d0d0d] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0.25, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.25 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full"
              >
                <ResilientImage
                  src={current.photoUrl}
                  alt={current.title}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </AnimatePresence>
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#080808]/60 via-transparent to-transparent pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Narrative Column */}
          <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 text-xs text-[#C9A34A] tracking-[0.2em] uppercase mb-4">
                <span className="font-mono-tabular">
                  Capítulo {String(activeIndex + 1).padStart(2, '0')}
                </span>
                <span aria-hidden="true">·</span>
                <span>{current.isOriginalUploaded ? 'Acervo Original' : 'Registro do Estúdio'}</span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl text-white font-medium mb-5">
                {current.title}
              </h3>

              <p className="text-[#A5A5A5] text-base leading-relaxed">{current.text}</p>
            </div>

            {/* Progress Bar & 12-Chapter Quick Selector */}
            <div className="mt-10 pt-6 border-t border-white/10">
              <div className="w-full h-[2px] bg-white/10 mb-5 overflow-hidden">
                <div
                  className="h-full bg-[#C9A34A] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-12 lg:grid-cols-6 gap-2">
                {safeChapters.map((ch, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      aria-label={`Ir para ${ch.title}`}
                      className={`py-2 text-xs font-mono-tabular border rounded-sm transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#C9A34A] text-[#080808] border-[#C9A34A] font-semibold'
                          : 'bg-[#080808] text-[#A5A5A5] border-white/10 hover:border-[#C9A34A]/60 hover:text-white'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Closing Quote */}
        <blockquote className="mt-12 max-w-3xl mx-auto text-center">
          <p className="font-display italic text-xl sm:text-2xl text-[#E2C47A] leading-relaxed">
            “{closingQuote}”
          </p>
        </blockquote>
      </div>
    </section>
  );
}
