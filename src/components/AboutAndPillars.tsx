import type { StudioConfig } from '../types/studio';
import { ResilientImage } from './ResilientImage';

interface AboutAndPillarsProps {
  config: StudioConfig;
  sanctuaryImageUrl: string;
}

const DIFFERENTIALS = [
  {
    num: '01',
    title: 'Atendimento personalizado',
    description:
      'Escuta individual desde o primeiro contato para entender referências, significado pessoal e expectativas para a sessão.',
  },
  {
    num: '02',
    title: 'Projetos exclusivos',
    description:
      'Cada composição é pensada sob medida para a anatomia e história de quem vai carregá-la na pele.',
  },
  {
    num: '03',
    title: 'Atenção aos detalhes',
    description:
      'Cuidado rigoroso com proporção, leitura do traço, contraste e acabamento em cada etapa da execução.',
  },
  {
    num: '04',
    title: 'Higiene e segurança',
    description:
      'Ambiente controlado, materiais descartáveis de uso único e protocolos rígidos de esterilização e biossegurança.',
  },
  {
    num: '05',
    title: 'Compromisso com o cliente',
    description:
      'Transparência em prazos, orientações claras de pré-sessão e acompanhamento atento durante toda a cicatrização.',
  },
  {
    num: '06',
    title: 'Dedicação artística',
    description:
      'Entrega integral em cada trabalho, respeitando o tempo necessário para alcançar o melhor resultado possível.',
  },
];

export function AboutAndPillars({ config, sanctuaryImageUrl }: AboutAndPillarsProps) {
  return (
    <>
      {/* 4.4 SOBRE O TATUADOR */}
      <section id="sobre" className="py-24 lg:py-32 bg-[#080808] border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
            <div className="lg:col-span-6 relative aspect-[4/3] lg:aspect-auto lg:min-h-[440px] bg-[#151515] border border-white/10 rounded-sm overflow-hidden">
              <ResilientImage
                src={sanctuaryImageUrl}
                alt="Interior do estúdio Luan Hércules Tattoo Studio"
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#080808]/60 via-transparent to-transparent pointer-events-none"
                aria-hidden="true"
              />
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
                Sobre o Tatuador
              </p>
              <h2
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight mb-6"
                style={{ textWrap: 'balance' }}
              >
                {config.aboutTitle}
              </h2>

              <div className="w-16 h-[1px] bg-[#C9A34A]/60 mb-7" />

              <div className="space-y-5 text-[#A5A5A5] text-base sm:text-[17px] leading-relaxed">
                {config.aboutParagraphs.map((para, index) => (
                  <p key={index}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4.5 DIFERENCIAIS */}
      <section id="diferenciais" className="py-24 lg:py-28 bg-[#080808] border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
              Padrão de Estúdio
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Pilares que sustentam cada sessão.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DIFFERENTIALS.map((item) => (
              <div
                key={item.num}
                className="p-7 bg-[#151515] border border-white/10 hover:border-[#C9A34A]/50 transition-colors rounded-sm"
              >
                <span className="font-mono-tabular text-xs tracking-[0.2em] text-[#C9A34A] block mb-4">
                  {item.num}
                </span>
                <h3 className="font-display text-2xl text-white font-medium mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-[#A5A5A5] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
