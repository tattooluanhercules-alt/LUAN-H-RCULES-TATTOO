import type {
  AdminLogEntry,
  AdminSessionStatus,
  AppointmentRequest,
  AppointmentStatus,
  GalleryItem,
  MusicTrack,
  PublicStudioPayload,
  StoryChapter,
  StudioConfig,
  TattooCategory,
  WorkspaceSyncState,
} from '../types/studio';

let currentCsrfToken = '';
let currentSessionToken = '';

export function setCsrfToken(token: string) {
  currentCsrfToken = token;
}

export function setSessionToken(token: string) {
  currentSessionToken = token;
}

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }
  if (currentSessionToken) {
    headers['X-Admin-Session'] = currentSessionToken;
  }
  return headers;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição (${res.status}).`);
  }
  return data;
}

export async function fetchPublicStudio(): Promise<PublicStudioPayload> {
  const res = await fetch('/api/public/studio');
  return parseJsonOrThrow<PublicStudioPayload>(res);
}

export interface CreateAppointmentInput {
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
  referenceBase64?: string;
  lgpdConsent: boolean;
}

export async function submitAppointmentRequest(input: CreateAppointmentInput) {
  const res = await fetch('/api/appointments', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<{
    ok: boolean;
    appointmentId: string;
    syncedToSheet: boolean;
    message: string;
  }>(res);
}

export async function submitLgpdDeletionRequest(email: string, reason: string) {
  const res = await fetch('/api/lgpd/deletion-request', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email, reason }),
  });
  return parseJsonOrThrow<{ ok: boolean; removedCount: number; message: string }>(res);
}

// -----------------------------------------------------------------------------
// ADMIN AUTHENTICATION
// -----------------------------------------------------------------------------
export async function fetchAdminSession(): Promise<AdminSessionStatus> {
  const res = await fetch('/api/admin/session', {
    credentials: 'include',
    headers: currentSessionToken ? { 'X-Admin-Session': currentSessionToken } : undefined,
  });
  const data = await parseJsonOrThrow<AdminSessionStatus>(res);
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  return data;
}

export async function adminLogin(username: string, password: string): Promise<AdminSessionStatus> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonOrThrow<AdminSessionStatus & { sessionToken?: string }>(res);
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  if (data.sessionToken) setSessionToken(data.sessionToken);
  return data;
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  setCsrfToken('');
  setSessionToken('');
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseJsonOrThrow<{
    ok: boolean;
    mustChangePassword: boolean;
    passwordStoredInAppData: boolean;
  }>(res);
}

// -----------------------------------------------------------------------------
// ADMIN DASHBOARD & GOOGLE WORKSPACE
// -----------------------------------------------------------------------------
export interface AdminDashboardPayload {
  config: StudioConfig;
  story: StoryChapter[];
  gallery: GalleryItem[];
  music: MusicTrack[];
  appointments: AppointmentRequest[];
  logs: AdminLogEntry[];
  workspace: WorkspaceSyncState;
  stats: {
    totalPhotos: number;
    publishedPhotos: number;
    storyUploadedCount: number;
    totalMusic: number;
    totalAppointments: number;
    pendingAppointments: number;
  };
}

export async function fetchAdminDashboard(): Promise<AdminDashboardPayload> {
  const res = await fetch('/api/admin/dashboard', {
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<AdminDashboardPayload>(res);
}

export interface GoogleConnectionStatus {
  connected: boolean;
  status: 'Conectado' | 'Desconectado';
  email: string | null;
  configured: boolean;
  missingEnvVars: string[];
  adminEmailConfigured: boolean;
  redirectUri: string;
  envStatus?: Record<string, boolean>;
  rootFolderId: string | null;
  folders: Record<string, string | undefined>;
  sheetId: string | null;
  sheetUrl: string | null;
  lastSyncedAt: string | null;
}

export async function fetchGoogleStatus(): Promise<GoogleConnectionStatus> {
  const res = await fetch('/api/google/status', {
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<GoogleConnectionStatus>(res);
}

export async function fetchGoogleAuthUrl(): Promise<{ ok: boolean; authUrl: string }> {
  const res = await fetch('/api/google/auth?format=json', {
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{ ok: boolean; authUrl: string }>(res);
}

export async function disconnectGoogleAccount() {
  const res = await fetch('/api/google/disconnect', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{ ok: boolean; connected: boolean; status: 'Desconectado' }>(res);
}

export async function createGoogleDriveFolders() {
  const res = await fetch('/api/google/drive/folders', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{
    ok: boolean;
    rootFolderId: string;
    folders: Record<string, string>;
  }>(res);
}

export async function syncGoogleSheets() {
  const res = await fetch('/api/google/sheets', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{
    ok: boolean;
    rootFolderId: string;
    folders: Record<string, string>;
    sheetId: string;
    sheetUrl: string;
  }>(res);
}

export async function initializeGoogleWorkspace() {
  const res = await fetch('/api/admin/workspace/init', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{
    ok: boolean;
    workspace: WorkspaceSyncState;
    passwordStoredInAppData: boolean;
    mustChangePassword: boolean;
  }>(res);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Erro ao ler arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

export interface UploadAssetOptions {
  target: 'portfolio' | 'historia' | 'musica';
  file: File;
  caption?: string;
  description?: string;
  category?: TattooCategory;
  storyId?: string;
  duration?: string;
}

/**
 * Smart upload: files > 3.5 MB use direct resumable upload to Google Drive
 * (avoiding Vercel's 4.5 MB serverless request payload limit); smaller files
 * upload cleanly through /api/admin/upload.
 */
export async function uploadStudioAsset(opts: UploadAssetOptions) {
  const { target, file, caption, description, category, storyId, duration } = opts;

  if (file.size > 3.5 * 1024 * 1024) {
    const sessionRes = await fetch('/api/admin/drive/resumable-session', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(),
      body: JSON.stringify({
        target,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }),
    });
    const { uploadUrl } = await parseJsonOrThrow<{ uploadUrl: string }>(sessionRes);

    const driveRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!driveRes.ok) {
      throw new Error('Falha no envio direto do arquivo para o Google Drive.');
    }
    const driveData = (await driveRes.json()) as { id: string };

    const finRes = await fetch('/api/admin/drive/finalize-upload', {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(),
      body: JSON.stringify({
        target,
        driveFileId: driveData.id,
        fileName: file.name,
        mimeType: file.type,
        caption,
        description,
        category,
        storyId,
        duration,
      }),
    });
    return parseJsonOrThrow<{ ok: boolean; item: unknown }>(finRes);
  }

  const base64Data = await fileToBase64(file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({
      target,
      fileName: file.name,
      mimeType: file.type,
      base64Data,
      caption,
      description,
      category,
      storyId,
      duration,
    }),
  });
  return parseJsonOrThrow<{ ok: boolean; item: unknown }>(res);
}

export async function updateGalleryItem(
  id: string,
  updates: Partial<Pick<GalleryItem, 'caption' | 'description' | 'category' | 'order' | 'published'>>
) {
  const res = await fetch(`/api/admin/gallery/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify(updates),
  });
  return parseJsonOrThrow<{ ok: boolean; item: GalleryItem }>(res);
}

