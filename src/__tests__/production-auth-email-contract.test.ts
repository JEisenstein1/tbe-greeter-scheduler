import { describe, expect, it, vi } from 'vitest';
import { buildGoogleAuthUrl, mapGoogleProfileToUser, requireGoogleOAuthConfig } from '../backend/googleAuth';
import { requireTransactionalEmailConfig, sendWithResend, validateEmailMessage } from '../backend/email';

describe('Google OAuth production contract', () => {
  it('requires direct Google OAuth web client configuration', () => {
    expect(() => requireGoogleOAuthConfig({})).toThrow('GOOGLE_CLIENT_ID');
    expect(requireGoogleOAuthConfig({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.com/api/auth/google/callback',
    })).toMatchObject({ clientId: 'client-id', redirectUri: 'https://example.com/api/auth/google/callback' });
  });

  it('builds a Google OAuth authorization URL with OIDC scopes, state, and nonce', () => {
    const url = new URL(buildGoogleAuthUrl({ clientId: 'abc', clientSecret: 'secret', redirectUri: 'https://app.test/callback' }, 'state-123', 'nonce-456'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('abc');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('scope')).toContain('email');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('nonce')).toBe('nonce-456');
  });

  it('maps verified Google profile to server-side app user role', () => {
    expect(mapGoogleProfileToUser({ sub: 'google-sub', email: 'Jon.Eisenstein@GMAIL.COM', emailVerified: true, name: 'Jon Eisenstein' }, 'jon.eisenstein@gmail.com')).toEqual({
      googleSub: 'google-sub',
      name: 'Jon Eisenstein',
      email: 'jon.eisenstein@gmail.com',
      role: 'admin',
      source: 'google',
    });
    expect(mapGoogleProfileToUser({ sub: 'vol-sub', email: 'emma.p.adler@gmail.com', emailVerified: true, name: 'Emma Adler' }, 'jon.eisenstein@gmail.com').role).toBe('volunteer');
    expect(() => mapGoogleProfileToUser({ sub: 'x', email: 'x@example.com', emailVerified: false, name: 'X' }, '')).toThrow('GOOGLE_EMAIL_NOT_VERIFIED');
  });
});

describe('transactional email production contract', () => {
  it('requires provider config instead of pretending email was sent', () => {
    expect(() => requireTransactionalEmailConfig({})).toThrow('RESEND_API_KEY');
    expect(requireTransactionalEmailConfig({ RESEND_API_KEY: 'key', EMAIL_FROM: 'TBE <greeters@example.org>' })).toEqual({
      resendApiKey: 'key',
      from: 'TBE <greeters@example.org>',
    });
  });

  it('validates real delivery messages before provider call', () => {
    expect(() => validateEmailMessage({ to: '', subject: 'Hi', text: 'Body' })).toThrow('EMAIL_TO_REQUIRED');
    expect(() => validateEmailMessage({ to: 'person@example.com', subject: '', text: 'Body' })).toThrow('EMAIL_SUBJECT_REQUIRED');
    expect(() => validateEmailMessage({ to: 'person@example.com', subject: 'Hi', text: '' })).toThrow('EMAIL_BODY_REQUIRED');
  });

  it('sends through Resend adapter and returns provider message id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email-123' }) });

    await expect(sendWithResend(
      { to: 'emma@example.com', subject: 'Signup confirmation', text: 'Confirmed' },
      { resendApiKey: 'resend-key', from: 'TBE <greeters@example.org>' },
      fetchImpl as unknown as typeof fetch,
    )).resolves.toEqual({ provider: 'resend', status: 'sent', providerMessageId: 'email-123' });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
  });
});
