import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SESSION_COOKIE_NAME = 'lh_admin_session';
const CSRF_COOKIE_NAME = 'lh_csrf_token';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`lh-tattoo-studio-${process.cwd()}`).digest('hex');

export interface AdminSecurityRecord {
  username: string;
  passwordSalt: string;
  passwordHash: string;
  mustChangePassword: boolean;
  updatedAt: string;
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, effectiveSalt, 64).toString('hex');
  return { salt: effectiveSalt, hash: derived };
}

function verifyPasswordHash(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// Initial credentials: ADMIN / ADMIN with mandatory first-access password change
const initialCreds = hashPassword('ADMIN');

export const adminSecurityState: {
  record: AdminSecurityRecord;
  storedInAppData: boolean;
  appDataFileId: string | null;
} = {
  record: {
    username: 'ADMIN',
    passwordSalt: initialCreds.salt,
    passwordHash: initialCreds.hash,
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  },
  storedInAppData: false,
  appDataFileId: null,
};

// Rate limiting per IP for login attempts (max 5 failed attempts per 15 min)
interface LoginAttemptTracker {
  failures: number;
  blockedUntil: number;
  lastAttempt: number;
}
const loginRateLimiter = new Map<string, LoginAttemptTracker>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const tracker = loginRateLimiter.get(ip);
  if (!tracker) return { allowed: true };

  if (tracker.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((tracker.blockedUntil - now) / 1000),
    };
  }
  if (now - tracker.lastAttempt > 15 * 60 * 1000) {
    loginRateLimiter.delete(ip);
  }
  return { allowed: true };
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const existing = loginRateLimiter.get(ip) || { failures: 0, blockedUntil: 0, lastAttempt: now };
  existing.failures += 1;
  existing.lastAttempt = now;
  if (existing.failures >= 5) {
    existing.blockedUntil = now + 15 * 60 * 1000;
  }
  loginRateLimiter.set(ip, existing);
}

export function clearLoginFailures(ip: string): void {
  loginRateLimiter.delete(ip);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  if (username.trim().toUpperCase() !== adminSecurityState.record.username) {
    return false;
  }
  // On initial default access before password change, accept both "ADMIN" and "admin"
  const effectivePassword =
    adminSecurityState.record.mustChangePassword && password.trim().toLowerCase() === 'admin'
      ? 'ADMIN'
      : password;

  return verifyPasswordHash(
    effectivePassword,
    adminSecurityState.record.passwordSalt,
    adminSecurityState.record.passwordHash
  );
}

export function updateAdminPasswordHash(newPassword: string): AdminSecurityRecord {
  const { salt, hash } = hashPassword(newPassword);
  adminSecurityState.record = {
    username: 'ADMIN',
    passwordSalt: salt,
    passwordHash: hash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };
  return adminSecurityState.record;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

interface SessionPayload {
  username: string;
  exp: number;
  csrf: string;
}

function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  return req.secure || proto === 'https' || process.env.NODE_ENV === 'production';
}

export function issueAdminSessionCookies(
  req: Request,
  res: Response,
  username: string
): { csrfToken: string; sessionToken: string } {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const sessionToken = signSession({
    username,
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12h
    csrf: csrfToken,
  });
  const secure = isSecureRequest(req);
  const sameSite = secure ? 'None' : 'Lax';
  const partitioned = secure ? '; Secure; Partitioned' : '';

  res.append('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=43200${partitioned}`,
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}; Path=/; SameSite=${sameSite}; Max-Age=43200${partitioned}`,
  ]);
  return { csrfToken, sessionToken };
}

export function clearAdminSessionCookies(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  const sameSite = secure ? 'None' : 'Lax';
  const partitioned = secure ? '; Secure; Partitioned' : '';
  res.append('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${partitioned}`,
    `${CSRF_COOKIE_NAME}=; Path=/; SameSite=${sameSite}; Max-Age=0${partitioned}`,
  ]);
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieSession = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (cookieSession) return cookieSession;

  const headerToken = req.headers['x-admin-session'];
  if (typeof headerToken === 'string' && headerToken) {
    return verifySessionToken(headerToken);
  }
  return null;
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Sessão administrativa não autenticada.' });
    return;
  }

  // CSRF check for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const headerCsrf = req.headers['x-csrf-token'];
    if (typeof headerCsrf !== 'string' || headerCsrf !== session.csrf) {
      res.status(403).json({ error: 'Token CSRF inválido ou ausente.' });
      return;
    }
  }

  (req as Request & { adminSession?: SessionPayload }).adminSession = session;
  next();
}
