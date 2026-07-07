import { db, getSlot, logAudit, logEmail, normalizeEmail } from './_db.js';
import { COOKIE_NAME, parseCookies, verifySessionCookie } from './_auth.js';
import { handleError } from './_http.js';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeMimeHeader(value) {
  const text = String(value || '');
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function parseEmailAddress(value) {
  const text = String(value || '').trim();
  const match = text.match(/<([^>]+)>/);
  return (match?.[1] || text).trim();
}

function yyyymmdd(dateISO) {
  return String(dateISO || '').replace(/-/g, '');
}

function parseTimeLabel(timeLabel) {
  const match = String(timeLabel || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return { hh: 9, mm: 0 };
  let hh = Number(match[1]);
  const mm = Number(match[2] || '0');
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hh !== 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  return { hh, mm };
}

function addMinutes({ hh, mm }, minutes) {
  const total = hh * 60 + mm + minutes;
  return { hh: Math.floor(total / 60) % 24, mm: total % 60 };
}

function hhmmss({ hh, mm }) {
  return `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
}

function foldIcsLine(line) {
  if (line.length <= 73) return line;
  const chunks = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

export function buildCalendarInvite({ service, slot, volunteer, organizerEmail }) {
  const start = parseTimeLabel(slot?.time_slot || service?.time_label);
  const end = addMinutes(start, 60);
  const date = yyyymmdd(service?.date_iso);
  const summary = `${service?.type || 'Temple Beth El Service'} ${slot?.role || 'Greeter'}`;
  const uid = `tbe-greeter-${service?.id}-${slot?.id}@tbe-greeter-scheduler`;
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Temple Beth El//Greeter Scheduler//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART;TZID=America/New_York:${date}T${hhmmss(start)}`,
    `DTEND;TZID=America/New_York:${date}T${hhmmss(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(`Temple Beth El greeter assignment: ${volunteer?.volName || 'Volunteer'} as ${slot?.role || 'Greeter'} for ${service?.type || 'service'}.`)}`,
    `ORGANIZER;CN=Temple Beth El:mailto:${escapeIcs(organizerEmail)}`,
    `ATTENDEE;CN=${escapeIcs(volunteer?.volName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${escapeIcs(volunteer?.volEmail)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return {
    filename: `tbe-greeter-${service?.id}-${slot?.id}.ics`,
    content: lines.map(foldIcsLine).join('\r\n') + '\r\n',
  };
}

export function buildRawEmail({ from, to, subject, text, calendarInvite = null }) {
  if (!calendarInvite) {
    const body = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodeMimeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text,
    ].join('\r\n');
    return base64url(body);
  }
  const boundary = `tbe-greeter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const body = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    `Content-Type: text/calendar; charset=utf-8; method=REQUEST; name="${calendarInvite.filename}"`,
    'Content-Transfer-Encoding: 8bit',
    `Content-Disposition: attachment; filename="${calendarInvite.filename}"`,
    'Content-Class: urn:content-classes:calendarmessage',
    '',
    calendarInvite.content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return base64url(body);
}

export function buildResendPayload({ from, to, subject, text, calendarInvite = null }) {
  const payload = { from, to: [to], subject, text };
  if (calendarInvite) {
    payload.attachments = [{
      filename: calendarInvite.filename,
      content: Buffer.from(calendarInvite.content, 'utf8').toString('base64'),
      contentType: 'text/calendar; method=REQUEST; charset=utf-8',
    }];
  }
  return payload;
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

async function sendWithGmail(to, subject, text, calendarInvite = null) {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawEmail({ from: process.env.EMAIL_FROM, to, subject, text, calendarInvite });
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { provider: 'gmail', status: 'failed', error: body?.error?.message || `HTTP ${r.status}` };
  return { provider: 'gmail', status: 'sent', providerMessageId: body?.id };
}

async function sendConfirmation(to, subject, text, calendarInvite = null) {
  const provider = getEmailProvider();
  if (provider === 'disabled') return { provider: 'disabled', status: 'disabled', error: 'Email provider not configured' };
  if (provider === 'gmail') {
    try { return await sendWithGmail(to, subject, text, calendarInvite); }
    catch (error) { return { provider: 'gmail', status: 'failed', error: error.message }; }
  }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildResendPayload({ from: process.env.EMAIL_FROM, to, subject, text, calendarInvite })) });
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
    const serviceRows = await sql`SELECT id, date_iso::text AS date_iso, date_label, time_label, type FROM services WHERE id=${String(serviceId)} LIMIT 1`;
    const service = serviceRows[0];
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (String(slot.service_id) !== String(serviceId)) return res.status(400).json({ error: 'slotId does not belong to serviceId' });
    if (slot.volunteer_email && user.role !== 'admin') return res.status(409).json({ error: 'Slot already filled' });
    await sql`UPDATE slots SET volunteer_name=${user.volName}, volunteer_email=${user.volEmail}, coverage_requested=FALSE, updated_at=NOW() WHERE id=${slotId}`;
    await logAudit(sql, user.actorEmail, user.action, 'slot', slotId, { serviceId, volunteerEmail: user.volEmail });
    const subject = `You're scheduled — ${service.type}, ${service.date_label}`;
    const text = `Hi ${user.volName},\n\nYou are confirmed for ${slot.role}${slot.time_slot ? ` (${slot.time_slot})` : ''} at ${service.type} on ${service.date_label} at ${service.time_label}.\n\nA calendar invite is attached to this message. Thank you for volunteering.\n\n— Temple Beth El`;
    const calendarInvite = buildCalendarInvite({ service, slot, volunteer: user, organizerEmail: parseEmailAddress(process.env.EMAIL_FROM) });
    const delivery = await sendConfirmation(user.volEmail, subject, text, calendarInvite);
    await logEmail(sql, { to: user.volEmail, subject, provider: delivery.provider, status: delivery.status, providerMessageId: delivery.providerMessageId, error: delivery.error });
    return res.status(200).json({ ok: true, delivery });
  } catch (error) { return handleError(res, error); }
}
