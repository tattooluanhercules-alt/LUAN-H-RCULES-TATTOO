import express, { type Request, type Response } from 'express';
import {
  adminSecurityState,
  checkLoginRateLimit,
  clearAdminSessionCookies,
  clearLoginFailures,
  getClientIp,
  getSessionFromRequest,
  issueAdminSessionCookies,
  recordLoginFailure,
  requireAdminAuth,
  updateAdminPasswordHash,
  verifyAdminCredentials,
} from './auth.js';
import { getAmbientWavBuffer } from './audioGen.js';
import {
  appendAppointmentToSheet,
  createResumableDriveSession,
  deleteDriveFile,
  ensureDriveFolders,
  ensureManagementSheet,
  hydrateFromSheetIfPopulated,
  makeFileReadableByLink,
  resolveGoogleAccessToken,
  setOwnerAccessTokenCache,
  syncAdminHashWithAppData,
  syncAllToSheets,
  uploadBufferToDrive,
} from './google.js';
import { addLog, sanitizeText, studioDb } from './store.js';
import type {
  AppointmentRequest,
  AppointmentStatus,
  GalleryItem,
  MusicTrack,
  TattooCategory,
} from '../src/types/studio.js';
import { TATTOO_CATEGORIES } from '../src/types/studio.js';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
]);

