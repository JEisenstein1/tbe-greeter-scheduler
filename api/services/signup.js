import { db, getSlot, logAudit, logEmail, normalizeEmail } from '../_db.js';
import { COOKIE_NAME, parseCookies, verifySessionCookie } from '../_auth.js';
import { handleError } from '../_http.js';

async function sendConfirmation(to, subject, text) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { provider: 'disabled', status: 'disabled', error: 'RESEND_API_KEY/EMAIL_FROM not configured' };
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { provider: 'resend', status: 'failed', error: body?.message || `HTTP ${r.status}` };
  return { provider: 'resend', status: 'sent', providerMessageId: body?.id };
}

export function getSignupActor(req) {
  const sessionUser = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
  const { name, email } = req.body || {};
  if (sessionUser?.role === 'admin' && name && email) {
    return { actorEmail: sessionUser.email, action: 'admin_assign', volName: String(name).trim(), volEmail: normalizeEmail(email), role: 'admin' };
  }
  if (sessionUser) {
    return { actorEmail: sessionUser.email, action: 'signup', volName: sessionUser.name, volEmail: normalizeEmail(sessionUser.email), role: sessionUser.role };
  }
  if (!name?.trim() || !email?.trim()) throw Object.assign(new Error('name and email required'), { status: 400 });
  return { actorEmail: normalizeEmail(email), action: 'public_signup', volName: String(name).trim(), volEmail: normalizeEmail(email), role: 'volunteer' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { slotId, serviceId } = req.body || {};
    if (!slotId || !serviceId) return res.status(400).json({ error: 'slotId and serviceId required' });
    const user = getSignupActor(req);
    const sql = db();
    const slot = await getSlot(sql, slotId);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.volunteer_email && user.role !== 'admin') return res.status(409).json({ error: 'Slot already filled' });
    await sql`UPDATE slots SET volunteer_name=${user.volName}, volunteer_email=${user.volEmail}, coverage_requested=FALSE, updated_at=NOW() WHERE id=${slotId}`;
    await logAudit(sql, user.actorEmail, user.action, 'slot', slotId, { serviceId, volunteerEmail: user.volEmail });
    const subject = 'Temple Beth El greeter confirmation';
    const text = `Hi ${user.volName},\n\nYou are confirmed for ${slot.role}${slot.time_slot ? ` (${slot.time_slot})` : ''}.\n\nThank you for volunteering.`;
    const delivery = await sendConfirmation(user.volEmail, subject, text);
    await logEmail(sql, { to: user.volEmail, subject, provider: delivery.provider, status: delivery.status, providerMessageId: delivery.providerMessageId, error: delivery.error });
    return res.status(200).json({ ok: true, delivery });
  } catch (error) { return handleError(res, error); }
}
