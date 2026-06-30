import { db, getSlot, logAudit, logEmail, normalizeEmail } from '../_db.js';
import { COOKIE_NAME, parseCookies, verifySessionCookie } from '../_auth.js';
import { handleError } from '../_http.js';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildRawEmail({ from, to, subject, text }) {
  const body = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
  ].join('\r\n');
  return base64url(body);
}

export function getEmailProvider(env = process.env) {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return 'resend';
  if (env.GMAIL_REFRESH_TOKEN && env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.EMAIL_FROM) return 'gmail';
  return 'disabled';
}

async function getGmailAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) throw new Error(body.error_description || body.error || `Gmail token HTTP ${r.status}`);
  return body.access_token;
}

async function sendWithGmail(to, subject, text) {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawEmail({ from: process.env.EMAIL_FROM, to, subject, text });
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { provider: 'gmail', status: 'failed', error: body?.error?.message || `HTTP ${r.status}` };
  return { provider: 'gmail', status: 'sent', providerMessageId: body?.id };
}

async function sendConfirmation(to, subject, text) {
  const provider = getEmailProvider();
  if (provider === 'disabled') return { provider: 'disabled', status: 'disabled', error: 'Email provider not configured' };
  if (provider === 'gmail') {
    try { return await sendWithGmail(to, subject, text); }
    catch (error) { return { provider: 'gmail', status: 'failed', error: error.message }; }
  }
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
