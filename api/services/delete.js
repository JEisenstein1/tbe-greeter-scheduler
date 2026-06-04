import { db, logAudit } from '../_db.js';
import { requireAdmin, handleError } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = requireAdmin(req);
    const { serviceId } = req.body || {};
    if (!serviceId) return res.status(400).json({ error: 'serviceId required' });
    const sql = db();
    await sql`DELETE FROM services WHERE id=${String(serviceId)}`;
    await logAudit(sql, user.email, 'delete_service', 'service', String(serviceId), {});
    return res.status(200).json({ ok: true });
  } catch (error) { return handleError(res, error); }
}
