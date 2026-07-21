import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
// @ts-expect-error api/chat.js is the Vercel Edge runtime module, intentionally plain JS.
import handler from '../../api/chat.js';

const originalKey = process.env.OPENROUTER_API_KEY;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T12:00:00-04:00'));
});

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
  vi.useRealTimers();
});

describe('AI normal scheduling conversation rubric', () => {
  it.each([
    ['admin', 'Who is covering Friday night?'],
    ['admin', 'Who still needs to be assigned?'],
    ['admin', 'Can you show me the open slots?'],
    ['admin', 'Do we need anyone this weekend?'],
    ['admin', 'Is Debbie already on Friday?'],
    ['volunteer', 'Who is covering Friday night?'],
    ['volunteer', 'Can I see open spots?'],
    ['volunteer', 'Do you need anyone this weekend?'],
    ['volunteer', 'Am I needed?'],
    ['guest', 'Can I see open spots?'],
  ])('%s natural scheduling question is not blocked or mutated: %s', async (role, message) => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const headers = role === 'admin' ? headersFor(adminUser) : role === 'volunteer' ? headersFor(volunteerUser) : undefined;
    const fetchSpy = llmMock('Here are the relevant open/filled slots for that scheduling question.');

    const res = await handler(request(message, headers ? { headers } : {}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).not.toContain('I can only help with Temple Beth-El greeter scheduling');
    expect(body.actions).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('admin status question about an already-assigned volunteer does not create a second assignment', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('Debbie Adler-Klein is already assigned as Greeter this Friday. The Usher slot is still open.');

    const res = await handler(request('Can Debbie help Friday if she is already assigned?', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain('already assigned');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('admin explicit assignment still creates an assignment when the volunteer is not already on that service', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Can Sarah help next Friday?', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([{ action: 'assign_volunteer', svcId: 'svc-next-fri', slotId: 'next-fri-greeter', volunteerName: 'Sarah Levine', volunteerEmail: 'sarah.levine@example.com' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['That is not what I asked', 'What did I just ask you?', 'Try again — I mean Friday'])('conversation repair follow-up stays in the scheduling thread: %s', async (message) => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('You were asking about open Friday slots; let me answer that directly.');

    const res = await handler(request(message, {
      headers: headersFor(adminUser),
      history: [
        { role: 'user', content: 'Can you show me the open slots for Friday?' },
        { role: 'assistant', content: 'I can help with scheduling.' },
      ],
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).not.toContain('I can only help with Temple Beth-El greeter scheduling');
    expect(body.actions).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
