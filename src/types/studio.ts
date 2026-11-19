export type TattooCategory =
  | 'Realismo'
  | 'Preto e cinza'
  | 'Tribal'
  | 'Blackwork'
  | 'Fineline'
  | 'Outros';

export const TATTOO_CATEGORIES: TattooCategory[] = [
  'Realismo',
  'Preto e cinza',
  'Tribal',
  'Blackwork',
  'Fineline',
  'Outros',
];

export type AppointmentStatus =
  | 'Pendente'
  | 'Em análise'
  | 'Atendido'
  | 'Confirmado'
  | 'Cancelado';

export interface GalleryItem {
  id: string;
  fileName: string;
  driveFileId: string;
  url: string;
  caption: string;
  description: string;
  category: TattooCategory;
  order: number;
  published: boolean;
  createdAt: string;
  source: 'drive' | 'studio-initial';
}

export interface StoryChapter {
  id: string;
  title: string;
  text: string;
  photoId: string;
  photoUrl: string;
  order: number;
  published: boolean;
  isOriginalUploaded: boolean;
}

export interface MusicTrack {
  id: string;
  name: string;
  driveFileId: string;
  format: string;
  duration: string;
  selected: boolean;
  volume: number;
  active: boolean;
  streamUrl: string;
}

export interface AppointmentRequest {
  id: string;
  fullName: string;
  whatsapp: string;
  email: string;
  birthDate?: string;
  serviceType: TattooCategory;
  bodyRegion: string;
  approximateSize: string;
  description: string;
  desiredDate: string;
  desiredTime: string;
  referenceImageUrl?: string;
  referenceDriveFileId?: string;
  lgpdConsent: boolean;
  status: AppointmentStatus;
  createdAt: string;
}

export interface StudioConfig {
  studioName: string;
  artistName: string;
  instagramUrl: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  email: string;
  heroHeadline: string;
  heroSubtitle: string;
  storyTitle: string;
  storyClosingQuote: string;
  aboutTitle: string;
  aboutParagraphs: string[];
  playerEnabled: boolean;
  defaultVolume: number;
  galleryColumns: 3 | 4;
  maxUploadMb: number;
}

export interface AdminLogEntry {
  id: string;
  action: string;
  details: string;
  actor: string;
  timestamp: string;
}

export interface WorkspaceSyncState {
  connected: boolean;
  rootFolderId: string | null;
  folders: {
    historia?: string;
    portfolio?: string;
    bastidores?: string;
    identidadeVisual?: string;
    trilhaSonora?: string;
  };
  sheetId: string | null;
  sheetUrl: string | null;
  lastSyncedAt: string | null;
  mode: 'oauth-session' | 'server-env' | 'local-ready';
}

export interface PublicStudioPayload {
  config: StudioConfig;
  story: StoryChapter[];
  gallery: GalleryItem[];
  music: MusicTrack[];
  activeTrack: MusicTrack | null;
}

export interface AdminSessionStatus {
  authenticated: boolean;
  username: string | null;
  mustChangePassword: boolean;
  csrfToken: string;
  passwordStoredInAppData: boolean;
}
