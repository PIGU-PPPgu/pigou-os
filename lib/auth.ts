import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'pigou_session';
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = 60 * 60 * 24 * SESSION_DAYS;

type SessionPayload = {
  sub: 'pigou';
  iat: number;
  exp: number;
};

export function getLoginPassword() {
  return process.env.PIGOU_LOGIN_PASSWORD || '';
}

function getSessionSecret() {
  return process.env.PIGOU_SESSION_SECRET || process.env.PIGOU_LOGIN_PASSWORD || '';
}

function digest(input: string) {
  return createHash('sha256').update(input).digest();
}

export function verifyPassword(input: string) {
  const expected = getLoginPassword();
  if (!expected || !input) return false;
  return timingSafeEqual(digest(input), digest(expected));
}

function sign(value: string) {
  const secret = getSessionSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: 'pigou',
    iat: now,
    exp: now + SESSION_MAX_AGE
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') || '';
  return getCookieFromHeader(cookieHeader, name);
}

export function getCookieFromHeader(cookieHeader: string, name: string) {
  const cookies = cookieHeader.split(';').map(part => part.trim());
  const match = cookies.find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function getSessionUserFromToken(token: string) {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  if (signature !== sign(encoded)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.sub !== 'pigou' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: 'pigou', name: 'Pigou' };
  } catch {
    return null;
  }
}

export function getSessionUserFromCookieHeader(cookieHeader: string) {
  return getSessionUserFromToken(getCookieFromHeader(cookieHeader, SESSION_COOKIE));
}

export function getSessionUser(request: Request) {
  return getSessionUserFromToken(getCookie(request, SESSION_COOKIE));
}

export function isAuthenticatedRequest(request: Request) {
  return Boolean(getSessionUser(request));
}

export const sessionMaxAge = SESSION_MAX_AGE;
