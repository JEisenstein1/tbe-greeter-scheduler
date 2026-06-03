export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  provider: 'resend' | 'gmail' | 'disabled';
  status: 'sent' | 'failed' | 'disabled';
  providerMessageId?: string;
  error?: string;
}

export interface EmailProviderConfig {
  resendApiKey?: string;
  from?: string;
}

export function requireTransactionalEmailConfig(env: Record<string, string | undefined>): Required<EmailProviderConfig> {
  const resendApiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  const missing = [
    ['RESEND_API_KEY', resendApiKey],
    ['EMAIL_FROM', from],
  ].filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing email config: ${missing.join(', ')}`);
  return { resendApiKey: resendApiKey!, from: from! };
}

export function validateEmailMessage(message: EmailMessage): void {
  if (!message.to.trim() || !message.to.includes('@')) throw new Error('EMAIL_TO_REQUIRED');
  if (!message.subject.trim()) throw new Error('EMAIL_SUBJECT_REQUIRED');
  if (!message.text.trim() && !message.html?.trim()) throw new Error('EMAIL_BODY_REQUIRED');
}

export async function sendWithResend(message: EmailMessage, config: Required<EmailProviderConfig>, fetchImpl: typeof fetch = fetch): Promise<EmailSendResult> {
  validateEmailMessage(message);
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { provider: 'resend', status: 'failed', error: body?.message || `HTTP ${res.status}` };
  }
  return { provider: 'resend', status: 'sent', providerMessageId: body?.id };
}
