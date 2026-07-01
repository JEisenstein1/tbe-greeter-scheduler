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

// Debbie is on this Friday's greeter; the Friday greeter+usher are both filled (full service).
function baseServices() {
  return [
    {
      id: 'svc-this-fri', dateISO: '2026-07-03', date: 'Friday, July 3', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false,
      slots: [
        { id: 'fri-greeter', role: 'Greeter', timeSlot: null, volunteer: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' },
        { id: 'fri-usher', role: 'Usher', timeSlot: null, volunteer: 'Sarah Levine', volunteerEmail: 'sarah.levine@example.com' },
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

function ambiguousVolunteers() {
  return [
    { name: 'Debbie Adler-Klein', email: 'dakmd75@gmail.com', active: true },
    { name: 'Debbie Cohen', email: 'debbie.cohen@example.com', active: true },
  ];
}

const adminUser = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };
const volunteerUser = { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', role: 'volunteer', source: 'google' };

function llmMock(content: string, toolCalls: unknown[] = []) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content, tool_calls: toolCalls } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

describe('AI persona remediation — admin assignment/removal clarifications', () => {
  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.restoreAllMocks();
  });

  it('admin: "Add Debbie" without a service asks which service and returns no action', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Add Debbie', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text.toLowerCase()).toContain('which service');
    expect(body.text).toContain('Debbie Adler-Klein');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: ambiguous "Add Debbie" (multiple Debbies) asks which volunteer and returns no action', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Add Debbie', { headers: headersFor(adminUser), volunteers: ambiguousVolunteers() }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain('Which Debbie');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: "Add Debbie this Friday" when matching slots are full returns no action and explains no open slot', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Add Debbie this Friday', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text.toLowerCase()).toContain('open');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: "Remove Debbie" without a service asks which service and returns no action', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Remove Debbie', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text.toLowerCase()).toContain('which service');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: "Remove Debbie Friday" when Debbie is not assigned returns no action and explains not assigned', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // On Saturday Debbie is not assigned (Emma is).
    const res = await handler(request('Remove Debbie Saturday', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain("don't see Debbie Adler-Klein");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin: roster/contact requests are NOT hard-blocked and reach the model (admins may see roster)', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('Debbie Adler-Klein <dakmd75@gmail.com> is greeting this Friday.');

    const res = await handler(request("Show me the greeter roster and emails for this Friday's service", { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).not.toContain('can’t share roster');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('AI persona remediation — volunteer boundaries', () => {
  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.restoreAllMocks();
  });

  it('volunteer cannot assign another person even if the model returns assign_volunteer', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('I cannot assign other volunteers.', [
      { function: { name: 'assign_volunteer', arguments: JSON.stringify({ svcId: 'svc-next-fri', slotId: 'next-fri-greeter', volunteerName: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' }) } },
    ]);

    const res = await handler(request('Assign Debbie to greet next Friday', { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('volunteer cannot remove another person; removal only targets their own assignment', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request('Remove Debbie from this Friday', { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).not.toContain('Removing Debbie');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('volunteer cannot create a service; create_service tool is not offered and is filtered out', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('I cannot create services.', [
      { function: { name: 'create_service', arguments: JSON.stringify({ id: 'x', dateISO: '2026-08-01', date: 'Saturday, August 1', time: '9:30 AM', type: 'Shabbat Morning', isHH: false, slots: [] }) } },
    ]);

    const res = await handler(request('Create a Saturday Shabbat service on August 1', { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const toolNames = (payload.tools || []).map((t: { function: { name: string } }) => t.function.name);
    expect(toolNames).not.toContain('create_service');
  });

  it('volunteer contact-info request is refused before the model', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request("What is Debbie's email address?", { headers: headersFor(volunteerUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(body.text).toContain('can’t share roster');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('volunteer coverage acts on the signed session identity, not spoofed client user data', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await handler(request("I can't make my next service", {
      headers: headersFor(volunteerUser),
      user: { name: 'Debbie Adler-Klein', email: 'dakmd75@gmail.com' },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    // Emma (session) is assigned to sat-greeter; spoofed Debbie identity must be ignored.
    expect(body.actions).toEqual([{ action: 'request_coverage', svcId: 'svc-sat', slotId: 'sat-greeter' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('AI persona remediation — logged-out visitor boundaries', () => {
  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.restoreAllMocks();
  });

  it('guest cannot assign/create; no tools are offered and any actions are filtered', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchSpy = llmMock('Please sign in first.', [
      { function: { name: 'assign_volunteer', arguments: JSON.stringify({ svcId: 'svc-next-fri', slotId: 'next-fri-greeter', volunteerName: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' }) } },
    ]);

    const res = await handler(request('Assign Debbie to greet next Friday'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(payload.tools).toEqual([]);
  });

  it('guest can ask about open slots (no actions, model reached)', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchSpy = llmMock('There is an open greeter slot on Friday, July 10.');

    const res = await handler(request('Any open greeter slots this Friday?'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.actions).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('AI persona remediation — LLM routing / role filtering', () => {
  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.restoreAllMocks();
  });

  it('admin fallback: an explicit sign-me-up intent from the model is kept and OpenRouter is called', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ADMIN_EMAILS = adminUser.email;
    const fetchSpy = llmMock('Signing you up for Friday, July 10.', [
      { function: { name: 'sign_me_up', arguments: JSON.stringify({ svcId: 'svc-next-fri', slotId: 'next-fri-greeter' }) } },
    ]);

    const res = await handler(request('Please sign me up for next Friday', { headers: headersFor(adminUser) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(body.actions).toEqual([{ action: 'sign_me_up', svcId: 'svc-next-fri', slotId: 'next-fri-greeter' }]);
  });
});
