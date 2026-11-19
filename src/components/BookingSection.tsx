import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, MessageCircle, Upload, X } from 'lucide-react';
import { submitAppointmentRequest } from '../services/studioApi';
import type { StudioConfig, TattooCategory } from '../types/studio';
import { TATTOO_CATEGORIES } from '../types/studio';

interface BookingSectionProps {
  config: StudioConfig;
  onNavigate: (path: string) => void;
}

export function BookingSection({ config, onNavigate }: BookingSectionProps) {
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [serviceType, setServiceType] = useState<TattooCategory>('Realismo');
  const [bodyRegion, setBodyRegion] = useState('');
  const [approximateSize, setApproximateSize] = useState('');
  const [description, setDescription] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [desiredTime, setDesiredTime] = useState('');
  const [referenceBase64, setReferenceBase64] = useState<string>('');
  const [referenceFileName, setReferenceFileName] = useState<string>('');
  const [lgpdConsent, setLgpdConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    appointmentId: string;
    message: string;
    whatsappUrl: string;
  } | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Selecione uma imagem de referência válida (JPG, PNG ou WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A imagem de referência deve ter no máximo 8 MB.');
      return;
    }
    setError(null);
    setReferenceFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setReferenceBase64(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await submitAppointmentRequest({
        fullName,
        whatsapp,
        email,
        birthDate: birthDate || undefined,
        serviceType,
        bodyRegion,
        approximateSize,
        description,
        desiredDate,
        desiredTime,
        referenceBase64: referenceBase64 || undefined,
        lgpdConsent,
      });

      const msg = [
        `Olá, Luan! Acabei de enviar uma solicitação de agendamento pelo site (Protocolo ${res.appointmentId}).`,
        `Nome: ${fullName}`,
        `Estilo: ${serviceType}`,
        `Região: ${bodyRegion} · Tamanho: ${approximateSize || 'A definir'}`,
        desiredDate ? `Preferência de data: ${desiredDate} ${desiredTime || ''}` : '',
        `Ideia: ${description}`,
      ]
        .filter(Boolean)
        .join('\n');

      const whatsappUrl = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(msg)}`;

      setSubmittedResult({
        appointmentId: res.appointmentId,
        message: res.message,
        whatsappUrl,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao enviar solicitação. Verifique os campos e tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedResult(null);
    setFullName('');
    setWhatsapp('');
    setEmail('');
    setBirthDate('');
    setBodyRegion('');
    setApproximateSize('');
    setDescription('');
    setDesiredDate('');
    setDesiredTime('');
    setReferenceBase64('');
    setReferenceFileName('');
    setLgpdConsent(false);
  };

  return (
    <section id="agendamento" className="py-24 lg:py-32 bg-[#080808] border-b border-white/10">
      <div className="max-w-[1000px] mx-auto px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs tracking-[0.25em] uppercase text-[#C9A34A] mb-3">
            Agendamento & Orçamento
          </p>
          <h2
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight mb-4"
            style={{ textWrap: 'balance' }}
          >
            Solicite a criação do seu projeto.
          </h2>
          <p className="text-sm sm:text-base text-[#A5A5A5] leading-relaxed">
            Preencha os detalhes da sua ideia abaixo. Todas as solicitações passam pela análise
            individual de Luan Hércules antes da confirmação de data e horário.
          </p>
        </div>

        {submittedResult ? (
          <div className="p-8 sm:p-12 bg-[#151515] border border-[#C9A34A]/50 rounded-sm text-center">
            <CheckCircle2 className="w-12 h-12 text-[#C9A34A] mx-auto mb-5" />
            <p className="font-mono-tabular text-xs tracking-[0.2em] uppercase text-[#E2C47A] mb-2">
              Protocolo {submittedResult.appointmentId}
            </p>
            <h3 className="font-display text-3xl text-white font-medium mb-4">
              Solicitação recebida para análise.
            </h3>
            <p className="text-sm sm:text-base text-[#A5A5A5] max-w-xl mx-auto leading-relaxed mb-8">
              {submittedResult.message} Seu horário ainda não está confirmado automaticamente; o
              atendimento e a definição final acontecem após aprovação do tatuador.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={submittedResult.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] transition-colors text-xs sm:text-sm font-semibold tracking-[0.12em] uppercase rounded-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Continuar pelo WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-4 border border-white/15 hover:border-[#C9A34A] text-white/80 hover:text-white text-xs sm:text-sm font-medium tracking-[0.1em] uppercase rounded-sm transition-colors cursor-pointer"
              >
                Nova Solicitação
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-10 bg-[#151515] border border-white/10 rounded-sm space-y-6"
          >
            {error && (
              <div
                role="alert"
                className="p-4 bg-red-950/50 border border-red-500/40 text-red-200 text-sm rounded-sm"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  Nome completo *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  WhatsApp (com DDD) *
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(82) 99999-9999"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  Data de nascimento (opcional)
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  Tipo de tatuagem *
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as TattooCategory)}
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                >
                  {TATTOO_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  Região do corpo *
                </label>
                <input
                  type="text"
                  required
                  value={bodyRegion}
                  onChange={(e) => setBodyRegion(e.target.value)}
                  placeholder="Ex: Antebraço interno, ombro, costas"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                  Tamanho aproximado
                </label>
                <input
                  type="text"
                  value={approximateSize}
                  onChange={(e) => setApproximateSize(e.target.value)}
                  placeholder="Ex: 15 cm"
                  className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                    Data desejada
                  </label>
                  <input
                    type="date"
                    value={desiredDate}
                    onChange={(e) => setDesiredDate(e.target.value)}
                    className="w-full px-3 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                    Horário desejado
                  </label>
                  <input
                    type="time"
                    value={desiredTime}
                    onChange={(e) => setDesiredTime(e.target.value)}
                    className="w-full px-3 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                Descrição da ideia *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Conte os elementos, significados ou detalhes que você imagina para a tatuagem..."
                className="w-full px-4 py-3 bg-[#080808] border border-white/15 focus:border-[#C9A34A] outline-none text-white text-sm rounded-sm transition-colors resize-y"
              />
            </div>

            {/* Reference Image Upload */}
            <div>
              <label className="block text-xs tracking-[0.12em] uppercase text-[#A5A5A5] mb-2">
                Imagem de referência (opcional · máx. 8 MB)
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2.5 px-4 py-3 bg-[#080808] border border-white/15 hover:border-[#C9A34A] text-sm text-white/90 rounded-sm cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-[#C9A34A]" />
                  <span>{referenceFileName || 'Selecionar imagem'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {referenceBase64 && (
                  <div className="flex items-center gap-3">
                    <img
                      src={referenceBase64}
                      alt="Prévia da referência"
                      className="w-12 h-12 object-cover border border-[#C9A34A]/50 rounded-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceBase64('');
                        setReferenceFileName('');
                      }}
                      className="text-xs text-[#A5A5A5] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Remover
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* LGPD Consent */}
            <div className="pt-2 border-t border-white/10">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lgpdConsent}
                  onChange={(e) => setLgpdConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#C9A34A] cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-[#A5A5A5] leading-relaxed">
                  Concordo com o tratamento dos meus dados pessoais exclusivamente para análise de
                  orçamento e agendamento, em conformidade com a LGPD e a{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/privacidade')}
                    className="text-[#E2C47A] underline hover:text-white cursor-pointer"
                  >
                    Política de Privacidade
                  </button>{' '}
                  e os{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/termos')}
                    className="text-[#E2C47A] underline hover:text-white cursor-pointer"
                  >
                    Termos de Uso
                  </button>
                  .
                </span>
              </label>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-[#A5A5A5]">
                O envio registra sua solicitação para avaliação do tatuador.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-4 bg-[#C9A34A] text-[#080808] hover:bg-[#E2C47A] disabled:opacity-60 transition-colors text-xs sm:text-sm font-semibold tracking-[0.14em] uppercase rounded-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                {submitting ? 'Enviando solicitação...' : 'Enviar Solicitação de Agendamento'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
