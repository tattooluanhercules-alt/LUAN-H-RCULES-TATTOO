import { useCallback, useEffect, useState } from 'react';
import { fetchPublicStudio } from '../services/studioApi';
import type { PublicStudioPayload } from '../types/studio';

const FALLBACK_CONFIG: PublicStudioPayload['config'] = {
  studioName: 'LUAN HÉRCULES TATTOO STUDIO',
  artistName: 'Luan Hércules',
  instagramUrl: 'https://www.instagram.com/luanherculestatuador/',
  whatsappNumber: '558299534698',
  whatsappDisplay: '+55 82 9953-4698',
  email: 'luanherculestattoo@gmail.com',
  heroHeadline: 'Uma história. Uma arte. Uma marca para a vida.',
  heroSubtitle: 'Transformando ideias, sentimentos e histórias em arte na pele.',
  storyTitle: 'MINHA HISTÓRIA — TRAÇO POR TRAÇO',
  storyClosingQuote:
    'Minha história ainda está sendo escrita. Cada traço carrega dedicação, cada projeto conta uma história e cada conquista é motivo de gratidão. O melhor ainda está por vir.',
  aboutTitle: 'ARTE, PROPÓSITO E DEDICAÇÃO.',
  aboutParagraphs: [
    'No Luan Hércules Tattoo Studio, cada tatuagem nasce de uma escuta atenta. Mais do que aplicar tinta sobre a pele, o compromisso é traduzir significados reais em composições visuais equilibradas, respeitando a anatomia e o tempo de cada projeto.',
    'Cada sessão é conduzida em ambiente reservado, com planejamento exclusivo, rigor em biossegurança e cuidado minucioso em cada etapa — do primeiro esboço à orientação de cicatrização.',
  ],
  playerEnabled: true,
  defaultVolume: 0.45,
  galleryColumns: 3,
  maxUploadMb: 25,
};

export function useStudioData() {
  const [data, setData] = useState<PublicStudioPayload>({
    config: FALLBACK_CONFIG,
    story: [],
    gallery: [],
    music: [],
    activeTrack: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const payload = await fetchPublicStudio();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do estúdio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
