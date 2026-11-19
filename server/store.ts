import type {
  AdminLogEntry,
  AppointmentRequest,
  GalleryItem,
  MusicTrack,
  StoryChapter,
  StudioConfig,
  WorkspaceSyncState,
} from '../src/types/studio.js';

export const HERO_IMAGE_PATH = '/src/assets/images/hero_artist_studio_1795099827821.jpg';
export const CRAFT_IMAGE_PATH = '/src/assets/images/story_craft_detail_1795099827228.jpg';
export const REALISM_IMAGE_PATH = '/src/assets/images/portfolio_realism_work_1795099827090.jpg';
export const BLACKWORK_IMAGE_PATH = '/src/assets/images/portfolio_blackwork_fineline_1795099827072.jpg';
export const SANCTUARY_IMAGE_PATH = '/src/assets/images/studio_sanctuary_interior_1795099827191.jpg';

export interface StudioDatabase {
  config: StudioConfig;
  story: StoryChapter[];
  gallery: GalleryItem[];
  music: MusicTrack[];
  appointments: AppointmentRequest[];
  logs: AdminLogEntry[];
  workspace: WorkspaceSyncState;
}

const DEFAULT_STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'story-01',
    title: '01 · O primeiro traço',
    text: 'Espaço reservado para a 1ª fotografia original. Edite este capítulo no painel administrativo para registrar o início da trajetória no traço.',
    photoId: 'initial-01',
    photoUrl: HERO_IMAGE_PATH,
    order: 1,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-02',
    title: '02 · Estudos e cadernos',
    text: 'Espaço reservado para a 2ª fotografia original. Registre no painel administrativo a fase de estudos, desenho e experimentação artística.',
    photoId: 'initial-02',
    photoUrl: CRAFT_IMAGE_PATH,
    order: 2,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-03',
    title: '03 · Disciplina na bancada',
    text: 'Espaço reservado para a 3ª fotografia original. Compartilhe a rotina de preparação, técnica e respeito a cada instrumento.',
    photoId: 'initial-03',
    photoUrl: SANCTUARY_IMAGE_PATH,
    order: 3,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-04',
    title: '04 · O encontro com a pele',
    text: 'Espaço reservado para a 4ª fotografia original. Conte como os primeiros projetos autorais tomaram forma com propósito e entrega.',
    photoId: 'initial-04',
    photoUrl: REALISM_IMAGE_PATH,
    order: 4,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-05',
    title: '05 · Precisão e calma',
    text: 'Espaço reservado para a 5ª fotografia original. Descreva a atenção aos detalhes e o tempo dedicado a cada composição única.',
    photoId: 'initial-05',
    photoUrl: BLACKWORK_IMAGE_PATH,
    order: 5,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-06',
    title: '06 · Luz, sombra e contraste',
    text: 'Espaço reservado para a 6ª fotografia original. Destaque a evolução do olhar artístico entre o preto, o cinza e o equilíbrio visual.',
    photoId: 'initial-06',
    photoUrl: HERO_IMAGE_PATH,
    order: 6,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-07',
    title: '07 · Histórias que permanecem',
    text: 'Espaço reservado para a 7ª fotografia original. Relate a conexão genuína construída em cada conversa antes do primeiro risco.',
    photoId: 'initial-07',
    photoUrl: CRAFT_IMAGE_PATH,
    order: 7,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-08',
    title: '08 · Ambiente de criação',
    text: 'Espaço reservado para a 8ª fotografia original. Apresente os bastidores do estúdio e o cuidado absoluto com higiene e acolhimento.',
    photoId: 'initial-08',
    photoUrl: SANCTUARY_IMAGE_PATH,
    order: 8,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-09',
    title: '09 · Identidade no traço',
    text: 'Espaço reservado para a 9ª fotografia original. Registre os projetos que consolidaram a assinatura visual do Luan Hércules Tattoo Studio.',
    photoId: 'initial-09',
    photoUrl: REALISM_IMAGE_PATH,
    order: 9,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-10',
    title: '10 · Arte em constante movimento',
    text: 'Espaço reservado para a 10ª fotografia original. Compartilhe momentos marcantes do processo criativo e da dedicação diária.',
    photoId: 'initial-10',
    photoUrl: BLACKWORK_IMAGE_PATH,
    order: 10,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-11',
    title: '11 · Compromisso com cada pessoa',
    text: 'Espaço reservado para a 11ª fotografia original. Valorize a confiança depositada por cada cliente que escolhe eternizar uma memória.',
    photoId: 'initial-11',
    photoUrl: HERO_IMAGE_PATH,
    order: 11,
    published: true,
    isOriginalUploaded: false,
  },
  {
    id: 'story-12',
    title: '12 · O capítulo presente',
    text: 'Espaço reservado para a 12ª fotografia original. Encerre a narrativa visual com o momento atual do estúdio e os próximos passos.',
    photoId: 'initial-12',
    photoUrl: SANCTUARY_IMAGE_PATH,
    order: 12,
    published: true,
    isOriginalUploaded: false,
  },
];

