import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string, hash?: string) => void;
}

const NAV_ITEMS = [
  { label: 'História', hash: '#historia' },
  { label: 'Portfólio', hash: '#portfolio' },
  { label: 'Sobre', hash: '#sobre' },
  { label: 'Agendamento', hash: '#agendamento' },
  { label: 'Contato', hash: '#contato' },
];

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (hash: string) => {
    setMobileOpen(false);
    if (currentPath !== '/') {
      onNavigate('/', hash);
      return;
    }
    const el = document.querySelector(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#080808]/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single line, no clutter) */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setMobileOpen(false);
            onNavigate('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-display text-xl sm:text-2xl font-semibold tracking-[0.14em] text-white hover:text-[#E2C47A] transition-colors whitespace-nowrap shrink-0"
        >
          LUAN HÉRCULES
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A5A5A5]">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.hash}
              href={item.hash}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(item.hash);
              }}
              className="hover:text-white transition-colors relative py-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[1px] after:bg-[#C9A34A] hover:after:w-full after:transition-all after:duration-200 whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('#agendamento')}
            className="px-5 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] transition-colors rounded-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            Agendar
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            className="md:hidden p-2 text-white/80 hover:text-[#E2C47A] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-[#080808] border-b border-white/10 px-6 py-6 space-y-4">
          <div className="flex flex-col space-y-3">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.hash}
                href={item.hash}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.hash);
                }}
                className="text-base font-medium text-white/90 hover:text-[#E2C47A] py-2 border-b border-white/5 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
