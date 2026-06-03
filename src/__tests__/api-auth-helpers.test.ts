import { describe, expect, it } from 'vitest';
// @ts-expect-error Vercel API route helper is intentionally plain JS outside the Vite src tree.
import { COOKIE_NAME, createSessionCookie, parseCookies, roleForEmail, serializeCookie, verifySessionCookie } from '../../api/_auth.js';

describe('Vercel API auth helpers', () => {
  it('signs and verifies session cookies without exposing writable client state', () => {
    process.env.SESSION_SECRET = 'test-secret-at-least-32-ish-characters';
    const user = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };

    const cookie = createSessionCookie(user);

    expect(verifySessionCookie(cookie)).toMatchObject(user);
    expect(verifySessionCookie(cookie.replace(/.$/, 'x'))).toBeNull();
  });

  it('serializes HttpOnly SameSite session cookies', () => {
    const cookie = serializeCookie(COOKIE_NAME, 'abc', { maxAge: 60 });

    expect(cookie).toContain('tbe_session=abc');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=60');
  });

  it('parses request cookies and maps admin role from env allowlist', () => {
    const req = { headers: { cookie: 'a=1; b=two%20words' } };
    process.env.ADMIN_EMAILS = 'jon.eisenstein@gmail.com, admin@example.org';

    expect(parseCookies(req)).toEqual({ a: '1', b: 'two words' });
    expect(roleForEmail('ADMIN@example.org')).toBe('admin');
    expect(roleForEmail('emma@example.org')).toBe('volunteer');
  });
});
