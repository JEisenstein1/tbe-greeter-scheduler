import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import scenarios from '../../test-fixtures/chat/top-50-acceptance.json';
// @ts-expect-error Production Vercel Edge handler is plain JS.
import handler from '../../api/chat.js';

type Persona = 'guest' | 'volunteer' | 'admin';
type Slot = { id: string; role: string; timeSlot: string | null; volunteer: string | null; volunteerEmail: string | null; coverageRequested?: boolean };
type Service = { id: string; dateISO: string; date: string; time: string; type: string; isHH: boolean; slots: Slot[]; windows?: Array<{ label: string; slots: Slot[] }> };

const ORIGINAL_ENV = {
  key: process.env.OPENROUTER_API_KEY,
  secret: process.env.SESSION_SECRET,
  admins: process.env.ADMIN_EMAILS,
};
const EMMA = { name: 'Emma Example', email: 'emma@example.test', role: 'volunteer', source: 'google' };
const ADMIN = { name: 'Admin User', email: 'admin@example.test', role: 'admin', source: 'google' };
const DEBBIE = { name: 'Debbie Adler-Klein', email: 'debbie@example.test', active: true };

function signedCookie(user: typeof EMMA | typeof ADMIN) {
  const payload = Buffer.from(JSON.stringify({ user, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('base64url');
  return `tbe_session=${encodeURIComponent(`${payload}.${signature}`)}`;
}

function slot(id: string, role = 'Greeter', volunteer: null | { name: string; email: string } = null, timeSlot: string | null = null): Slot {
  return { id, role, timeSlot, volunteer: volunteer?.name ?? null, volunteerEmail: volunteer?.email ?? null, coverageRequested: false };
}

function baseServices(): Service[] {
  return [
    { id: 'fri', dateISO: '2026-07-24', date: 'Friday, July 24', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false, slots: [slot('fri-g')] },
    { id: 'sat', dateISO: '2026-07-25', date: 'Saturday, July 25', time: '9:30 AM', type: 'Shabbat Morning', isHH: false, slots: [slot('sat-g')] },
    { id: 'next-fri', dateISO: '2026-07-31', date: 'Friday, July 31', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false, slots: [slot('next-fri-g')] },
    { id: 'yk', dateISO: '2026-09-21', date: 'Monday, September 21', time: '9:00 AM', type: 'Yom Kippur', isHH: true, slots: [], windows: [{ label: '9:00 AM – 9:30 AM', slots: [slot('yk-u1', 'Usher 1', null, '9:00 AM – 9:30 AM')] }] },
  ];
}

function servicesFor(id: string): Service[] {
  const services = baseServices();
  const emma = { name: EMMA.name, email: EMMA.email };
  const debbie = { name: DEBBIE.name, email: DEBBIE.email };
  if (['V-02', 'V-03', 'V-04', 'V-10'].includes(id)) services[0].slots[0] = slot('fri-g', 'Greeter', emma);
  if (id === 'V-02' || id === 'V-04') services[1].slots[0] = slot('sat-g', 'Greeter', emma);
  if (id === 'V-08') services[1].slots[0] = slot('sat-g', 'Greeter', emma);
  if (id === 'V-11') {
    services[0].slots[0] = slot('fri-g', 'Greeter', emma);
    services[1].slots[0] = slot('sat-g', 'Greeter', emma);
  }
  if (id === 'V-13') services[1].slots[0] = slot('sat-g', 'Greeter', debbie);
  if (id === 'V-17') services[0].slots[0] = slot('fri-g', 'Greeter', debbie);
  if (id === 'A-11') services[0].slots[0] = slot('fri-g', 'Greeter', debbie);
  if (id === 'A-09') services[0].slots[0] = slot('fri-g', 'Greeter', { name: 'Already Assigned', email: 'assigned@example.test' });
  if (['A-13', 'A-14'].includes(id)) services[0].slots[0] = slot('fri-g', 'Greeter', debbie);
  if (id === 'A-22') {
    services[0].slots[0] = slot('fri-g', 'Greeter', debbie);
    services[0].slots[0].coverageRequested = true;
  }
  if (id === 'A-15' || id === 'A-16') return [services[0], services[1]];
  return services;
}

function intendedAction(id: string, expected: Array<{ action: string }>) {
  const requested = expected[0]?.action;
  if (!requested) return null;
  const action = requested.startsWith('assign_volunteer') ? 'assign_volunteer' : requested;
  if (action === 'sign_me_up') {
    if (id === 'V-07') return { action, svcId: 'yk', slotId: 'yk-u1' };
    if (id === 'V-06' || id === 'V-19' || id === 'V-20') return { action, svcId: 'sat', slotId: 'sat-g' };
    return { action, svcId: 'fri', slotId: 'fri-g' };
  }
  if (action === 'assign_volunteer') return { action, svcId: 'fri', slotId: 'fri-g', volunteerName: DEBBIE.name, volunteerEmail: DEBBIE.email };
  if (action === 'remove_signup') return { action, svcId: id === 'V-08' || id === 'A-25' ? 'sat' : 'fri', slotId: id === 'V-08' || id === 'A-25' ? 'sat-g' : 'fri-g' };
  if (action === 'request_coverage') return { action, svcId: 'fri', slotId: 'fri-g' };
  if (action === 'create_service') {
    const isPurim = id === 'A-24';
    const isRH = id === 'A-02';
    return { action, service: {
      id: `created-${id.toLowerCase()}`,
      dateISO: isPurim ? '2027-03-13' : isRH ? '2026-09-12' : '2026-07-24',
      date: isPurim ? 'Saturday, March 13' : isRH ? 'Saturday, September 12' : 'Friday, July 24',
      time: isPurim ? '3:00 PM' : isRH ? '9:00 AM' : '6:30 PM',
      type: isPurim ? 'Purim Party' : isRH ? 'Rosh Hashanah' : 'Kabbalat Shabbat',
      isHH: isRH,
      slots: Array.from({ length: isPurim ? 3 : 1 }, (_, index) => ({ id: `created-${id.toLowerCase()}-${index + 1}`, role: 'Greeter', timeSlot: null, volunteer: null, volunteerEmail: null })),
    } };
  }
  return null;
}

function modelText(id: string, expected: Array<{ action: string }>) {
  if (id === 'V-20') return "Great — reply yes and I'll sign you up for the Yom Kippur Greeter slot in the 9:00 AM window.";
  if (id === 'A-22') return 'Debbie currently holds that slot. Should I remove Debbie and assign Marcus as her replacement?';
  if (id === 'V-13') return 'Debbie Adler-Klein is greeting this Saturday.';
  if (id === 'G-01') return 'Kabbalat Shabbat is Friday, July 24 at 6:30 PM with an open Greeter slot. Sign in or use the Sign Up form to help.';
  if (id === 'G-02') return 'Sign in with Google or use the Sign Up tab with your name and email.';
  if (id === 'G-03') return 'Shabbat Morning on Saturday, July 25 has an open Greeter slot.';
  if (['G-06', 'G-10'].includes(id)) return 'Please sign in or use the Sign Up form. Assigning another volunteer requires an administrator.';
  if (['V-15', 'V-16'].includes(id)) return 'Only an administrator can perform that operation.';
  return expected.length ? `I prepared the requested ${expected[0].action.replace(/_/g, ' ')} action.` : 'Here is the requested scheduling information.';
}

function buildRequest(scenario: typeof scenarios[number]) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (scenario.persona === 'volunteer') headers.Cookie = signedCookie(EMMA);
  if (scenario.persona === 'admin') headers.Cookie = signedCookie(ADMIN);
  return new Request('http://localhost/api/chat', {
    method: 'POST', headers,
    body: JSON.stringify({
      message: scenario.prompt,
      history: scenario.history ?? [],
      services: servicesFor(scenario.id),
      volunteers: scenario.id === 'A-08'
        ? [DEBBIE, { name: 'Debbie Second', email: 'debbie2@example.test', active: true }]
        : [DEBBIE, { name: 'Marcus Example', email: 'marcus@example.test', active: true }],
      sessionId: `top50-${scenario.id}`,
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T12:00:00-04:00'));
  process.env.OPENROUTER_API_KEY = 'top50-test-key';
  process.env.SESSION_SECRET = 'top50-session-secret';
  process.env.ADMIN_EMAILS = ADMIN.email;
});

afterEach(() => {
  if (ORIGINAL_ENV.key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = ORIGINAL_ENV.key;
  if (ORIGINAL_ENV.secret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = ORIGINAL_ENV.secret;
  if (ORIGINAL_ENV.admins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = ORIGINAL_ENV.admins;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('top-50 executable behavioral acceptance matrix', () => {
  it.each(scenarios)('$id [$persona] executes the literal prompt through the production handler', async (scenario) => {
    const planned = ['V-20', 'A-22'].includes(scenario.id) ? null : intendedAction(scenario.id, scenario.expected_actions);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: {
        content: modelText(scenario.id, scenario.expected_actions),
        tool_calls: planned ? [{ function: { name: planned.action, arguments: JSON.stringify(Object.fromEntries(Object.entries(planned).filter(([key]) => key !== 'action'))) } }] : [],
      } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const response = await handler(buildRequest(scenario));
    const body = await response.json();
    const actions = Array.isArray(body.actions) ? body.actions : [];

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(typeof body.text).toBe('string');
    expect(body.text.trim().length).toBeGreaterThan(0);

    if (scenario.deterministic_or_model === 'model') expect(fetchSpy, `${scenario.id} was intercepted before the model boundary`).toHaveBeenCalledOnce();
    else expect(fetchSpy, `${scenario.id} unexpectedly reached the model boundary`).not.toHaveBeenCalled();

    const actualTypes = actions.map((action: { action: string }) => action.action);
    if (scenario.id === 'A-16') {
      expect(actualTypes.length).toBeGreaterThan(0);
      expect(new Set(actualTypes)).toEqual(new Set(['create_service']));
    } else if (['V-20', 'A-22'].includes(scenario.id)) {
      expect(actions).toEqual([]);
      expect(body.text).toMatch(/reply yes|should i|confirm/i);
    } else {
      const expectedTypes = scenario.expected_actions.map(({ action }) => action);
      expect(actualTypes, JSON.stringify(body)).toEqual(expectedTypes);
    }

    if (scenario.persona === 'guest') expect(actions).toEqual([]);
    if (scenario.persona !== 'admin') expect(actions.some((action: { action: string }) => ['assign_volunteer', 'create_service', 'delete_service'].includes(action.action))).toBe(false);

    const serialized = JSON.stringify(body).toLowerCase();
    if (scenario.persona === 'guest') {
      expect(serialized).not.toContain(DEBBIE.email);
      expect(serialized).not.toContain(EMMA.email);
    }
    if (scenario.id === 'A-01') expect(body.text).not.toContain('volunteer matching');
  });
});
