import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
// @ts-expect-error api/chat.js is the Vercel Edge runtime module, intentionally plain JS.
import handler from '../../api/chat.js';

const originalKey = process.env.OPENROUTER_API_KEY;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalAdminEmails = process.env.ADMIN_EMAILS;

function signedSessionCookie(user: { name: string; email: string; role: string; source: string }) {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
  const payload = Buffer.from(JSON.stringify({ user, iat: Date.now() }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
  return `tbe_session=${encodeURIComponent(`${payload}.${sig}`)}`;
}

function headersFor(user: { name: string; email: string; role: string; source: string }) {
  return { Cookie: signedSessionCookie(user) };
}

function request(message: string, extra: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(extra.headers as Record<string, string> || {}) },
    body: JSON.stringify({ message, services: baseServices(), volunteers: baseVolunteers(), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'headers')) }),
  });
}

function baseVolunteers() {
  return [
    { name: 'Debbie Adler-Klein', email: 'dakmd75@gmail.com', active: true },
    { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', active: true },
  ];
}

function baseServices() {
  return [
    {
      id: 'svc-this-fri', dateISO: '2026-07-03', date: 'Friday, July 3', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false,
      slots: [
        { id: 'fri-greeter', role: 'Greeter', timeSlot: null, volunteer: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' },
        { id: 'fri-usher', role: 'Usher', timeSlot: null, volunteer: null, volunteerEmail: null },
      ],
    },
    {
      id: 'svc-next-fri', dateISO: '2026-07-10', date: 'Friday, July 10', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false,
      slots: [{ id: 'next-fri-greeter', role: 'Greeter', timeSlot: null, volunteer: null, volunteerEmail: null }],
    },
    {
      id: 'svc-sat', dateISO: '2026-07-11', date: 'Saturday, July 11', time: '9:30 AM', type: 'Shabbat Morning', isHH: false,
      slots: [{ id: 'sat-greeter', role: 'Greeter', timeSlot: null, volunteer: 'Emma Adler', volunteerEmail: 'emma.p.adler@gmail.com' }],
    },
  ];
}

const adminUser = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };
const volunteerUser = { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', role: 'volunteer', source: 'google' };

describe('AI persona assignment scenario testbed', () => {
  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.restoreAllMocks();
  });

  it.each([
    ['add Debbie next Friday', 'Please add Debbie to next Friday', 'assign_volunteer'],
    ['put Debbie down', 'Put Debbie down for next Friday greeter', 'assign_volunteer'],
    ['schedule Debbie', 'Schedule Debbie for next Friday', 'assign_volunteer'],
  ])('admin scenario: %s', async (_label, message, action) => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request(message, { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action, svcId: 'svc-next-fri', slotId: 'next-fri-greeter', volunteerName: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' }]);
    expect(body.text).toContain('Adding Debbie Adler-Klein');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin scenario: remove Debbie from Friday means remove Debbie, not the signed-in admin', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Remove Debbie from this Friday', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'remove_signup', svcId: 'svc-this-fri', slotId: 'fri-greeter' }]);
    expect(body.text).toContain('Removing Debbie Adler-Klein');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('volunteer scenario: “I cannot make my next service” requests coverage for their own next assignment', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request("I can't make my next service", { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'request_coverage', svcId: 'svc-sat', slotId: 'sat-greeter' }]);
    expect(body.text).toContain('requesting coverage');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('volunteer scenario: “cancel my signup” removes only their own assignment', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Cancel my signup for Saturday', { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'remove_signup', svcId: 'svc-sat', slotId: 'sat-greeter' }]);
    expect(body.text).toContain('Removing you');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logged-out scenario: roster and contact requests are blocked and cannot produce actions', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Who is assigned this Friday and what is Debbie’s email?'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain('can’t share roster');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logged-out scenario: signup intent explains sign-in instead of taking action', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'You can sign in or use the Sign Up form to take an open greeter slot. I can show openings, but I cannot sign you up from chat while you are signed out.', tool_calls: [] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const res = await handler(request('Sign me up for next Friday'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain('sign');
  });
});
