import type { Request } from 'express';
import { adminSecurityState, type AdminSecurityRecord } from './auth.js';
import { addLog, studioDb } from './store.js';
import type {
  AppointmentRequest,
  GalleryItem,
  MusicTrack,
  StoryChapter,
  TattooCategory,
} from '../src/types/studio.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const ROOT_FOLDER_NAME = 'LUAN HERCULES TATTOO';
const SUBFOLDERS = [
  { key: 'historia', name: 'HISTORIA' },
  { key: 'portfolio', name: 'PORTFOLIO' },
  { key: 'bastidores', name: 'BASTIDORES' },
  { key: 'identidadeVisual', name: 'IDENTIDADE-VISUAL' },
  { key: 'trilhaSonora', name: 'TRILHA-SONORA' },
] as const;

const SPREADSHEET_NAME = 'LUAN HERCULES TATTOO — GERENCIAMENTO';

const SHEET_TABS: Record<string, string[]> = {
  GALERIA: [
    'ID',
    'Nome do arquivo',
    'ID Google Drive',
    'URL ou referência',
    'Legenda',
    'Descrição',
    'Categoria',
    'Ordem',
    'Publicado',
    'Data de inclusão',
  ],
  HISTORIA: ['ID', 'Título', 'Texto', 'ID da fotografia', 'Ordem', 'Publicado'],
  MUSICA: [
    'ID',
    'Nome',
    'ID Google Drive',
    'Formato',
    'Duração',
    'Selecionada',
    'Volume',
    'Ativa',
  ],
  AGENDAMENTOS: [
    'ID',
    'Nome',
    'WhatsApp',
    'E-mail',
    'Serviço',
    'Data pretendida',
    'Horário pretendido',
    'Descrição',
    'Status',
    'Data da solicitação',
  ],
  CONFIGURACOES: ['Chave', 'Valor', 'Atualizado em'],
  LOG: ['ID', 'Ação', 'Detalhes', 'Responsável', 'Data e hora'],
};

let cachedRefreshAccessToken: { token: string; expiresAt: number } | null = null;
let cachedLastOwnerToken: string | null = null;

export function setOwnerAccessTokenCache(token: string | null): void {
  cachedLastOwnerToken = token;
}

export async function resolveGoogleAccessToken(req?: Request): Promise<string | null> {
  // 1. Prefer explicit Bearer token passed by authenticated Google Workspace session
  const authHeader = req?.headers['x-google-access-token'] || req?.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && token !== 'null' && token !== 'undefined') {
      cachedLastOwnerToken = token;
      return token;
    }
  }

  // 2. Fallback to Vercel / server-side OAuth2 refresh token if configured
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    if (cachedRefreshAccessToken && Date.now() < cachedRefreshAccessToken.expiresAt - 60_000) {
      return cachedRefreshAccessToken.token;
    }
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { access_token: string; expires_in: number };
        cachedRefreshAccessToken = {
          token: data.access_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        return cachedRefreshAccessToken.token;
      }
    } catch (err) {
      console.error('Erro ao renovar refresh token Google:', err);
    }
  }

  // 3. Fallback to recent active owner session token in current server process
  return cachedLastOwnerToken;
}

