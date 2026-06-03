import { randomToken, requiredEnv, serializeCookie, STATE_COOKIE_NAME, publicBaseUrl } from '../../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const state = randomToken();
  const nonce = randomToken();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${publicBaseUrl(req)}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', requiredEnv('GOOGLE_CLIENT_ID'));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');

  res.setHeader('Set-Cookie', serializeCookie(STATE_COOKIE_NAME, JSON.stringify({ state, nonce }), { maxAge: 10 * 60 }));
  res.writeHead(302, { Location: url.toString() });
  res.end();
}
