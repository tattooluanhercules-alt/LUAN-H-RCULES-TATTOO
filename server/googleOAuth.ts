import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { isSecureRequest, parseCookies } from './auth.js';
import { addLog, studioDb } from './store.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/spreadsheets',
];

const OAUTH_STATE_COOKIE = 'lh_google_oauth_state';
const OAUTH_SESSION_COOKIE = 'lh_google_oauth';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    `lh-dev-fallback-secret-${process.cwd()}`;
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptJson(payload: object): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptJson<T>(token: string | undefined): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export interface ServerGoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  connectedAt: string;
}

interface PersistedCookieSession {
  refreshToken: string;
  email: string;
  connectedAt: string;
}

interface PendingStateEntry {
  adminUsername: string;
  redirectUri: string;
  createdAt: number;
}

// Single-administrator server-side token store (never exposed to frontend)
let serverTokenStore: ServerGoogleTokens | null = null;
let googleExplicitlyDisconnected = false;
const pendingOAuthStates = new Map<string, PendingStateEntry>();

export function getServerGoogleTokenState(): ServerGoogleTokens | null {
  return serverTokenStore;
}

export function setServerGoogleTokenState(tokens: ServerGoogleTokens | null): void {
  serverTokenStore = tokens;
}

export function resolveRedirectUri(req?: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/+$/, '')}/api/google/callback`;
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host');
    if (host) {
      return `${proto}://${host}/api/google/callback`;
    }
  }
  return 'http://localhost:3000/api/google/callback';
}

