import { ArrowUpRight, Instagram, Mail, MessageCircle } from 'lucide-react';
import type { StudioConfig } from '../types/studio';

interface ContactAndFooterProps {
  config: StudioConfig;
  onNavigate: (path: string) => void;
}

export function ContactAndFooter({ config, onNavigate }: ContactAndFooterProps) {
  const whatsappUrl = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(
    'Olá, Luan! Conheci seu trabalho pelo site e gostaria de conversar sobre uma tatuagem e agendamento.'
  )}`;

  return (
    <>
      {/* 4.7 CONTATO */}
      <section id="contato" className="py-24 lg:py-28 bg-[#080808] border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
              Atendimento Direto
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Canais oficiais do estúdio.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a
              href={config.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-8 bg-[#151515] border border-white/10 hover:border-[#C9A34A] rounded-sm transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <Instagram className="w-6 h-6 text-[#C9A34A]" />
                  <ArrowUpRight className="w-4 h-4 text-[#A5A5A5] group-hover:text-[#E2C47A] transition-colors" />
                </div>
                <h3 className="font-display text-2xl text-white font-medium mb-2">Instagram</h3>
                <p className="text-sm text-[#A5A5A5]">@luanherculestatuador</p>
              </div>
              <span className="mt-6 text-xs tracking-[0.14em] uppercase text-[#E2C47A]">
                Acompanhar portfólio diário
              </span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-8 bg-[#151515] border border-white/10 hover:border-[#C9A34A] rounded-sm transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <MessageCircle className="w-6 h-6 text-[#C9A34A]" />
                  <ArrowUpRight className="w-4 h-4 text-[#A5A5A5] group-hover:text-[#E2C47A] transition-colors" />
                </div>
                <h3 className="font-display text-2xl text-white font-medium mb-2">WhatsApp</h3>
                <p className="font-mono-tabular text-sm text-[#A5A5A5]">
                  {config.whatsappDisplay}
                </p>
              </div>
              <span className="mt-6 text-xs tracking-[0.14em] uppercase text-[#E2C47A]">
                Iniciar conversa direta
              </span>
            </a>

            <a
              href={`mailto:${config.email}`}
              className="group p-8 bg-[#151515] border border-white/10 hover:border-[#C9A34A] rounded-sm transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <Mail className="w-6 h-6 text-[#C9A34A]" />
                  <ArrowUpRight className="w-4 h-4 text-[#A5A5A5] group-hover:text-[#E2C47A] transition-colors" />
                </div>
                <h3 className="font-display text-2xl text-white font-medium mb-2">E-mail</h3>
                <p className="text-sm text-[#A5A5A5] break-all">{config.email}</p>
              </div>
              <span className="mt-6 text-xs tracking-[0.14em] uppercase text-[#E2C47A]">
                Enviar mensagem formal
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* 4.8 RODAPÉ */}
      <footer className="bg-[#080808] pt-12 pb-24 sm:pb-16">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/10">
            <div>
              <p className="font-display text-xl tracking-[0.14em] text-white font-semibold">
                {config.studioName}
              </p>
              <p className="text-xs text-[#A5A5A5] mt-1">
                Uma história. Uma arte. Uma marca para a vida.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-[#A5A5A5]">
              <a
                href={config.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#E2C47A] transition-colors"
              >
                Instagram
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#E2C47A] transition-colors"
              >
                WhatsApp
              </a>
              <a href={`mailto:${config.email}`} className="hover:text-[#E2C47A] transition-colors">
                E-mail
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/privacidade')}
                className="hover:text-[#E2C47A] transition-colors cursor-pointer"
              >
                Política de Privacidade
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/termos')}
                className="hover:text-[#E2C47A] transition-colors cursor-pointer"
              >
                Termos de Uso
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="text-white/50 hover:text-[#E2C47A] transition-colors cursor-pointer"
              >
                Administração
              </button>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#A5A5A5]">
            <p>
              © {new Date().getFullYear()} {config.studioName}. Todos os direitos reservados.
            </p>
            <p>{config.email}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