async function googleFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function findFolderByName(
  token: string,
  name: string,
  parentId?: string
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const qParts = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${escaped}'`,
    `trashed = false`,
  ];
  if (parentId) {
    qParts.push(`'${parentId}' in parents`);
  }
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(qParts.join(' and '))}&fields=files(id,name)&pageSize=5`;
  const res = await googleFetch(url, token);
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
  return data.files?.[0]?.id || null;
}

async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const body: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    body.parents = [parentId];
  }
  const res = await googleFetch(`${DRIVE_API}/files?fields=id`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao criar pasta "${name}" no Drive: ${errText}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function ensureDriveFolders(token: string) {
  let rootId =
    studioDb.workspace.rootFolderId ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    (await findFolderByName(token, ROOT_FOLDER_NAME));

  if (!rootId) {
    rootId = await createFolder(token, ROOT_FOLDER_NAME);
  }
  studioDb.workspace.rootFolderId = rootId;

  for (const sub of SUBFOLDERS) {
    const currentId = studioDb.workspace.folders[sub.key];
    if (!currentId) {
      let foundId = await findFolderByName(token, sub.name, rootId);
      if (!foundId) {
        foundId = await createFolder(token, sub.name, rootId);
      }
      studioDb.workspace.folders[sub.key] = foundId;
    }
  }

  return {
    rootFolderId: rootId,
    folders: studioDb.workspace.folders,
  };
}

export async function ensureManagementSheet(token: string, rootFolderId: string): Promise<string> {
  let sheetId = studioDb.workspace.sheetId || process.env.GOOGLE_SHEET_ID || null;

  if (!sheetId) {
    const q = `mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${SPREADSHEET_NAME}' and '${rootFolderId}' in parents and trashed = false`;
    const searchRes = await googleFetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      token
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
      sheetId = searchData.files?.[0]?.id || null;
    }
  }

  if (!sheetId) {
    const createRes = await googleFetch(SHEETS_API, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: SPREADSHEET_NAME, locale: 'pt_BR' },
        sheets: Object.keys(SHEET_TABS).map((title) => ({ properties: { title } })),
      }),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Falha ao criar planilha de gerenciamento: ${errText}`);
    }
    const created = (await createRes.json()) as { spreadsheetId: string };
    sheetId = created.spreadsheetId;

    // Move spreadsheet inside LUAN HERCULES TATTOO folder
    await googleFetch(
      `${DRIVE_API}/files/${sheetId}?addParents=${rootFolderId}&fields=id`,
      token,
      { method: 'PATCH' }
    );
  } else {
    // Ensure all 6 required tabs exist
    const metaRes = await googleFetch(`${SHEETS_API}/${sheetId}?fields=sheets.properties`, token);
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as {
        sheets?: Array<{ properties?: { title?: string } }>;
      };
      const existingTitles = new Set(
        (meta.sheets || []).map((s) => s.properties?.title).filter(Boolean)
      );
      const missingTabs = Object.keys(SHEET_TABS).filter((t) => !existingTitles.has(t));
      if (missingTabs.length > 0) {
        await googleFetch(`${SHEETS_API}/${sheetId}:batchUpdate`, token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
          }),
        });
      }
    }
  }

  // Write headers if missing
  for (const [tab, headers] of Object.entries(SHEET_TABS)) {
    const range = encodeURIComponent(`${tab}!A1:J1`);
    const checkRes = await googleFetch(`${SHEETS_API}/${sheetId}/values/${range}`, token);
    let needsHeader = true;
    if (checkRes.ok) {
      const checkJson = (await checkRes.json()) as { values?: string[][] };
      if (checkJson.values && checkJson.values.length > 0 && checkJson.values[0].length > 0) {
        needsHeader = false;
      }
    }
    if (needsHeader) {
      await googleFetch(
        `${SHEETS_API}/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`,
        token,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [headers] }),
        }
      );
    }
  }

  studioDb.workspace.sheetId = sheetId;
  studioDb.workspace.sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  return sheetId;
}

export async function syncAdminHashWithAppData(
  token: string,
  action: 'load' | 'save'
): Promise<boolean> {
  try {
    const searchUrl = `${DRIVE_API}/files?spaces=appDataFolder&q=${encodeURIComponent(
      "name = 'admin_security.json' and trashed = false"
    )}&fields=files(id,name)`;
    const searchRes = await googleFetch(searchUrl, token);
    if (!searchRes.ok) return false;
    const searchJson = (await searchRes.json()) as { files?: Array<{ id: string }> };
    const existingId = searchJson.files?.[0]?.id || adminSecurityState.appDataFileId;

    if (action === 'load' && existingId) {
      const fileRes = await googleFetch(`${DRIVE_API}/files/${existingId}?alt=media`, token);
      if (fileRes.ok) {
        const record = (await fileRes.json()) as AdminSecurityRecord;
        if (record.passwordHash && record.passwordSalt) {
          adminSecurityState.record = record;
          adminSecurityState.storedInAppData = true;
          adminSecurityState.appDataFileId = existingId;
          return true;
        }
      }
      return false;
    }

    const content = JSON.stringify(adminSecurityState.record);
    if (existingId) {
      const updateRes = await googleFetch(
        `${DRIVE_UPLOAD_API}/files/${existingId}?uploadType=media`,
        token,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: content,
        }
      );
      if (updateRes.ok) {
        adminSecurityState.storedInAppData = true;
        adminSecurityState.appDataFileId = existingId;
        return true;
      }
    } else {
      const boundary = `lh-appdata-${Date.now()}`;
      const metadata = JSON.stringify({
        name: 'admin_security.json',
        parents: ['appDataFolder'],
      });
      const multipartBody =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

      const createRes = await googleFetch(
        `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipartBody,
        }
      );
      if (createRes.ok) {
        const created = (await createRes.json()) as { id: string };
        adminSecurityState.storedInAppData = true;
        adminSecurityState.appDataFileId = created.id;
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('Erro ao sincronizar hash no appDataFolder:', err);
    return false;
  }
}

