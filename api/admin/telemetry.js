import { db } from '../../lib/_db.js';
import { COOKIE_NAME, parseCookies, verifySessionCookie } from '../../lib/_auth.js';
import { handleError } from '../../lib/_http.js';
import { ensureTelemetryTables } from '../../lib/_telemetry.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const sql = db();
    await ensureTelemetryTables(sql);
    const [sessions, messages, events, transactions] = await Promise.all([
      sql`SELECT * FROM chat_sessions ORDER BY last_seen_at DESC LIMIT ${limit}`,
      sql`SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ${limit}`,
      sql`SELECT * FROM app_event_log ORDER BY created_at DESC LIMIT ${limit}`,
      sql`SELECT * FROM transaction_log ORDER BY created_at DESC LIMIT ${limit}`,
    ]);
    return res.status(200).json({ sessions, messages, events, transactions });
  } catch (error) {
    return handleError(res, error);
  }
}
