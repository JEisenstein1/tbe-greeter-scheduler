import { db, logAudit, upsertService } from '../_db.js';
import { requireAdmin, handleError } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = requireAdmin(req);
    const { service } = req.body || {};
    if (!service?.id || !service?.dateISO || !service?.date || !service?.time || !service?.type || !Array.isArray(service?.slots)) {
      return res.status(400).json({ error: 'service with id, dateISO, date, time, type, and slots required' });
    }
    const sql = db();
    await upsertService(sql, service);
    await logAudit(sql, user.email, 'create_service', 'service', service.id, { dateISO: service.dateISO, type: service.type, slotCount: service.slots.length });
    return res.status(200).json({ ok: true, service });
  } catch (error) { return handleError(res, error); }
}
