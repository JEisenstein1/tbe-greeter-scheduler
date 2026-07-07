import { logAppEvent } from '../../lib/_telemetry.js';
import { COOKIE_NAME, parseCookies, verifySessionCookie } from '../../lib/_auth.js';
import { handleError } from '../../lib/_http.js';

const ALLOWED_EVENTS = new Set([
  'page_view', 'feature_opened', 'button_clicked', 'form_started', 'form_submitted',
  'form_validation_failed', 'chat_session_started', 'chat_message_sent',
  'assistant_response_received', 'assistant_response_failed', 'ai_action_applied',
  'signup_started', 'signup_completed', 'coverage_requested', 'service_created',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
    const eventName = String(req.body?.eventName || req.body?.name || '').trim();
    if (!ALLOWED_EVENTS.has(eventName)) return res.status(400).json({ error: 'INVALID_EVENT_NAME' });
    await logAppEvent({
      eventName,
      sessionId: req.body?.sessionId,
      userEmail: user?.email || req.body?.userEmail,
      userRole: user?.role || req.body?.userRole || 'guest',
      pagePath: req.body?.pagePath,
      source: 'web',
      properties: req.body?.properties || {},
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
