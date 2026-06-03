import { COOKIE_NAME, parseCookies, verifySessionCookie } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
    res.status(200).json({ user });
  } catch (error) {
    res.status(200).json({ user: null });
  }
}
