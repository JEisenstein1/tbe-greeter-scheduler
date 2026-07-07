import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/_auth.js', async () => {
  const actual = await vi.importActual('../../lib/_auth.js');
  return { ...actual, verifySessionCookie: vi.fn(() => null) };
});

// @ts-expect-error Vercel API route is a plain JS module.
const { getSignupActor, getEmailProvider } = await import('../../lib/signup.js');

describe('services signup API contract', () => {
  it('allows public volunteer signup with submitted name and email when no session cookie exists', () => {
    const actor = getSignupActor({
      headers: {},
      body: { name: '  Test Volunteer  ', email: ' Test.Volunteer@Example.COM ' },
    });

    expect(actor).toMatchObject({
      actorEmail: 'test.volunteer@example.com',
      action: 'public_signup',
      volName: 'Test Volunteer',
      volEmail: 'test.volunteer@example.com',
      role: 'volunteer',
    });
  });

  it('rejects public signup without a name and email instead of pretending it persisted', () => {
    expect(() => getSignupActor({ headers: {}, body: { name: '', email: '' } })).toThrow('name and email required');
  });

  it('selects the configured transactional email provider without requiring Resend', () => {
    expect(getEmailProvider({})).toBe('disabled');
    expect(getEmailProvider({ RESEND_API_KEY: 'rk', EMAIL_FROM: 'from@example.com' })).toBe('resend');
    expect(getEmailProvider({
      GMAIL_REFRESH_TOKEN: 'refresh',
      GMAIL_CLIENT_ID: 'client',
      GMAIL_CLIENT_SECRET: 'secret',
      EMAIL_FROM: 'Travis <travis.thybot@gmail.com>',
    })).toBe('gmail');
  });
});