function isValidCategory(cat: unknown): cat is TattooCategory {
  return typeof cat === 'string' && (TATTOO_CATEGORIES as string[]).includes(cat);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getMaxUploadBytes(): number {
  return (studioDb.config.maxUploadMb || 25) * 1024 * 1024;
}

export function createStudioApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ---------------------------------------------------------------------------
  // HEALTH
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      studio: studioDb.config.studioName,
      workspaceConnected: studioDb.workspace.connected,
    });
  });

  // ---------------------------------------------------------------------------
  // PUBLIC STUDIO PAYLOAD
  // ---------------------------------------------------------------------------
  app.get('/api/public/studio', (_req, res) => {
    const publishedStory = [...studioDb.story]
      .filter((s) => s.published)
      .sort((a, b) => a.order - b.order);

    const publishedGallery = [...studioDb.gallery]
      .filter((g) => g.published)
      .sort((a, b) => a.order - b.order);

    const activeMusic = studioDb.music.filter((m) => m.active);
    const activeTrack =
      activeMusic.find((m) => m.selected) || activeMusic[0] || studioDb.music[0] || null;

    res.json({
      config: studioDb.config,
      story: publishedStory,
      gallery: publishedGallery,
      music: activeMusic,
      activeTrack,
    });
  });

  // ---------------------------------------------------------------------------
  // PUBLIC APPOINTMENT SUBMISSION (WITH LGPD CONSENT + SHEETS SYNC)
  // ---------------------------------------------------------------------------
  app.post('/api/appointments', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const fullName = sanitizeText(body.fullName, 140);
      const whatsapp = sanitizeText(body.whatsapp, 40);
      const email = sanitizeText(body.email, 160);
      const birthDate = sanitizeText(body.birthDate, 20);
      const serviceType: TattooCategory = isValidCategory(body.serviceType)
        ? body.serviceType
        : 'Outros';
      const bodyRegion = sanitizeText(body.bodyRegion, 100);
      const approximateSize = sanitizeText(body.approximateSize, 60);
      const description = sanitizeText(body.description, 2000);
      const desiredDate = sanitizeText(body.desiredDate, 30);
      const desiredTime = sanitizeText(body.desiredTime, 30);
      const lgpdConsent = Boolean(body.lgpdConsent);

      if (!fullName || fullName.length < 3) {
        res.status(400).json({ error: 'Informe seu nome completo.' });
        return;
      }
      if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) {
        res.status(400).json({ error: 'Informe um número de WhatsApp válido com DDD.' });
        return;
      }
      if (!email || !isValidEmail(email)) {
        res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
        return;
      }
      if (!bodyRegion) {
        res.status(400).json({ error: 'Informe a região do corpo desejada.' });
        return;
      }
      if (!description || description.length < 10) {
        res.status(400).json({ error: 'Descreva sua ideia com pelo menos 10 caracteres.' });
        return;
      }
      if (!lgpdConsent) {
        res.status(400).json({ error: 'É necessário aceitar a Política de Privacidade (LGPD).' });
        return;
      }

      let referenceDriveFileId: string | undefined;
      let referenceImageUrl: string | undefined;

      // Optional reference image upload (base64 data URI)
      if (typeof body.referenceBase64 === 'string' && body.referenceBase64.startsWith('data:image/')) {
        const match = body.referenceBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          const mime = match[1].toLowerCase();
          if (!ALLOWED_IMAGE_MIME.has(mime)) {
            res.status(400).json({ error: 'Formato de imagem de referência inválido. Use JPG, PNG ou WebP.' });
            return;
          }
          const buffer = Buffer.from(match[2], 'base64');
          if (buffer.length > 8 * 1024 * 1024) {
            res.status(400).json({ error: 'Imagem de referência excede 8 MB.' });
            return;
          }
          const token = await resolveGoogleAccessToken(req);
          if (token) {
            try {
              const { folders } = await ensureDriveFolders(token);
              const folderId = folders.bastidores || studioDb.workspace.rootFolderId;
              if (folderId) {
                const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
                const fileName = `ref-${Date.now()}-${fullName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${ext}`;
                const uploaded = await uploadBufferToDrive(token, folderId, fileName, mime, buffer, false);
                referenceDriveFileId = uploaded.id;
                referenceImageUrl = `/api/media/image/${uploaded.id}`;
              }
            } catch (err) {
              console.warn('Não foi possível enviar referência ao Drive:', err);
            }
          } else {
            referenceImageUrl = body.referenceBase64;
          }
        }
      }

      const appointment: AppointmentRequest = {
        id: `AG-${Date.now().toString(36).toUpperCase()}`,
        fullName,
        whatsapp,
        email,
        birthDate: birthDate || undefined,
        serviceType,
        bodyRegion,
        approximateSize: approximateSize || 'A definir',
        description,
        desiredDate: desiredDate || 'Flexível',
        desiredTime: desiredTime || 'Flexível',
        referenceImageUrl,
        referenceDriveFileId,
        lgpdConsent: true,
        status: 'Pendente',
        createdAt: new Date().toISOString(),
      };

      studioDb.appointments.unshift(appointment);

      let syncedToSheet = false;
      const token = await resolveGoogleAccessToken(req);
      if (token) {
        try {
          await appendAppointmentToSheet(token, appointment);
          syncedToSheet = true;
        } catch (err) {
          console.warn('Agendamento salvo em memória; erro ao sincronizar Google Sheets:', err);
        }
      }

      addLog(
        'Solicitação de agendamento recebida',
        `${fullName} · ${serviceType} (${bodyRegion}) · Sheets: ${syncedToSheet ? 'OK' : 'Pendente'}`,
        'CLIENTE'
      );

      res.status(201).json({
        ok: true,
        appointmentId: appointment.id,
        syncedToSheet,
        message:
          'Solicitação recebida com sucesso. Seu pedido passará pela análise do tatuador Luan Hércules antes da confirmação definitiva.',
      });
    } catch (err) {
      console.error('Erro ao registrar agendamento:', err);
      res.status(500).json({ error: 'Não foi possível registrar sua solicitação no momento.' });
    }
  });

  // ---------------------------------------------------------------------------
  // LGPD DATA DELETION REQUEST (PUBLIC)
  // ---------------------------------------------------------------------------
  app.post('/api/lgpd/deletion-request', async (req: Request, res: Response) => {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const reason = sanitizeText(req.body?.reason, 500);
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um e-mail válido para localizar seus dados.' });
      return;
    }

    let removedCount = 0;
    const before = studioDb.appointments.length;
    studioDb.appointments = studioDb.appointments.filter((a) => a.email.toLowerCase() !== email);
    removedCount = before - studioDb.appointments.length;

    addLog(
      'Solicitação LGPD de exclusão',
      `E-mail: ${email} · Registros removidos: ${removedCount} · Motivo: ${reason || 'Não informado'}`,
      'LGPD_TITULAR'
    );

    const token = await resolveGoogleAccessToken(req);
    if (token && studioDb.workspace.sheetId) {
      try {
        await syncAllToSheets(token);
      } catch (err) {
        console.warn('Aviso ao sincronizar exclusão LGPD no Sheets:', err);
      }
    }

    res.json({
      ok: true,
      removedCount,
      message:
        'Sua solicitação de exclusão de dados pessoais (LGPD) foi registrada e processada com segurança.',
    });
  });

  // ---------------------------------------------------------------------------
  // MEDIA STREAMING (PUBLIC PROXY + HTTP RANGE REQUESTS)
  // ---------------------------------------------------------------------------
  app.get('/api/media/ambient-fallback', (req: Request, res: Response) => {
    const wav = getAmbientWavBuffer();
    const total = wav.length;
    const rangeHeader = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (Number.isNaN(start) || start >= total || end >= total || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(chunkSize));
      res.end(wav.subarray(start, end + 1));
      return;
    }

    res.setHeader('Content-Length', String(total));
    res.end(wav);
  });

  app.get('/api/media/image/:fileId', async (req: Request, res: Response) => {
    const fileId = sanitizeText(req.params.fileId, 120);
    if (!fileId) {
      res.status(400).end();
      return;
    }

    try {
      const token = await resolveGoogleAccessToken(req);
      const upstream = token
        ? await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`);

      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Imagem indisponível.' });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      const arrayBuf = await upstream.arrayBuffer();
      res.end(Buffer.from(arrayBuf));
    } catch (err) {
      console.error('Erro no proxy de imagem Drive:', err);
      res.status(502).end();
    }
  });

  app.get('/api/media/audio/:fileId', async (req: Request, res: Response) => {
    const fileId = sanitizeText(req.params.fileId, 120);
    if (!fileId) {
      res.status(400).end();
      return;
    }

    try {
      const token = await resolveGoogleAccessToken(req);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const targetUrl = token
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
        : `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

      const upstream = await fetch(targetUrl, { headers });
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: 'Áudio indisponível.' });
        return;
      }

      res.status(upstream.status);
      const copyHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
      for (const h of copyHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      if (!upstream.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      if (!upstream.headers.get('content-type')) {
        res.setHeader('Content-Type', 'audio/mpeg');
      }

      const arrayBuf = await upstream.arrayBuffer();
      res.end(Buffer.from(arrayBuf));
    } catch (err) {
      console.error('Erro no streaming de áudio Drive:', err);
      res.status(502).end();
    }
  });

  // ---------------------------------------------------------------------------
  // ADMIN AUTHENTICATION & PASSWORD MANAGEMENT
  // ---------------------------------------------------------------------------
  app.get('/api/admin/session', (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.json({
        authenticated: false,
        username: null,
        mustChangePassword: false,
        csrfToken: '',
        passwordStoredInAppData: adminSecurityState.storedInAppData,
      });
      return;
    }

    res.json({
      authenticated: true,
      username: session.username,
      mustChangePassword: adminSecurityState.record.mustChangePassword,
      csrfToken: session.csrf,
      passwordStoredInAppData: adminSecurityState.storedInAppData,
    });
  });

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Muitas tentativas de acesso. Aguarde ${Math.ceil((rateCheck.retryAfterSec || 60) / 60)} minuto(s) e tente novamente.`,
      });
      return;
    }

    const username = sanitizeText(req.body?.username, 60);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    // If Google refresh token is configured in env, ensure latest hash from appDataFolder is loaded
    const envToken = await resolveGoogleAccessToken(req);
    if (envToken && !adminSecurityState.storedInAppData) {
      await syncAdminHashWithAppData(envToken, 'load');
    }

    if (!verifyAdminCredentials(username, password)) {
      recordLoginFailure(ip);
      addLog('Tentativa de login inválida', `Origem: ${ip} · Usuário: ${username || 'vazio'}`, 'SEGURANÇA');
      res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      return;
    }

    clearLoginFailures(ip);
    const { csrfToken, sessionToken } = issueAdminSessionCookies(req, res, 'ADMIN');
    addLog('Login administrativo efetuado', `Sessão iniciada por ADMIN`, 'ADMIN');

    res.json({
      authenticated: true,
      username: 'ADMIN',
      mustChangePassword: adminSecurityState.record.mustChangePassword,
      csrfToken,
      sessionToken,
      passwordStoredInAppData: adminSecurityState.storedInAppData,
    });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    clearAdminSessionCookies(req, res);
    setOwnerAccessTokenCache(null);
    res.json({ ok: true });
  });

  app.post('/api/admin/change-password', requireAdminAuth, async (req: Request, res: Response) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!verifyAdminCredentials('ADMIN', currentPassword)) {
      res.status(400).json({ error: 'A senha atual informada está incorreta.' });
      return;
    }
    if (newPassword.length < 8 || newPassword.toUpperCase() === 'ADMIN') {
      res.status(400).json({
        error: 'A nova senha deve ter no mínimo 8 caracteres e ser diferente de ADMIN.',
      });
      return;
    }

    updateAdminPasswordHash(newPassword);

    let savedInAppData = false;
    const token = await resolveGoogleAccessToken(req);
    if (token) {
      savedInAppData = await syncAdminHashWithAppData(token, 'save');
    }

    addLog(
      'Senha administrativa alterada',
      `Hash seguro atualizado${savedInAppData ? ' e persistido no appDataFolder do Google Drive' : ''}.`,
      'ADMIN'
    );

    if (token && studioDb.workspace.sheetId) {
      try {
        await syncAllToSheets(token);
      } catch {
        // non-blocking log sync
      }
    }

    res.json({
      ok: true,
      mustChangePassword: false,
      passwordStoredInAppData: savedInAppData || adminSecurityState.storedInAppData,
    });
  });

  // ---------------------------------------------------------------------------
  // ADMIN PROTECTED WORKSPACE & CONTENT ROUTES
  // ---------------------------------------------------------------------------
  app.get('/api/admin/dashboard', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({
      config: studioDb.config,
      story: [...studioDb.story].sort((a, b) => a.order - b.order),
      gallery: [...studioDb.gallery].sort((a, b) => a.order - b.order),
      music: studioDb.music,
      appointments: studioDb.appointments,
      logs: studioDb.logs.slice(0, 60),
      workspace: studioDb.workspace,
      stats: {
        totalPhotos: studioDb.gallery.length,
        publishedPhotos: studioDb.gallery.filter((g) => g.published).length,
        storyUploadedCount: studioDb.story.filter((s) => s.isOriginalUploaded).length,
        totalMusic: studioDb.music.length,
        totalAppointments: studioDb.appointments.length,
        pendingAppointments: studioDb.appointments.filter(
          (a) => a.status === 'Pendente' || a.status === 'Em análise'
        ).length,
      },
    });
  });

  app.post('/api/admin/workspace/init', requireAdminAuth, async (req: Request, res: Response) => {
    const token = await resolveGoogleAccessToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Conecte sua conta Google no botão "Sign in with Google" antes de sincronizar.',
      });
      return;
    }

    try {
      // Load existing password hash from appDataFolder if present, or save current
      const loadedHash = await syncAdminHashWithAppData(token, 'load');
      if (!loadedHash) {
        await syncAdminHashWithAppData(token, 'save');
      }

      const { rootFolderId, folders } = await ensureDriveFolders(token);
      const sheetId = await ensureManagementSheet(token, rootFolderId);

      // Hydrate from sheet if sheet already has studio rows; otherwise push initial studio state
      await hydrateFromSheetIfPopulated(token);
      await syncAllToSheets(token);

      addLog(
        'Google Drive & Sheets conectados',
        `Estrutura LUAN HERCULES TATTOO verificada (Planilha ID: ${sheetId}).`,
        'ADMIN'
      );

      res.json({
        ok: true,
        workspace: studioDb.workspace,
        rootFolderId,
        folders,
        sheetId,
        passwordStoredInAppData: adminSecurityState.storedInAppData,
        mustChangePassword: adminSecurityState.record.mustChangePassword,
      });
    } catch (err) {
      console.error('Erro ao inicializar Google Workspace:', err);
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : 'Falha ao configurar pastas e planilha no Google Workspace.',
      });
    }
  });

  // Initiate direct browser->Google Drive resumable upload for large files (Vercel friendly)
  app.post(
    '/api/admin/drive/resumable-session',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const token = await resolveGoogleAccessToken(req);
      if (!token) {
        res.status(401).json({ error: 'Conecte sua conta Google para enviar arquivos ao Drive.' });
        return;
      }

      const target = sanitizeText(req.body?.target, 30); // 'portfolio' | 'historia' | 'musica'
      const fileName = sanitizeText(req.body?.fileName, 180) || `arquivo-${Date.now()}`;
      const mimeType = sanitizeText(req.body?.mimeType, 100);
      const fileSize = Number(req.body?.fileSize || 0);

      if (fileSize > getMaxUploadBytes()) {
        res.status(413).json({
          error: `Arquivo excede o limite configurado de ${studioDb.config.maxUploadMb} MB.`,
        });
        return;
      }

      const isAudio = target === 'musica';
      const validMime = isAudio
        ? ALLOWED_AUDIO_MIME.has(mimeType.toLowerCase())
        : ALLOWED_IMAGE_MIME.has(mimeType.toLowerCase());
      if (!validMime) {
        res.status(400).json({ error: 'Tipo de arquivo não permitido pela política de segurança.' });
        return;
      }

      try {
        const { folders, rootFolderId } = await ensureDriveFolders(token);
        const folderId =
          target === 'historia'
            ? folders.historia || rootFolderId
            : target === 'musica'
              ? folders.trilhaSonora || rootFolderId
              : folders.portfolio || rootFolderId;

        const uploadUrl = await createResumableDriveSession(
          token,
          folderId,
          fileName,
          mimeType,
          req.headers.origin
        );
        res.json({ uploadUrl, folderId });
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : 'Erro ao criar sessão de upload.',
        });
      }
    }
  );

  // Direct server-side upload (base64 JSON for images/tracks <= ~10MB)
  app.post('/api/admin/upload', requireAdminAuth, async (req: Request, res: Response) => {
    const token = await resolveGoogleAccessToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Conecte sua conta Google para enviar arquivos diretamente ao seu Google Drive.',
      });
      return;
    }

    try {
      const {
        target, // 'portfolio' | 'historia' | 'musica'
        fileName: rawName,
        mimeType: rawMime,
        base64Data,
        caption,
        description,
        category,
        storyId,
        duration,
      } = req.body || {};

      const mimeType = sanitizeText(rawMime, 100).toLowerCase();
      const fileName = sanitizeText(rawName, 180) || `studio-${Date.now()}`;
      const isAudio = target === 'musica';

      if (isAudio ? !ALLOWED_AUDIO_MIME.has(mimeType) : !ALLOWED_IMAGE_MIME.has(mimeType)) {
        res.status(400).json({ error: 'Tipo de arquivo inválido ou não suportado.' });
        return;
      }
      if (typeof base64Data !== 'string' || !base64Data) {
        res.status(400).json({ error: 'Conteúdo do arquivo ausente.' });
        return;
      }

      const cleanB64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const buffer = Buffer.from(cleanB64, 'base64');
      if (buffer.length > getMaxUploadBytes()) {
        res.status(413).json({
          error: `Arquivo excede o limite de ${studioDb.config.maxUploadMb} MB.`,
        });
        return;
      }

      const { folders, rootFolderId } = await ensureDriveFolders(token);
      const folderId =
        target === 'historia'
          ? folders.historia || rootFolderId
          : target === 'musica'
            ? folders.trilhaSonora || rootFolderId
            : folders.portfolio || rootFolderId;

      const uploaded = await uploadBufferToDrive(token, folderId, fileName, mimeType, buffer, true);
      const record = await registerUploadedDriveAsset({
        target,
        driveFileId: uploaded.id,
        fileName,
        mimeType,
        caption,
        description,
        category,
        storyId,
        duration,
      });

      await syncAllToSheets(token);
      res.status(201).json({ ok: true, item: record, driveFileId: uploaded.id });
    } catch (err) {
      console.error('Erro no upload:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao processar upload no Drive.',
      });
    }
  });

  app.post('/api/admin/drive/finalize-upload', requireAdminAuth, async (req: Request, res: Response) => {
    const token = await resolveGoogleAccessToken(req);
    if (!token) {
      res.status(401).json({ error: 'Sessão Google não conectada.' });
      return;
    }

    try {
      const { target, driveFileId, fileName, mimeType, caption, description, category, storyId, duration } =
        req.body || {};

      if (!driveFileId) {
        res.status(400).json({ error: 'ID do arquivo no Google Drive é obrigatório.' });
        return;
      }

      await makeFileReadableByLink(token, driveFileId);
      const record = await registerUploadedDriveAsset({
        target,
        driveFileId: sanitizeText(driveFileId, 120),
        fileName: sanitizeText(fileName, 180),
        mimeType: sanitizeText(mimeType, 100),
        caption,
        description,
        category,
        storyId,
        duration,
      });

      await syncAllToSheets(token);
      res.status(201).json({ ok: true, item: record });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao finalizar registro no Google Sheets.',
      });
    }
  });

  // Portfolio item edit / delete
  app.patch('/api/admin/gallery/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const item = studioDb.gallery.find((g) => g.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Trabalho não encontrado no portfólio.' });
      return;
    }

    const body = req.body || {};
    if (body.caption !== undefined) item.caption = sanitizeText(body.caption, 200);
    if (body.description !== undefined) item.description = sanitizeText(body.description, 500);
    if (isValidCategory(body.category)) item.category = body.category;
    if (typeof body.order === 'number') item.order = body.order;
    if (typeof body.published === 'boolean') item.published = body.published;

    addLog('Portfólio atualizado', `${item.caption || item.fileName} (${item.category})`, 'ADMIN');

    const token = await resolveGoogleAccessToken(req);
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, item });
  });

  app.delete('/api/admin/gallery/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const idx = studioDb.gallery.findIndex((g) => g.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Trabalho não encontrado.' });
      return;
    }
    const [removed] = studioDb.gallery.splice(idx, 1);

    const token = await resolveGoogleAccessToken(req);
    if (token && removed.driveFileId) {
      await deleteDriveFile(token, removed.driveFileId);
    }
    addLog('Trabalho excluído do portfólio', `${removed.caption || removed.fileName}`, 'ADMIN');
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true });
  });

  // Story chapter update & reorder
  app.patch('/api/admin/story/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const chapter = studioDb.story.find((s) => s.id === req.params.id);
    if (!chapter) {
      res.status(404).json({ error: 'Capítulo da história não encontrado.' });
      return;
    }

    const body = req.body || {};
    if (body.title !== undefined) chapter.title = sanitizeText(body.title, 140);
    if (body.text !== undefined) chapter.text = sanitizeText(body.text, 1000);
    if (typeof body.order === 'number') chapter.order = body.order;
    if (typeof body.published === 'boolean') chapter.published = body.published;

    addLog('História atualizada', `${chapter.title}`, 'ADMIN');
    const token = await resolveGoogleAccessToken(req);
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, chapter });
  });

  app.post('/api/admin/story/reorder', requireAdminAuth, async (req: Request, res: Response) => {
    const orderedIds = Array.isArray(req.body?.orderedIds) ? (req.body.orderedIds as string[]) : [];
    orderedIds.forEach((id, idx) => {
      const ch = studioDb.story.find((s) => s.id === id);
      if (ch) ch.order = idx + 1;
    });
    studioDb.story.sort((a, b) => a.order - b.order);

    addLog('Ordem da história atualizada', 'Sequência das 12 fotografias reordenada.', 'ADMIN');
    const token = await resolveGoogleAccessToken(req);
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, story: studioDb.story });
  });

  // Music management
  app.patch('/api/admin/music/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const track = studioDb.music.find((m) => m.id === req.params.id);
    if (!track) {
      res.status(404).json({ error: 'Faixa musical não encontrada.' });
      return;
    }

    const body = req.body || {};
    if (body.name !== undefined) track.name = sanitizeText(body.name, 140);
    if (typeof body.volume === 'number') {
      track.volume = Math.max(0, Math.min(1, body.volume));
      studioDb.config.defaultVolume = track.volume;
    }
    if (typeof body.active === 'boolean') track.active = body.active;
    if (body.selected === true) {
      studioDb.music.forEach((m) => {
        m.selected = m.id === track.id;
      });
    }

    addLog('Trilha sonora atualizada', `${track.name} · Principal: ${track.selected ? 'Sim' : 'Não'}`, 'ADMIN');
    const token = await resolveGoogleAccessToken(req);
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, track, music: studioDb.music });
  });

  app.delete('/api/admin/music/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const idx = studioDb.music.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Faixa não encontrada.' });
      return;
    }
    const [removed] = studioDb.music.splice(idx, 1);
    const token = await resolveGoogleAccessToken(req);
    if (token && removed.driveFileId && removed.driveFileId !== 'ambient-fallback') {
      await deleteDriveFile(token, removed.driveFileId);
    }
    if (removed.selected && studioDb.music.length > 0) {
      studioDb.music[0].selected = true;
    }
    addLog('Música removida', `${removed.name}`, 'ADMIN');
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, music: studioDb.music });
  });

  // Appointments management
  app.patch('/api/admin/appointments/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const appt = studioDb.appointments.find((a) => a.id === req.params.id);
    if (!appt) {
      res.status(404).json({ error: 'Solicitação não encontrada.' });
      return;
    }
    const validStatuses: AppointmentStatus[] = [
      'Pendente',
      'Em análise',
      'Atendido',
      'Confirmado',
      'Cancelado',
    ];
    if (validStatuses.includes(req.body?.status)) {
      appt.status = req.body.status;
    }

    addLog('Status de agendamento alterado', `${appt.fullName} -> ${appt.status}`, 'ADMIN');
    const token = await resolveGoogleAccessToken(req);
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, appointment: appt });
  });

  app.delete('/api/admin/appointments/:id', requireAdminAuth, async (req: Request, res: Response) => {
    const idx = studioDb.appointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Solicitação não encontrada.' });
      return;
    }
    const [removed] = studioDb.appointments.splice(idx, 1);
    const token = await resolveGoogleAccessToken(req);
    if (token && removed.referenceDriveFileId) {
      await deleteDriveFile(token, removed.referenceDriveFileId);
    }
    addLog('Registro de agendamento excluído', `${removed.id} (${removed.fullName})`, 'ADMIN');
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true });
  });

  // Studio Configuration update
  app.put('/api/admin/config', requireAdminAuth, async (req: Request, res: Response) => {
    const body = req.body || {};
    const c = studioDb.config;

    if (body.studioName !== undefined) c.studioName = sanitizeText(body.studioName, 100);
    if (body.artistName !== undefined) c.artistName = sanitizeText(body.artistName, 80);
    if (body.instagramUrl !== undefined) c.instagramUrl = sanitizeText(body.instagramUrl, 200);
    if (body.whatsappNumber !== undefined) c.whatsappNumber = sanitizeText(body.whatsappNumber, 30);
    if (body.whatsappDisplay !== undefined) c.whatsappDisplay = sanitizeText(body.whatsappDisplay, 40);
    if (body.email !== undefined) c.email = sanitizeText(body.email, 160);
    if (body.heroHeadline !== undefined) c.heroHeadline = sanitizeText(body.heroHeadline, 200);
    if (body.heroSubtitle !== undefined) c.heroSubtitle = sanitizeText(body.heroSubtitle, 240);
    if (body.storyTitle !== undefined) c.storyTitle = sanitizeText(body.storyTitle, 140);
    if (body.storyClosingQuote !== undefined) c.storyClosingQuote = sanitizeText(body.storyClosingQuote, 400);
    if (body.aboutTitle !== undefined) c.aboutTitle = sanitizeText(body.aboutTitle, 140);
    if (Array.isArray(body.aboutParagraphs)) {
      c.aboutParagraphs = body.aboutParagraphs
        .map((p: unknown) => sanitizeText(p, 1000))
        .filter(Boolean);
    }
    if (typeof body.playerEnabled === 'boolean') c.playerEnabled = body.playerEnabled;
    if (typeof body.defaultVolume === 'number') {
      c.defaultVolume = Math.max(0, Math.min(1, body.defaultVolume));
    }
    if (body.galleryColumns === 3 || body.galleryColumns === 4) {
      c.galleryColumns = body.galleryColumns;
    }
    if (typeof body.maxUploadMb === 'number') {
      c.maxUploadMb = Math.max(5, Math.min(100, body.maxUploadMb));
    }

    addLog('Configurações atualizadas', 'Textos, contatos ou parâmetros do estúdio alterados.', 'ADMIN');
    const token = await resolveGoogleAccessToken(req);
    if (token) {
      await syncAllToSheets(token);
    }
    res.json({ ok: true, config: c });
  });

  return app;
}

async function registerUploadedDriveAsset(params: {
  target: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  caption?: string;
  description?: string;
  category?: TattooCategory;
  storyId?: string;
  duration?: string;
}) {
  const { target, driveFileId, fileName, mimeType } = params;

  if (target === 'historia') {
    const chapter =
      studioDb.story.find((s) => s.id === params.storyId) ||
      studioDb.story.find((s) => !s.isOriginalUploaded) ||
      studioDb.story[0];
    if (chapter) {
      chapter.photoId = driveFileId;
      chapter.photoUrl = `/api/media/image/${driveFileId}`;
      chapter.isOriginalUploaded = true;
      if (params.caption) chapter.title = sanitizeText(params.caption, 140);
      if (params.description) chapter.text = sanitizeText(params.description, 1000);
      addLog('Fotografia da história enviada', `${chapter.title} · Drive ID: ${driveFileId}`, 'ADMIN');
      return chapter;
    }
  }

  if (target === 'musica') {
    const ext = fileName.split('.').pop()?.toUpperCase() || (mimeType.includes('wav') ? 'WAV' : 'MP3');
    const track: MusicTrack = {
      id: `track-${Date.now()}`,
      name: sanitizeText(params.caption || fileName.replace(/\.[^.]+$/, ''), 140),
      driveFileId,
      format: ext,
      duration: sanitizeText(params.duration, 20) || 'Instrumental',
      selected: true,
      volume: studioDb.config.defaultVolume,
      active: true,
      streamUrl: `/api/media/audio/${driveFileId}`,
    };
    studioDb.music.forEach((m) => {
      m.selected = false;
    });
    studioDb.music.unshift(track);
    addLog('Trilha sonora enviada ao Drive', `${track.name} (${track.format})`, 'ADMIN');
    return track;
  }

  // Default: portfolio
  const newItem: GalleryItem = {
    id: `gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fileName,
    driveFileId,
    url: `/api/media/image/${driveFileId}`,
    caption: sanitizeText(params.caption || fileName.replace(/\.[^.]+$/, ''), 200),
    description: sanitizeText(params.description || '', 500),
    category: isValidCategory(params.category) ? params.category : 'Outros',
    order: studioDb.gallery.length + 1,
    published: true,
    createdAt: new Date().toISOString(),
    source: 'drive',
  };
  studioDb.gallery.unshift(newItem);
  addLog('Obra adicionada ao portfólio', `${newItem.caption} (${newItem.category})`, 'ADMIN');
  return newItem;
}
