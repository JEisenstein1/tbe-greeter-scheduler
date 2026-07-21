import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
// @ts-expect-error Production Vercel Edge handler is plain JS.
import handler, { congregationTodayISO, isUpcomingService, serviceMatchesWhen, pickServiceForMessage, userAssignedSlots } from '../../api/chat.js';

const originalEnv = {
  key: process.env.OPENROUTER_API_KEY,
  secret: process.env.SESSION_SECRET,
  admins: process.env.ADMIN_EMAILS,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T12:00:00-04:00'));
});

function cookie(user: { name: string; email: string; role: string }) {
  process.env.SESSION_SECRET = 'behavioral-acceptance-secret';
  const payload = Buffer.from(JSON.stringify({ user: { ...user, source: 'google' }, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
  return `tbe_session=${encodeURIComponent(`${payload}.${signature}`)}`;
}

function service(id: string, dateISO: string, date: string, volunteer: null | { name: string; email: string } = null) {
  return {
    id, dateISO, date, time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false,
    slots: [{ id: `${id}-greeter`, role: 'Greeter', timeSlot: null, volunteer: volunteer?.name ?? null, volunteerEmail: volunteer?.email ?? null }],
  };
}

function request(message: string, persona: 'admin' | 'volunteer', services: unknown[], volunteers: unknown[] = []) {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.ADMIN_EMAILS = 'admin@example.test';
  const user = persona === 'admin'
    ? { name: 'Admin User', email: 'admin@example.test', role: 'admin' }
    : { name: 'Emma Example', email: 'emma@example.test', role: 'volunteer' };
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie(user) },
    body: JSON.stringify({ message, services, volunteers, sessionId: `acceptance-${persona}` }),
  });
}

const fridayServices = [
  service('past-1', '2026-07-10', 'Friday, July 10'),
  service('past-2', '2026-07-17', 'Friday, July 17'),
  service('this-friday', '2026-07-24', 'Friday, July 24'),
  service('next-friday', '2026-07-31', 'Friday, July 31'),
];

const roster = [{ name: 'Dana Example', email: 'dana@example.test', active: true }];

afterEach(() => {
  if (originalEnv.key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalEnv.key;
  if (originalEnv.secret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = originalEnv.secret;
  if (originalEnv.admins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = originalEnv.admins;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('top-50 RED baseline — future-date action selection', () => {
  it('uses the congregation calendar date and filters the fixture directly', () => {
    expect(congregationTodayISO()).toBe('2026-07-20');
    expect(isUpcomingService(fridayServices[0])).toBe(false);
    expect(isUpcomingService(fridayServices[2])).toBe(true);
    expect(serviceMatchesWhen(fridayServices[2], 'this Friday')).toBe(true);
    expect(pickServiceForMessage(fridayServices, 'this Friday')?.id).toBe('this-friday');
  });

  it('A-04 assigns an admin-selected volunteer to the upcoming Friday, never a past Friday', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await handler(request('Add Dana this Friday', 'admin', fridayServices, roster));
    const body = await response.json();

    expect(body.actions).toEqual([{ action: 'assign_volunteer', svcId: 'this-friday', slotId: 'this-friday-greeter', volunteerName: 'Dana Example', volunteerEmail: 'dana@example.test' }]);
    expect(body.text).toContain('Friday, July 24');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('A-05 treats next Friday as the Friday after the upcoming one', async () => {
    vi.spyOn(globalThis, 'fetch');
    const response = await handler(request('Assign Dana next Friday', 'admin', fridayServices, roster));
    const body = await response.json();

    expect(body.actions[0]).toMatchObject({ action: 'assign_volunteer', svcId: 'next-friday', slotId: 'next-friday-greeter' });
    expect(body.text).toContain('Friday, July 31');
  });

  it('V-10 requests coverage for the next upcoming assignment, not an expired one', async () => {
    const assigned = [
      service('past-assignment', '2026-07-10', 'Friday, July 10', { name: 'Emma Example', email: 'emma@example.test' }),
      service('future-assignment', '2026-07-24', 'Friday, July 24', { name: 'Emma Example', email: 'emma@example.test' }),
    ];
    vi.spyOn(globalThis, 'fetch');
    const response = await handler(request('I have a conflict', 'volunteer', assigned));
    const body = await response.json();

    expect(body.actions).toEqual([{ action: 'request_coverage', svcId: 'future-assignment', slotId: 'future-assignment-greeter' }]);
    expect(body.text).toContain('Friday, July 24');
  });
});
