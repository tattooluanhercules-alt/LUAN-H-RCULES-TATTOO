import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { submitLgpdDeletionRequest } from '../services/studioApi';
import type { StudioConfig } from '../types/studio';

interface LegalPageProps {
  mode: 'privacidade' | 'termos';
  config: StudioConfig;
  onNavigate: (path: string) => void;
}

export function LegalPage({ mode, config, onNavigate }: LegalPageProps) {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDeletionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setResultMsg(null);
    try {
      const res = await submitLgpdDeletionRequest(email, reason);
      setResultMsg(res.message);
      setEmail('');
      setReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao enviar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white py-16 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#C9A34A] hover:text-[#E2C47A] mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao estúdio</span>
        </button>

        {mode === 'privacidade' ? (
          <div className="space-y-8">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
                LGPD · Proteção de Dados
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-medium text-white mb-4">
                Política de Privacidade
              </h1>
              <p className="text-sm text-[#A5A5A5]">
                {config.studioName} · Contato do controlador: {config.email}
              </p>
            </div>

            <div className="space-y-6 text-sm sm:text-base text-[#A5A5A5] leading-relaxed bg-[#151515] border border-white/10 p-6 sm:p-8 rounded-sm">
              <section className="space-y-2">
                <h2 className="font-display text-2xl text-white">1. Dados coletados e finalidade</h2>
                <p>
                  Coletamos exclusivamente os dados fornecidos por você no formulário de solicitação
                  de agendamento (nome completo, WhatsApp, e-mail, data de nascimento opcional,
                  descrição da tatuagem, preferências de horário e imagem de referência opcional)
                  para análise artística, orçamento e retorno sobre disponibilidade de agenda.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-2xl text-white">2. Armazenamento e confidencialidade</h2>
                <p>
                  As solicitações são registradas de forma restrita para gerenciamento interno do
                  estúdio. Nenhuma informação pessoal de clientes é publicada ou compartilhada com
                  terceiros para fins comerciais.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-2xl text-white">3. Seus direitos (LGPD)</h2>
                <p>
                  Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode
                  solicitar confirmação de tratamento, correção ou exclusão definitiva de seus dados
                  pessoais a qualquer momento pelo e-mail {config.email} ou utilizando o formulário
                  abaixo.
                </p>
              </section>
            </div>

            {/* LGPD Deletion Form */}
            <form
              onSubmit={handleDeletionSubmit}
              className="bg-[#151515] border border-[#C9A34A]/30 p-6 sm:p-8 rounded-sm space-y-4"
            >
              <div className="flex items-center gap-2.5 text-[#E2C47A]">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-display text-2xl text-white">
                  Solicitar Exclusão de Dados Pessoais
                </h2>
              </div>

              {resultMsg && (
                <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-sm rounded-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{resultMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-4 bg-red-950/50 border border-red-500/40 text-red-200 text-sm rounded-sm">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                  E-mail cadastrado na solicitação *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.12em] text-[#A5A5A5] mb-2">
                  Observação (opcional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Solicito a remoção dos meus dados de agendamento"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] text-xs font-semibold uppercase tracking-[0.14em] rounded-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Solicitar Exclusão'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
                Condições Gerais
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-medium text-white mb-4">
                Termos de Uso
              </h1>
              <p className="text-sm text-[#A5A5A5]">{config.studioName}</p>
            </div>

            <div className="space-y-6 text-sm sm:text-base text-[#A5A5A5] leading-relaxed bg-[#151515] border border-white/10 p-6 sm:p-8 rounded-sm">
              <section className="space-y-2">
                <h2 className="font-display text-2xl text-white">1. Propriedade intelectual e fotografias</h2>
                <p>
                  Todas as fotografias, projetos artísticos, textos e elementos visuais exibidos
                  neste site pertencem ao {config.studioName} e não podem ser reproduzidos,
                  modificados ou utilizados comercialmente sem autorização prévia por escrito.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-2xl text-white">2. Solicitações de agendamento</h2>
                <p>
                  O envio do formulário de agendamento constitui uma solicitação de orçamento e
                  disponibilidade. Nenhuma sessão é considerada confirmada antes da análise e
                  aprovação expressa do tatuador Luan Hércules pelos canais oficiais ({config.whatsappDisplay}{' '}
                  ou {config.email}).
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-2xl text-white">3. Idade mínima e atendimento</h2>
                <p>
                  A realização de tatuagens segue rigorosamente a legislação vigente e os protocolos
                  de biossegurança do estúdio.
                </p>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
