import { db } from '../../lib/_db.js';
import { COOKIE_NAME, parseCookies, verifySessionCookie } from '../../lib/_auth.js';
import { handleError } from '../../lib/_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS ai_interaction_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_email TEXT,
      user_role TEXT,
      model TEXT,
      status TEXT NOT NULL,
      latency_ms INTEGER,
      prompt TEXT,
      response_text TEXT,
      response_chars INTEGER,
      action_count INTEGER,
      action_types TEXT[],
      error TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )`;
    const rows = await sql`SELECT id, created_at, user_email, user_role, model, status, latency_ms, prompt,
      response_text, response_chars, action_count, action_types, error, metadata
      FROM ai_interaction_log ORDER BY created_at DESC LIMIT ${limit}`;
    return res.status(200).json({ logs: rows });
  } catch (error) {
    return handleError(res, error);
  }
}