export async function makeFileReadableByLink(token: string, fileId: string): Promise<void> {
  try {
    await googleFetch(`${DRIVE_API}/files/${fileId}/permissions`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (err) {
    console.warn('Aviso ao configurar permissão de leitura pública no Drive:', err);
  }
}

export async function uploadBufferToDrive(
  token: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  makePublic = true
): Promise<{ id: string; webViewLink?: string }> {
  const boundary = `lh-upload-${Date.now()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf8'
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([prefix, buffer, suffix]);

  const res = await googleFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro no upload para o Google Drive: ${errText}`);
  }

  const file = (await res.json()) as { id: string; webViewLink?: string };
  if (makePublic) {
    await makeFileReadableByLink(token, file.id);
  }
  return file;
}

export async function createResumableDriveSession(
  token: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  origin?: string
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType,
  };
  if (origin) {
    headers['Origin'] = origin;
  }

  const res = await googleFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name`,
    token,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao iniciar sessão de upload resumível no Drive: ${errText}`);
  }

  const location = res.headers.get('location');
  if (!location) {
    throw new Error('Google Drive não retornou URI de sessão resumível.');
  }
  return location;
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  if (!fileId || fileId.startsWith('initial-') || fileId === 'ambient-fallback') return;
  const res = await googleFetch(`${DRIVE_API}/files/${fileId}`, token, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Erro ao excluir arquivo no Google Drive: ${errText}`);
  }
}

async function replaceSheetTabValues(
  token: string,
  sheetId: string,
  tabName: string,
  headers: string[],
  rows: Array<Array<string | number | boolean>>
): Promise<void> {
  const clearRange = encodeURIComponent(`${tabName}!A2:Z1000`);
  await googleFetch(`${SHEETS_API}/${sheetId}/values/${clearRange}:clear`, token, {
    method: 'POST',
  });

  const allRows = [headers, ...rows];
  const writeRange = encodeURIComponent(`${tabName}!A1`);
  const res = await googleFetch(
    `${SHEETS_API}/${sheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: allRows }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao atualizar aba "${tabName}" no Google Sheets: ${errText}`);
  }
}

export async function syncAllToSheets(token: string): Promise<void> {
  const { rootFolderId } = await ensureDriveFolders(token);
  const sheetId = await ensureManagementSheet(token, rootFolderId);

  await replaceSheetTabValues(
    token,
    sheetId,
    'GALERIA',
    SHEET_TABS.GALERIA,
    studioDb.gallery.map((g) => [
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
    ])
  );

  await replaceSheetTabValues(
    token,
    sheetId,
    'HISTORIA',
    SHEET_TABS.HISTORIA,
    studioDb.story.map((s) => [
      s.id,
      s.title,
      s.text,
      s.photoId,
      s.order,
      s.published ? 'SIM' : 'NÃO',
    ])
  );

  await replaceSheetTabValues(
    token,
    sheetId,
    'MUSICA',
    SHEET_TABS.MUSICA,
    studioDb.music.map((m) => [
      m.id,
      m.name,
      m.driveFileId,
      m.format,
      m.duration,
      m.selected ? 'SIM' : 'NÃO',
      m.volume,
      m.active ? 'SIM' : 'NÃO',
    ])
  );

  await replaceSheetTabValues(
    token,
    sheetId,
    'AGENDAMENTOS',
    SHEET_TABS.AGENDAMENTOS,
    studioDb.appointments.map((a) => [
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
    ])
  );

  const now = new Date().toISOString();
  const configEntries = Object.entries(studioDb.config).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
    now,
  ]);
  await replaceSheetTabValues(token, sheetId, 'CONFIGURACOES', SHEET_TABS.CONFIGURACOES, configEntries);

  await replaceSheetTabValues(
    token,
    sheetId,
    'LOG',
    SHEET_TABS.LOG,
    studioDb.logs.slice(0, 100).map((l) => [l.id, l.action, l.details, l.actor, l.timestamp])
  );

  studioDb.workspace.connected = true;
  studioDb.workspace.lastSyncedAt = now;
  studioDb.workspace.mode = process.env.GOOGLE_REFRESH_TOKEN ? 'server-env' : 'oauth-session';
}

export async function appendAppointmentToSheet(
  token: string,
  a: AppointmentRequest
): Promise<void> {
  const { rootFolderId } = await ensureDriveFolders(token);
  const sheetId = await ensureManagementSheet(token, rootFolderId);

  const range = encodeURIComponent('AGENDAMENTOS!A1');
  const res = await googleFetch(
    `${SHEETS_API}/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: [
          [
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
        ],
      }),
    }
  );
  if (!res.ok) {
    throw new Error('Não foi possível gravar solicitação na aba AGENDAMENTOS.');
  }
}