const DEFAULT_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'gal-01',
    fileName: 'realismo-leao-antebraco.jpg',
    driveFileId: '',
    url: REALISM_IMAGE_PATH,
    caption: 'Realismo em Antebraço — Força & Detalhe',
    description: 'Composição em preto e cinza com transição suave de luz e textura minuciosa.',
    category: 'Realismo',
    order: 1,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'studio-initial',
  },
  {
    id: 'gal-02',
    fileName: 'blackwork-botanico.jpg',
    driveFileId: '',
    url: BLACKWORK_IMAGE_PATH,
    caption: 'Botânica em Blackwork & Fineline',
    description: 'Traços precisos desenhados para acompanhar a anatomia natural do braço.',
    category: 'Blackwork',
    order: 2,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'studio-initial',
  },
  {
    id: 'gal-03',
    fileName: 'preto-e-cinza-estudo.jpg',
    driveFileId: '',
    url: CRAFT_IMAGE_PATH,
    caption: 'Estudo Autoral — Preto e Cinza',
    description: 'Preparação anatômica e equilíbrio de contrastes antes da aplicação na pele.',
    category: 'Preto e cinza',
    order: 3,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'studio-initial',
  },
  {
    id: 'gal-04',
    fileName: 'fineline-detalhes.jpg',
    driveFileId: '',
    url: BLACKWORK_IMAGE_PATH,
    caption: 'Delicadeza em Fineline',
    description: 'Linhas limpas e delicadas projetadas para preservar legibilidade ao longo do tempo.',
    category: 'Fineline',
    order: 4,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'studio-initial',
  },
  {
    id: 'gal-05',
    fileName: 'arte-autoral-estudio.jpg',
    driveFileId: '',
    url: HERO_IMAGE_PATH,
    caption: 'Criação Exclusiva no Estúdio',
    description: 'Desenvolvimento individual de projeto sob medida para a história de cada cliente.',
    category: 'Tribal',
    order: 5,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'studio-initial',
  },
  {
    id: 'gal-06',
    fileName: 'espaco-atendimento.jpg',
    driveFileId: '',
    url: SANCTUARY_IMAGE_PATH,
    caption: 'Projetos Especiais — Estúdio Privado',
    description: 'Atendimento reservado com foco total em conforto, biossegurança e concentração artística.',
    category: 'Outros',
    order: 6,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'studio-initial',
  },
];

const DEFAULT_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'track-ambient-01',
    name: 'Atmosfera Instrumental — Estúdio (Padrão)',
    driveFileId: 'ambient-fallback',
    format: 'WAV',
    duration: '0:24',
    selected: true,
    volume: 0.45,
    active: true,
    streamUrl: '/api/media/ambient-fallback',
  },
];

export const studioDb: StudioDatabase = {
  config: {
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
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),
  },
  story: DEFAULT_STORY_CHAPTERS,
  gallery: DEFAULT_GALLERY_ITEMS,
  music: DEFAULT_MUSIC_TRACKS,
  appointments: [],
  logs: [
    {
      id: 'log-init',
      action: 'Sistema inicializado',
      details: 'Ambiente do Luan Hércules Tattoo Studio pronto para sincronização com Google Drive e Sheets.',
      actor: 'SISTEMA',
      timestamp: new Date().toISOString(),
    },
  ],
  workspace: {
    connected: false,
    rootFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
    folders: {},
    sheetId: process.env.GOOGLE_SHEET_ID || null,
    sheetUrl: process.env.GOOGLE_SHEET_ID
      ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`
      : null,
    lastSyncedAt: null,
    mode:
      process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID
        ? 'server-env'
        : 'local-ready',
  },
};

export function addLog(action: string, details: string, actor = 'ADMIN'): AdminLogEntry {
  const entry: AdminLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    details,
    actor,
    timestamp: new Date().toISOString(),
  };
  studioDb.logs.unshift(entry);
  if (studioDb.logs.length > 250) {
    studioDb.logs.length = 250;
  }
  return entry;
}

export function sanitizeText(input: unknown, maxLength = 1500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}
