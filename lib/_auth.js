import crypto from 'node:crypto';

export const COOKIE_NAME = 'tbe_session';
export const STATE_COOKIE_NAME = 'tbe_oauth_state';
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.get?.('cookie') || '';
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return [part, ''];
    return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
  }));
}

export function serializeCookie(name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`];
  attrs.push(`Path=${options.path || '/'}`);
  attrs.push(`Max-Age=${options.maxAge ?? 60 * 60 * 8}`);
  attrs.push('HttpOnly');
  attrs.push('SameSite=Lax');
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

export function clearCookie(name) {
  return serializeCookie(name, '', { maxAge: 0 });
}

export function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionCookie(user) {
  const secret = requiredEnv('SESSION_SECRET');
  const payload = Buffer.from(JSON.stringify({ user, iat: Date.now() }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionCookie(cookieValue) {
  if (!cookieValue) return null;
  const secret = requiredEnv('SESSION_SECRET');
  const [payload, signature] = cookieValue.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(parsed.iat) || parsed.iat > Date.now() || Date.now() - parsed.iat > SESSION_MAX_AGE_MS) return null;
    return parsed.user || null;
  } catch {
    return null;
  }
}

export function roleForEmail(email) {
  const admins = (process.env.ADMIN_EMAILS || 'jon.eisenstein@gmail.com')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(String(email).trim().toLowerCase()) ? 'admin' : 'volunteer';
}

export function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'tbe-greeter-scheduler.vercel.app';
  return `${proto}://${host}`;
}
