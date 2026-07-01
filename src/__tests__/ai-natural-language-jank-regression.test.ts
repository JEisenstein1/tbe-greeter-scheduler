import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
// @ts-expect-error api/chat.js is the Vercel Edge runtime module, intentionally plain JS.
import handler from '../../api/chat.js';

const originalKey = process.env.OPENROUTER_API_KEY;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalAdminEmails = process.env.ADMIN_EMAILS;

const adminUser = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };
const volunteerUser = { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', role: 'volunteer', source: 'google' };

function signedSessionCookie(user: { name: string; email: string; role: string; source: string }) {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
  const payload = Buffer.from(JSON.stringify({ user, iat: Date.now() }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
  return `tbe_session=${encodeURIComponent(`${payload}.${sig}`)}`;
}

function headersFor(user: { name: string; email: string; role: string; source: string }) {
  return { Cookie: signedSessionCookie(user) };
}

function volunteers() {
  return [
    { name: 'Debbie Adler-Klein', email: 'dakmd75@gmail.com', active: true },
    { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', active: true },
    { name: 'Sarah Levine', email: 'sarah.levine@example.com', active: true },
  ];
}

function services() {
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

function request(message: string, extra: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(extra.headers as Record<string, string> || {}) },
    body: JSON.stringify({ message, services: services(), volunteers: volunteers(), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'headers')) }),
  });
}

function llmMock(text = 'LLM fallback response', toolCalls: unknown[] = []) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: text, tool_calls: toolCalls } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => {
  process.env.OPENROUTER_API_KEY = originalKey;
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
  vi.restoreAllMocks();
});

describe('AI natural-language scheduling jank regressions', () => {
  it('admin: "Can Debbie do next Friday?" is understood as assignment intent, not a generic availability question', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Can Debbie do next Friday?', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'assign_volunteer', svcId: 'svc-next-fri', slotId: 'next-fri-greeter', volunteerName: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' }]);
    expect(body.text).toContain('Debbie Adler-Klein');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: "What about Debbie next week?" inherits scheduling context from history', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('What about Debbie next week?', {
      headers: headersFor(adminUser),
      history: [
        { role: 'user', content: 'I need to fill Friday greeters' },
        { role: 'assistant', content: 'Which volunteer should I assign?' },
      ],
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'assign_volunteer', svcId: 'svc-next-fri', slotId: 'next-fri-greeter', volunteerName: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: "Who can cover Friday night?" is scheduling-related and should reach the model, not be refused as off-topic', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('Friday night has an open usher slot. You can ask me to assign a specific volunteer.');

    const res = await handler(request('Who can cover Friday night?', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).not.toContain('I can only help with Temple Beth-El greeter scheduling');
    expect(body.actions).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('volunteer: "Do I need to be there this weekend?" answers own assignment status deterministically', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Do I need to be there this weekend?', { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain('Emma Adler');
    expect(body.text).toContain('Saturday, July 11');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('volunteer: "I have a conflict" asks whether to request coverage instead of falling into generic chat', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('I have a conflict', { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'request_coverage', svcId: 'svc-sat', slotId: 'sat-greeter' }]);
    expect(body.text.toLowerCase()).toContain('coverage');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('guest: "Can I help Friday night?" gives signup guidance without provider call or mutation', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Can I help Friday night?'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text.toLowerCase()).toMatch(/sign in|sign up/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
