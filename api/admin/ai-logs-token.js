import { db } from '../../lib/_db.js';
import { handleError } from '../../lib/_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const expected = process.env.AI_LOG_AUDIT_TOKEN;
    const provided = req.headers['x-audit-token'] || req.query?.token;
    if (!expected || provided !== expected) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const limit = Math.min(Number(req.query.limit || 80), 200);
    const sql = db();
    const rows = await sql`SELECT id, created_at, user_email, user_role, model, status, latency_ms, prompt,
      response_text, response_chars, action_count, action_types, error, metadata
      FROM ai_interaction_log ORDER BY created_at DESC LIMIT ${limit}`;
    return res.status(200).json({ logs: rows });
  } catch (error) {
    return handleError(res, error);
  }
}
