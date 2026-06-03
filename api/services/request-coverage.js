import { db, getSlot, logAudit, normalizeEmail } from '../_db.js';
import { requireUser, handleError } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = requireUser(req);
    const { slotId } = req.body || {};
    const sql = db();
    const slot = await getSlot(sql, slotId);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    const owns = normalizeEmail(slot.volunteer_email) === normalizeEmail(user.email);
    if (!owns && user.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN' });
    await sql`UPDATE slots SET coverage_requested=TRUE, updated_at=NOW() WHERE id=${slotId}`;
    await logAudit(sql, user.email, 'request_coverage', 'slot', slotId, {});
    return res.status(200).json({ ok: true });
  } catch (error) { return handleError(res, error); }
}
