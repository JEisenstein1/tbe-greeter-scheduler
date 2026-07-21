import { COOKIE_NAME, parseCookies, roleForEmail, verifySessionCookie } from '../lib/_auth.js';

export function json(res, status, body) { return res.status(status).json(body); }
export function requireUser(req) {
  const user = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
  if (!user) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  return { ...user, role: roleForEmail(user.email) };
}
export function requireAdmin(req) {
  const user = requireUser(req);
  if (user.role !== 'admin') throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  return user;
}
export function handleError(res, error) {
  const status = error?.status || (error?.message === 'AUTH_REQUIRED' ? 401 : error?.message === 'FORBIDDEN' ? 403 : 500);
  return json(res, status, { error: error?.message || 'Internal server error' });
}
