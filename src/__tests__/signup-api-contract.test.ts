import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_auth.js', async () => {
  const actual = await vi.importActual('../../api/_auth.js');
  return { ...actual, verifySessionCookie: vi.fn(() => null) };
});

// @ts-expect-error Vercel API route is a plain JS module.
const { getSignupActor } = await import('../../api/services/signup.js');

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
});
