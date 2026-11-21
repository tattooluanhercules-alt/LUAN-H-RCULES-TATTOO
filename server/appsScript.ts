import fs from 'node:fs';
import path from 'node:path';
import type { AppointmentRequest, GalleryItem, MusicTrack, StoryChapter, TattooCategory } from '../src/types/studio.js';
import { APPS_SCRIPT_CODE_GS } from './appsScriptSource.js';
import { addLog, studioDb } from './store.js';

const ALLOWED_APPS_SCRIPT_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

let appsScriptVerifiedConnected = false;
let appsScriptOwnerEmail: string | null = null;

export function getAppsScriptConfig() {
  const url = (process.env.APPS_SCRIPT_URL || '').trim();
  const secret = (process.env.APPS_SCRIPT_SECRET || '').trim();
  return {
    url,
    secret,
    hasUrl: Boolean(url),
    hasSecret: Boolean(secret),
    configured: Boolean(url && secret),
  };
}

export function isAppsScriptConfigured(): boolean {
  return getAppsScriptConfig().configured;
}

export function getAppsScriptStatusSummary() {
  const cfg = getAppsScriptConfig();
  return {
    configured: cfg.configured,
    connected: cfg.configured && appsScriptVerifiedConnected,
    hasUrl: cfg.hasUrl,
    hasSecret: cfg.hasSecret,
    email: appsScriptOwnerEmail,
    rootFolderId: studioDb.workspace.rootFolderId,
    folders: studioDb.workspace.folders,
    sheetId: studioDb.workspace.sheetId,
    sheetUrl: studioDb.workspace.sheetUrl,
  };
}

export function validateAppsScriptUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('APPS_SCRIPT_URL inválida.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('APPS_SCRIPT_URL deve usar HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('APPS_SCRIPT_URL não pode conter credenciais embutidas.');
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_APPS_SCRIPT_HOSTS.has(host)) {
    throw new Error('APPS_SCRIPT_URL deve pertencer ao domínio script.google.com.');
  }
  if (!parsed.pathname.startsWith('/macros/')) {
    throw new Error('APPS_SCRIPT_URL deve apontar para uma implantação Web App (/macros/...).');
  }
  return parsed;
}

function validateRedirectHost(locationUrl: string): string {
  const parsed = new URL(locationUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Redirecionamento não HTTPS bloqueado.');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'accounts.google.com') {
    throw new Error(
      'O Google Apps Script redirecionou para login (accounts.google.com). No editor do Apps Script, vá em Implantar -> Gerenciar implantações, defina "Executar como: Eu" e "Quem tem acesso: Qualquer pessoa" e crie uma nova versão.'
    );
  }
  if (!ALLOWED_APPS_SCRIPT_HOSTS.has(host)) {
    throw new Error('Host de redirecionamento não autorizado fora do Google Apps Script.');
  }
  return parsed.toString();
}

export async function callAppsScript<T = Record<string, unknown>>(
  action: string,
  extraPayload: Record<string, unknown> = {}
): Promise<T & { ok: boolean; error?: string }> {
  const cfg = getAppsScriptConfig();
  if (!cfg.configured) {
    throw new Error('Variáveis APPS_SCRIPT_URL e APPS_SCRIPT_SECRET não configuradas no servidor.');
  }

  const targetUrl = validateAppsScriptUrl(cfg.url).toString();
  const payload = JSON.stringify({
    action,
    secret: cfg.secret,
    ...extraPayload,
  });

  // Follow Google Apps Script 302 redirects manually with strict host allowlist validation (max 4 hops)
  let currentUrl = targetUrl;
  let method: 'POST' | 'GET' = 'POST';
  let body: string | undefined = payload;

  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(currentUrl, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body,
      redirect: 'manual',
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('Google Apps Script retornou redirecionamento sem destino.');
      }
      currentUrl = validateRedirectHost(location);
      // Google Apps Script 302 echo redirects switch POST -> GET to retrieve JSON output
      method = 'GET';
      body = undefined;
      continue;
    }

    const rawText = await res.text();
    let parsed: (T & { ok: boolean; error?: string }) | null = null;
    try {
      parsed = JSON.parse(rawText) as T & { ok: boolean; error?: string };
    } catch {
      throw new Error(
        `Resposta inválida do Google Apps Script (HTTP ${res.status}). Verifique se todo o Code.gs foi salvo, se setupStudioWorkspace foi executado e se a implantação está publicada como "Qualquer pessoa".`
      );
    }

    if (!res.ok || !parsed?.ok) {
      throw new Error(parsed?.error || `Falha na execução do Google Apps Script (HTTP ${res.status}).`);
    }

    appsScriptVerifiedConnected = true;
    return parsed;
  }

  throw new Error('Excesso de redirecionamentos ao comunicar com o Google Apps Script.');
}