export async function deleteGalleryItem(id: string) {
  const res = await fetch(`/api/admin/gallery/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{ ok: boolean }>(res);
}

export async function updateStoryChapter(
  id: string,
  updates: Partial<Pick<StoryChapter, 'title' | 'text' | 'order' | 'published'>>
) {
  const res = await fetch(`/api/admin/story/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify(updates),
  });
  return parseJsonOrThrow<{ ok: boolean; chapter: StoryChapter }>(res);
}

export async function reorderStoryChapters(orderedIds: string[]) {
  const res = await fetch('/api/admin/story/reorder', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({ orderedIds }),
  });
  return parseJsonOrThrow<{ ok: boolean; story: StoryChapter[] }>(res);
}

export async function updateMusicTrack(
  id: string,
  updates: Partial<Pick<MusicTrack, 'name' | 'volume' | 'active' | 'selected'>>
) {
  const res = await fetch(`/api/admin/music/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify(updates),
  });
  return parseJsonOrThrow<{ ok: boolean; track: MusicTrack; music: MusicTrack[] }>(res);
}

export async function deleteMusicTrack(id: string) {
  const res = await fetch(`/api/admin/music/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{ ok: boolean; music: MusicTrack[] }>(res);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const res = await fetch(`/api/admin/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify({ status }),
  });
  return parseJsonOrThrow<{ ok: boolean; appointment: AppointmentRequest }>(res);
}

export async function deleteAppointment(id: string) {
  const res = await fetch(`/api/admin/appointments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildHeaders(),
  });
  return parseJsonOrThrow<{ ok: boolean }>(res);
}

export async function updateStudioConfig(updates: Partial<StudioConfig>) {
  const res = await fetch('/api/admin/config', {
    method: 'PUT',
    credentials: 'include',
    headers: buildHeaders(),
    body: JSON.stringify(updates),
  });
  return parseJsonOrThrow<{ ok: boolean; config: StudioConfig }>(res);
}
