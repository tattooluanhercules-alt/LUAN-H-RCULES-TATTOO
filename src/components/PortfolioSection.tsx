import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import type { GalleryItem, TattooCategory } from '../types/studio';
import { TATTOO_CATEGORIES } from '../types/studio';
import { ResilientImage } from './ResilientImage';

interface PortfolioSectionProps {
  items: GalleryItem[];
  columns: 3 | 4;
}

export function PortfolioSection({ items, columns }: PortfolioSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | TattooCategory>('Todos');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'Todos') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const activeItem = lightboxIndex !== null ? filteredItems[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null ? null : prev === 0 ? filteredItems.length - 1 : prev - 1
        );
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : prev === filteredItems.length - 1 ? 0 : prev + 1
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, filteredItems.length]);

  const gridColsClass =
    columns === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section id="portfolio" className="py-24 lg:py-32 bg-[#080808] border-b border-white/10">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
              Portfólio Selecionado
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Obras que carregam identidade e precisão.
            </h2>
          </div>

          {/* Interactive Category Filters */}
          <div
            role="tablist"
            aria-label="Categorias do portfólio"
            className="flex flex-wrap items-center gap-1.5 bg-[#151515] p-1.5 border border-white/10 rounded-sm"
          >
            {(['Todos', ...TATTOO_CATEGORIES] as const).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setLightboxIndex(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-medium tracking-wide rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#C9A34A] text-[#080808] font-semibold'
                      : 'text-[#A5A5A5] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center bg-[#151515] border border-white/10 rounded-sm">
            <p className="font-display text-2xl text-white mb-2">
              Nenhum trabalho publicado nesta categoria.
            </p>
            <p className="text-sm text-[#A5A5A5]">
              Selecione outra categoria ou adicione novas fotografias no painel administrativo.
            </p>
          </div>
        ) : (
          <div className={`grid ${gridColsClass} gap-6`}>
            {filteredItems.map((item, idx) => (
              <article
                key={item.id}
                className="group bg-[#151515] border border-white/10 hover:border-[#C9A34A]/60 transition-colors rounded-sm overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  aria-label={`Ampliar ${item.caption || item.fileName}`}
                  className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0d0d] text-left cursor-pointer"
                >
                  <ResilientImage
                    src={item.url}
                    alt={item.caption || item.fileName}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#080808]/80 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity"
                    aria-hidden="true"
                  />
                  <span className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-[#080808]/75 border border-white/15 text-white/80 group-hover:text-[#E2C47A] group-hover:border-[#C9A34A]/60 rounded-sm transition-colors">
                    <Expand className="w-4 h-4" />
                  </span>
                </button>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#C9A34A] tracking-[0.12em] uppercase mb-2">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-[#A5A5A5]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-white font-medium leading-snug mb-1.5">
                      {item.caption || item.fileName}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-[#A5A5A5] leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {activeItem && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-[#080808]/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.caption || 'Visualização ampliada'}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Fechar visualização"
            className="absolute top-5 right-5 z-10 w-11 h-11 flex items-center justify-center bg-[#151515] border border-white/20 hover:border-[#C9A34A] text-white hover:text-[#E2C47A] rounded-sm transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setLightboxIndex(
                lightboxIndex === 0 ? filteredItems.length - 1 : lightboxIndex - 1
              )
            }
            aria-label="Trabalho anterior"
            className="absolute left-3 sm:left-6 z-10 w-11 h-11 flex items-center justify-center bg-[#151515]/90 border border-white/20 hover:border-[#C9A34A] text-white hover:text-[#E2C47A] rounded-sm transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#151515] border border-white/15 rounded-sm overflow-hidden max-h-[90vh]">
            <div className="lg:col-span-8 bg-[#080808] flex items-center justify-center max-h-[62vh] lg:max-h-[85vh] overflow-hidden">
              <ResilientImage
                src={activeItem.url}
                alt={activeItem.caption || activeItem.fileName}
                loading="eager"
                className="w-full h-full object-contain max-h-[62vh] lg:max-h-[85vh]"
              />
            </div>

            <div className="lg:col-span-4 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#C9A34A] tracking-[0.18em] uppercase mb-3">
                  <span>{activeItem.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-[#A5A5A5]">
                    {String(lightboxIndex + 1).padStart(2, '0')} /{' '}
                    {String(filteredItems.length).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl text-white font-medium mb-4">
                  {activeItem.caption || activeItem.fileName}
                </h3>
                {activeItem.description && (
                  <p className="text-sm text-[#A5A5A5] leading-relaxed">{activeItem.description}</p>
                )}
              </div>

              <div className="mt-8 pt-5 border-t border-white/10">
                <a
                  href="#agendamento"
                  onClick={() => setLightboxIndex(null)}
                  className="w-full inline-flex items-center justify-center px-5 py-3 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold tracking-[0.14em] uppercase rounded-sm transition-colors"
                >
                  Solicitar Projeto Semelhante
                </a>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setLightboxIndex(
                lightboxIndex === filteredItems.length - 1 ? 0 : lightboxIndex + 1
              )
            }
            aria-label="Próximo trabalho"
            className="absolute right-3 sm:right-6 z-10 w-11 h-11 flex items-center justify-center bg-[#151515]/90 border border-white/20 hover:border-[#C9A34A] text-white hover:text-[#E2C47A] rounded-sm transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
}