export function getAppsScriptSourceCode(): string {
  const filePath = path.resolve(process.cwd(), 'scripts/google-apps-script/Code.gs');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return APPS_SCRIPT_CODE_GS;
}

export async function ensureAppsScriptWorkspace() {
  const res = await callAppsScript<{
    email?: string;
    rootFolderId: string;
    folders: Record<string, string>;
    sheetId: string;
    sheetUrl: string;
  }>('ensureWorkspace');

  if (res.email) appsScriptOwnerEmail = res.email;
  studioDb.workspace.rootFolderId = res.rootFolderId;
  studioDb.workspace.folders = res.folders;
  studioDb.workspace.sheetId = res.sheetId;
  studioDb.workspace.sheetUrl = res.sheetUrl;
  studioDb.workspace.connected = true;
  studioDb.workspace.mode = 'server-env';
  studioDb.workspace.lastSyncedAt = new Date().toISOString();

  return res;
}

export async function syncAllViaAppsScript(): Promise<{
  rootFolderId: string;
  folders: Record<string, string>;
  sheetId: string;
  sheetUrl: string;
}> {
  const now = new Date().toISOString();
  const payload = {
    GALERIA: studioDb.gallery.map((g) => [
      g.id,
      g.fileName,
      g.driveFileId,
      g.url,
      g.caption,
      g.description,
      g.category,
      g.order,
      g.published ? 'SIM' : 'NÃO',
      g.createdAt,
    ]),
    HISTORIA: studioDb.story.map((s) => [
      s.id,
      s.title,
      s.text,
      s.photoId,
      s.order,
      s.published ? 'SIM' : 'NÃO',
    ]),
    MUSICA: studioDb.music.map((m) => [
      m.id,
      m.name,
      m.driveFileId,
      m.format,
      m.duration,
      m.selected ? 'SIM' : 'NÃO',
      m.volume,
      m.active ? 'SIM' : 'NÃO',
    ]),
    AGENDAMENTOS: studioDb.appointments.map((a) => [
      a.id,
      a.fullName,
      a.whatsapp,
      a.email,
      `${a.serviceType} (${a.bodyRegion} / ${a.approximateSize})`,
      a.desiredDate,
      a.desiredTime,
      a.description,
      a.status,
      a.createdAt,
    ]),
    CONFIGURACOES: Object.entries(studioDb.config).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
      now,
    ]),
    LOG: studioDb.logs.slice(0, 100).map((l) => [l.id, l.action, l.details, l.actor, l.timestamp]),
  };

  const res = await callAppsScript<{
    email?: string;
    rootFolderId: string;
    folders: Record<string, string>;
    sheetId: string;
    sheetUrl: string;
  }>('syncAll', { payload });

  if (res.email) appsScriptOwnerEmail = res.email;
  studioDb.workspace.rootFolderId = res.rootFolderId;
  studioDb.workspace.folders = res.folders;
  studioDb.workspace.sheetId = res.sheetId;
  studioDb.workspace.sheetUrl = res.sheetUrl;
  studioDb.workspace.connected = true;
  studioDb.workspace.mode = 'server-env';
  studioDb.workspace.lastSyncedAt = now;

  return res;
}