export async function hydrateFromSheetIfPopulated(token: string): Promise<void> {
  const { rootFolderId } = await ensureDriveFolders(token);
  const sheetId = await ensureManagementSheet(token, rootFolderId);

  const ranges = [
    'GALERIA!A2:J200',
    'HISTORIA!A2:F50',
    'MUSICA!A2:H50',
    'AGENDAMENTOS!A2:J300',
    'CONFIGURACOES!A2:C50',
  ]
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');

  const res = await googleFetch(`${SHEETS_API}/${sheetId}/values:batchGet?${ranges}`, token);
  if (!res.ok) return;

  const data = (await res.json()) as {
    valueRanges?: Array<{ range: string; values?: string[][] }>;
  };
  const vr = data.valueRanges || [];

  // GALERIA
  const galRows = vr[0]?.values;
  if (galRows && galRows.length > 0) {
    const parsed: GalleryItem[] = galRows
      .filter((r) => r[0])
      .map((r, idx) => ({
        id: r[0],
        fileName: r[1] || `obra-${idx + 1}.jpg`,
        driveFileId: r[2] || '',
        url: r[2] ? `/api/media/image/${r[2]}` : r[3] || '',
        caption: r[4] || '',
        description: r[5] || '',
        category: (r[6] as TattooCategory) || 'Outros',
        order: Number(r[7]) || idx + 1,
        published: String(r[8]).toUpperCase() !== 'NÃO',
        createdAt: r[9] || new Date().toISOString(),
        source: r[2] ? 'drive' : 'studio-initial',
      }));
    if (parsed.length > 0) studioDb.gallery = parsed;
  }

  // HISTORIA
  const histRows = vr[1]?.values;
  if (histRows && histRows.length > 0) {
    const parsedStory: StoryChapter[] = histRows
      .filter((r) => r[0])
      .map((r, idx) => {
        const photoId = r[3] || '';
        const isDrive = Boolean(photoId && !photoId.startsWith('initial-'));
        const fallback = studioDb.story[idx]?.photoUrl || studioDb.story[0].photoUrl;
        return {
          id: r[0],
          title: r[1] || `Capítulo ${idx + 1}`,
          text: r[2] || '',
          photoId,
          photoUrl: isDrive ? `/api/media/image/${photoId}` : fallback,
          order: Number(r[4]) || idx + 1,
          published: String(r[5]).toUpperCase() !== 'NÃO',
          isOriginalUploaded: isDrive,
        };
      });
    if (parsedStory.length > 0) studioDb.story = parsedStory;
  }

  // MUSICA
  const musicRows = vr[2]?.values;
  if (musicRows && musicRows.length > 0) {
    const parsedMusic: MusicTrack[] = musicRows
      .filter((r) => r[0])
      .map((r) => {
        const driveId = r[2] || 'ambient-fallback';
        return {
          id: r[0],
          name: r[1] || 'Trilha Sonora',
          driveFileId: driveId,
          format: r[3] || 'MP3',
          duration: r[4] || '--:--',
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

  // CONFIGURACOES
  const cfgRows = vr[4]?.values;
  if (cfgRows && cfgRows.length > 0) {
    for (const [key, rawVal] of cfgRows) {
      if (!key || rawVal === undefined) continue;
      if (key in studioDb.config) {
        try {
          if (rawVal.startsWith('[') || rawVal.startsWith('{') || rawVal === 'true' || rawVal === 'false' || !Number.isNaN(Number(rawVal))) {
            if (typeof (studioDb.config as unknown as Record<string, unknown>)[key] === 'string') {
              (studioDb.config as unknown as Record<string, unknown>)[key] = rawVal;
            } else {
              (studioDb.config as unknown as Record<string, unknown>)[key] = JSON.parse(rawVal);
            }
          } else {
            (studioDb.config as unknown as Record<string, unknown>)[key] = rawVal;
          }
        } catch {
          (studioDb.config as unknown as Record<string, unknown>)[key] = rawVal;
        }
      }
    }
  }

  addLog('Sincronização concluída', 'Dados carregados e verificados no Google Drive e Sheets.', 'GOOGLE_SYNC');
  studioDb.workspace.connected = true;
  studioDb.workspace.lastSyncedAt = new Date().toISOString();
}
