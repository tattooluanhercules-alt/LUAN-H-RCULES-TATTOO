import { motion } from 'motion/react';
import { ArrowDownRight } from 'lucide-react';
import type { StudioConfig } from '../types/studio';
import { ResilientImage } from './ResilientImage';

interface HeroSectionProps {
  config: StudioConfig;
  featuredImageUrl: string;
}

export function HeroSection({ config, featuredImageUrl }: HeroSectionProps) {
  const scrollTo = (selector: string) => {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="inicio"
      className="relative min-h-[88vh] lg:min-h-[92vh] flex items-center bg-[#080808] overflow-hidden border-b border-white/10"
    >
      {/* Background photographic centerpiece with subtle cinematic scale */}
      <div className="absolute inset-0">
        <motion.div
          initial={{ scale: 1.06, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full"
        >
          <ResilientImage
            src={featuredImageUrl}
            alt="Luan Hércules em processo criativo no estúdio"
            loading="eager"
            className="w-full h-full object-cover object-center lg:object-[68%_center]"
          />
        </motion.div>
        {/* Measured scrim for crisp WCAG AA legibility */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/85 to-[#080808]/35"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/40"
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1280px] mx-auto w-full px-5 sm:px-8 py-20 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <div className="mb-6">
            <p className="text-xs sm:text-sm tracking-[0.28em] uppercase text-[#C9A34A] font-medium">
              LUAN HÉRCULES · TATTOO STUDIO
            </p>
            <div className="w-16 h-[1px] bg-[#C9A34A]/60 mt-3" />
          </div>

          <h1
            className="font-display font-medium text-white leading-[1.06] tracking-[-0.015em] mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4.35rem)', textWrap: 'balance' }}
          >
            {config.heroHeadline}
          </h1>

          <p className="text-base sm:text-lg text-[#A5A5A5] leading-relaxed max-w-xl mb-10">
            {config.heroSubtitle}
          </p>

          {/* Actions: 1 dominant primary CTA + 2 clean secondary links */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => scrollTo('#agendamento')}
              className="inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] transition-colors text-xs sm:text-sm font-semibold tracking-[0.14em] uppercase rounded-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Agendar Minha Tatuagem</span>
              <ArrowDownRight className="w-4 h-4" />
            </button>

            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => scrollTo('#portfolio')}
                className="px-4 py-3 border border-white/20 hover:border-[#C9A34A] text-white hover:text-[#E2C47A] transition-colors text-xs sm:text-sm font-medium tracking-[0.08em] uppercase rounded-sm whitespace-nowrap shrink-0 cursor-pointer"
              >
                Conhecer Meu Trabalho
              </button>

              <button
                type="button"
                onClick={() => scrollTo('#historia')}
                className="py-2 text-xs sm:text-sm font-medium tracking-[0.08em] uppercase text-[#A5A5A5] hover:text-[#E2C47A] border-b border-transparent hover:border-[#C9A34A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Conhecer Minha História
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