export function getOAuthConfigDiagnostics(req?: Request) {
  const missingEnvVars: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missingEnvVars.push('GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) missingEnvVars.push('GOOGLE_CLIENT_SECRET');
  if (!process.env.ADMIN_EMAIL) missingEnvVars.push('ADMIN_EMAIL');

  return {
    configured: missingEnvVars.length === 0,
    missingEnvVars,
    adminEmailConfigured: Boolean(process.env.ADMIN_EMAIL),
    hasRefreshTokenEnv: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
    hasSessionSecretEnv: Boolean(process.env.SESSION_SECRET),
    redirectUri: resolveRedirectUri(req),
  };
}

export function createOAuthAuthorizationUrl(
  req: Request,
  res: Response,
  adminUsername: string
): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const adminEmail = process.env.ADMIN_EMAIL?.trim();

  if (!clientId || !clientSecret || !adminEmail) {
    const missing = [
      !clientId ? 'GOOGLE_CLIENT_ID' : '',
      !clientSecret ? 'GOOGLE_CLIENT_SECRET' : '',
      !adminEmail ? 'ADMIN_EMAIL' : '',
    ].filter(Boolean);
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes no servidor: ${missing.join(', ')}.`
    );
  }

  // Prune expired pending states (> 10 minutes)
  const now = Date.now();
  for (const [key, entry] of pendingOAuthStates.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) {
      pendingOAuthStates.delete(key);
    }
  }

  const state = crypto.randomBytes(32).toString('hex');
  const redirectUri = resolveRedirectUri(req);

  pendingOAuthStates.set(state, {
    adminUsername,
    redirectUri,
    createdAt: now,
  });

  const signedState = encryptJson({
    state,
    adminUsername,
    redirectUri,
    exp: now + 10 * 60 * 1000,
  });
  const secure = isSecureRequest(req);
  const sameSite = secure ? 'None' : 'Lax';
  const partitioned = secure ? '; Secure; Partitioned' : '';

  res.append(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(signedState)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=600${partitioned}`
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    login_hint: adminEmail,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export function validateOAuthState(req: Request, res: Response, stateParam: string): PendingStateEntry | null {
  if (!stateParam) return null;

  const cookies = parseCookies(req.headers.cookie);
  const cookieData = decryptJson<{
    state: string;
    adminUsername?: string;
    redirectUri?: string;
    exp: number;
  }>(cookies[OAUTH_STATE_COOKIE]);

  // Clear state cookie immediately (single-use)
  const secure = isSecureRequest(req);
  const sameSite = secure ? 'None' : 'Lax';
  const partitioned = secure ? '; Secure; Partitioned' : '';
  res.append(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${partitioned}`
  );

  const pending = pendingOAuthStates.get(stateParam);
  if (pending) {
    pendingOAuthStates.delete(stateParam);
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return null;
    }
    if (cookieData) {
      if (Date.now() > cookieData.exp) return null;
      const a = Buffer.from(cookieData.state);
      const b = Buffer.from(stateParam);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
      }
    }
    return pending;
  }

  // Fallback for multi-instance / serverless cold starts: validate encrypted HttpOnly cookie directly
  if (!cookieData || Date.now() > cookieData.exp) {
    return null;
  }
  const a = Buffer.from(cookieData.state);
  const b = Buffer.from(stateParam);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return {
    adminUsername: cookieData.adminUsername || 'ADMIN',
    redirectUri: cookieData.redirectUri || resolveRedirectUri(req),
    createdAt: Date.now(),
  };
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

  const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description || tokenData.error || 'Falha ao trocar código OAuth pelo token Google.'
    );
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || serverTokenStore?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || '',
    expiresIn: tokenData.expires_in || 3600,
  };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<{
  email: string;
  verified: boolean;
}> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Não foi possível verificar o e-mail da conta Google autenticada.');
  }
  const user = (await res.json()) as { email?: string; verified_email?: boolean };
  if (!user.email) {
    throw new Error('Conta Google não retornou endereço de e-mail.');
  }
  return {
    email: user.email,
    verified: user.verified_email !== false,
  };
}

export function isAuthorizedAdminEmail(googleEmail: string): boolean {
  const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expected) return false;
  return googleEmail.trim().toLowerCase() === expected;
}

export async function revokeGoogleToken(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch (err) {
    console.warn('Aviso ao revogar token Google:', err);
  }
}

export function persistGoogleSessionCookie(
  req: Request,
  res: Response,
  tokens: ServerGoogleTokens
): void {
  googleExplicitlyDisconnected = false;
  serverTokenStore = tokens;
  if (!tokens.refreshToken) return;

  const encrypted = encryptJson({
    refreshToken: tokens.refreshToken,
    email: tokens.email,
    connectedAt: tokens.connectedAt,
  } satisfies PersistedCookieSession);

  const secure = isSecureRequest(req);
  const sameSite = secure ? 'None' : 'Lax';
  const partitioned = secure ? '; Secure; Partitioned' : '';

  res.append(
    'Set-Cookie',
    `${OAUTH_SESSION_COOKIE}=${encodeURIComponent(encrypted)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=2592000${partitioned}`
  );
}

export async function clearGoogleSession(req: Request, res: Response): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const cookieSession = decryptJson<PersistedCookieSession>(cookies[OAUTH_SESSION_COOKIE]);
  const tokenToRevoke =
    serverTokenStore?.refreshToken ||
    serverTokenStore?.accessToken ||
    cookieSession?.refreshToken;

  googleExplicitlyDisconnected = true;
  serverTokenStore = null;
  studioDb.workspace.connected = false;
  studioDb.workspace.lastSyncedAt = null;
  studioDb.workspace.mode = 'local-ready';

  const secure = isSecureRequest(req);
  const sameSite = secure ? 'None' : 'Lax';
  const partitioned = secure ? '; Secure; Partitioned' : '';

  res.append(
    'Set-Cookie',
    `${OAUTH_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${partitioned}`
  );

  if (tokenToRevoke) {
    await revokeGoogleToken(tokenToRevoke);
  }
  addLog('Conta Google desconectada', 'Sessão OAuth Google revogada e removida do servidor.', 'ADMIN');
}

export async function refreshAccessTokenWithRefreshToken(
  refreshToken: string,
  emailHint = ''
): Promise<ServerGoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados para renovação.');
  }

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || 'Falha ao renovar access token com Google OAuth.'
    );
  }

  const updated: ServerGoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    email: emailHint || serverTokenStore?.email || process.env.ADMIN_EMAIL || '',
    connectedAt: serverTokenStore?.connectedAt || new Date().toISOString(),
  };
  serverTokenStore = updated;
  return updated;
}

/**
 * Resolves a valid, auto-refreshed Google OAuth access token strictly on the server.
 * Priority:
 * 1. Active in-memory server OAuth token (auto-refreshed if expiring within 60s)
 * 2. Encrypted HttpOnly lh_google_oauth cookie (survives Vercel cold starts)
 * 3. Server environment GOOGLE_REFRESH_TOKEN (for unattended public/Vercel sync)
 */
export async function getValidServerGoogleAccessToken(req?: Request): Promise<string | null> {
  const now = Date.now();

  if (serverTokenStore?.accessToken && now < serverTokenStore.expiresAt - 60_000) {
    return serverTokenStore.accessToken;
  }

  if (serverTokenStore?.refreshToken) {
    try {
      const refreshed = await refreshAccessTokenWithRefreshToken(
        serverTokenStore.refreshToken,
        serverTokenStore.email
      );
      return refreshed.accessToken;
    } catch (err) {
      console.error('Erro ao renovar token em memória:', err);
      serverTokenStore = null;
    }
  }

  if (req) {
    const cookies = parseCookies(req.headers.cookie);
    const cookieSession = decryptJson<PersistedCookieSession>(cookies[OAUTH_SESSION_COOKIE]);
    if (cookieSession?.refreshToken) {
      try {
        const refreshed = await refreshAccessTokenWithRefreshToken(
          cookieSession.refreshToken,
          cookieSession.email
        );
        return refreshed.accessToken;
      } catch (err) {
        console.error('Erro ao renovar token via cookie:', err);
      }
    }
  }

  if (!googleExplicitlyDisconnected) {
    const envRefresh = process.env.GOOGLE_REFRESH_TOKEN?.trim();
    if (envRefresh && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      try {
        const refreshed = await refreshAccessTokenWithRefreshToken(
          envRefresh,
          process.env.ADMIN_EMAIL || ''
        );
        return refreshed.accessToken;
      } catch (err) {
        console.error('Erro ao renovar token via GOOGLE_REFRESH_TOKEN:', err);
      }
    }
  }

  return null;
}

export function getGoogleConnectionSummary(req?: Request) {
  const diag = getOAuthConfigDiagnostics(req);
  const cookies = req ? parseCookies(req.headers.cookie) : {};
  const cookieSession = decryptJson<PersistedCookieSession>(cookies[OAUTH_SESSION_COOKIE]);

  const connected = Boolean(
    serverTokenStore?.accessToken ||
      serverTokenStore?.refreshToken ||
      cookieSession?.refreshToken ||
      (!googleExplicitlyDisconnected && diag.hasRefreshTokenEnv && diag.configured)
  );

  const email =
    serverTokenStore?.email ||
    cookieSession?.email ||
    (!googleExplicitlyDisconnected && diag.hasRefreshTokenEnv ? process.env.ADMIN_EMAIL || null : null);

  return {
    connected,
    status: connected ? ('Conectado' as const) : ('Desconectado' as const),
    email,
    configured: diag.configured,
    missingEnvVars: diag.missingEnvVars,
    adminEmailConfigured: diag.adminEmailConfigured,
    redirectUri: diag.redirectUri,
    rootFolderId: studioDb.workspace.rootFolderId,
    folders: studioDb.workspace.folders,
    sheetId: studioDb.workspace.sheetId,
    sheetUrl: studioDb.workspace.sheetUrl,
    lastSyncedAt: studioDb.workspace.lastSyncedAt,
  };
}