export async function hydrateViaAppsScript(): Promise<{
  rootFolderId: string;
  folders: Record<string, string>;
  sheetId: string;
  sheetUrl: string;
}> {
  const res = await callAppsScript<{
    email?: string;
    rootFolderId: string;
    folders: Record<string, string>;
    sheetId: string;
    sheetUrl: string;
    data: Record<string, string[][]>;
  }>('readAll');

  if (res.email) appsScriptOwnerEmail = res.email;
  studioDb.workspace.rootFolderId = res.rootFolderId;
  studioDb.workspace.folders = res.folders;
  studioDb.workspace.sheetId = res.sheetId;
  studioDb.workspace.sheetUrl = res.sheetUrl;

  const data = res.data || {};
  const galRows = data.GALERIA;
  if (galRows && galRows.length > 0) {
    const parsed: GalleryItem[] = galRows
      .filter((r) => r[0])
      .map((r, idx) => ({
        id: String(r[0]),
        fileName: String(r[1] || `obra-${idx + 1}.jpg`),
        driveFileId: String(r[2] || ''),
        url: r[2] ? `/api/media/image/${r[2]}` : String(r[3] || ''),
        caption: String(r[4] || ''),
        description: String(r[5] || ''),
        category: (r[6] as TattooCategory) || 'Outros',
        order: Number(r[7]) || idx + 1,
        published: String(r[8]).toUpperCase() !== 'NÃO',
        createdAt: String(r[9] || new Date().toISOString()),
        source: r[2] ? 'drive' : 'studio-initial',
      }));
    if (parsed.length > 0) studioDb.gallery = parsed;
  }

  const histRows = data.HISTORIA;
  if (histRows && histRows.length > 0) {
    const parsedStory: StoryChapter[] = histRows
      .filter((r) => r[0])
      .map((r, idx) => {
        const photoId = String(r[3] || '');
        const isDrive = Boolean(photoId && !photoId.startsWith('initial-'));
        const fallback = studioDb.story[idx]?.photoUrl || studioDb.story[0].photoUrl;
        return {
          id: String(r[0]),
          title: String(r[1] || `Capítulo ${idx + 1}`),
          text: String(r[2] || ''),
          photoId,
          photoUrl: isDrive ? `/api/media/image/${photoId}` : fallback,
          order: Number(r[4]) || idx + 1,
          published: String(r[5]).toUpperCase() !== 'NÃO',
          isOriginalUploaded: isDrive,
        };
      });
    if (parsedStory.length > 0) studioDb.story = parsedStory;
  }

  const musicRows = data.MUSICA;
  if (musicRows && musicRows.length > 0) {
    const parsedMusic: MusicTrack[] = musicRows
      .filter((r) => r[0])
      .map((r) => {
        const driveId = String(r[2] || 'ambient-fallback');
        return {
          id: String(r[0]),
          name: String(r[1] || 'Trilha Sonora'),
          driveFileId: driveId,
          format: String(r[3] || 'MP3'),
          duration: String(r[4] || '--:--'),
          selected: String(r[5]).toUpperCase() === 'SIM',
          volume: Number(r[6]) || 0.45,
          active: String(r[7]).toUpperCase() !== 'NÃO',
          streamUrl:
            driveId === 'ambient-fallback'
              ? '/api/media/ambient-fallback'
              : `/api/media/audio/${driveId}`,
        };
      });
    if (parsedMusic.length > 0) studioDb.music = parsedMusic;
  }

  addLog('Apps Script sincronizado', 'Dados verificados via Google Apps Script.', 'APPS_SCRIPT');
  studioDb.workspace.connected = true;
  studioDb.workspace.mode = 'server-env';
  studioDb.workspace.lastSyncedAt = new Date().toISOString();

  return res;
}

export async function appendAppointmentViaAppsScript(a: AppointmentRequest) {
  await callAppsScript('upsertRow', {
    tab: 'AGENDAMENTOS',
    values: [
      a.id,
      a.fullName,
      a.whatsapp,
      a.email,
      `${a.serviceType} (${a.bodyRegion} / ${a.approximateSize})`,
      a.desiredDate,
      a.desiredTime,
      a.description,
      a.status,
      a.createdAt,
    ],
  });
}

export async function uploadAssetViaAppsScript(params: {
  folderKey: 'portfolio' | 'historia' | 'musica' | 'bastidores';
  fileName: string;
  mimeType: string;
  base64Data: string;
  makePublic?: boolean;
}) {
  const cleanB64 = params.base64Data.includes(',')
    ? params.base64Data.split(',')[1]
    : params.base64Data;
  const folderKeyMap = {
    portfolio: 'portfolio',
    historia: 'historia',
    musica: 'trilhaSonora',
    bastidores: 'bastidores',
  } as const;
  return callAppsScript<{ id: string; webViewLink?: string }>('uploadFile', {
    folderKey: folderKeyMap[params.folderKey],
    fileName: params.fileName,
    mimeType: params.mimeType,
    base64Data: cleanB64,
    makePublic: params.makePublic ?? true,
  });
}

export async function deleteAssetViaAppsScript(fileId: string) {
  if (!fileId || fileId.startsWith('initial-') || fileId === 'ambient-fallback') return;
  await callAppsScript('deleteFile', { fileId });
}
