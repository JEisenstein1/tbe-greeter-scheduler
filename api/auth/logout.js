import { clearCookie, COOKIE_NAME } from '../../lib/_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Set-Cookie', clearCookie(COOKIE_NAME));
  res.status(200).json({ ok: true });
}
