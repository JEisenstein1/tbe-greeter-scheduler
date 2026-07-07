import { clearCookie, createSessionCookie, parseCookies, publicBaseUrl, requiredEnv, roleForEmail, serializeCookie, STATE_COOKIE_NAME, COOKIE_NAME } from '../../../lib/_auth.js';
import { db, hasDb, migrate, upsertUser } from '../../../lib/_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const cookies = parseCookies(req);
    const stateCookie = cookies[STATE_COOKIE_NAME] ? JSON.parse(cookies[STATE_COOKIE_NAME]) : null;
    if (!stateCookie?.state || req.query.state !== stateCookie.state) return res.status(400).json({ error: 'Invalid OAuth state' });
    if (!req.query.code) return res.status(400).json({ error: 'Missing OAuth code' });

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${publicBaseUrl(req)}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: requiredEnv('GOOGLE_CLIENT_ID'), client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'), redirect_uri: redirectUri, grant_type: 'authorization_code', code: String(req.query.code) }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) return res.status(502).json({ error: 'Google token exchange failed', detail: token.error_description || token.error });

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileRes.json();
    if (!profileRes.ok) return res.status(502).json({ error: 'Google profile fetch failed' });
    if (!profile.email_verified) return res.status(403).json({ error: 'Google email is not verified' });

    const user = { googleSub: profile.sub, name: profile.name || profile.email.split('@')[0], email: profile.email.trim().toLowerCase(), role: roleForEmail(profile.email), source: 'google' };
    if (hasDb()) { const sql = db(); await migrate(sql); await upsertUser(sql, user); }

    res.setHeader('Set-Cookie', [serializeCookie(COOKIE_NAME, createSessionCookie(user), { maxAge: 60 * 60 * 8 }), clearCookie(STATE_COOKIE_NAME)]);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (error) { res.status(500).json({ error: 'OAuth callback failed', detail: error.message }); }
}
