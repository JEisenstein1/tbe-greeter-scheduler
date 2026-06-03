import { describe, expect, it } from 'vitest';
import type { Service, User } from '../types';
import {
  findUserAssignments,
  shouldRestorePersistedUser,
  lookupMockAuthUser,
  buildConfirmationEmail,
  getCalendarDayPrimaryAction,
} from '../appLogic';

const svc = (overrides: Partial<Service> = {}): Service => ({
  id: 'svc-1',
  dateISO: '2026-06-06',
  date: 'Saturday, June 6',
  time: '9:30 AM',
  type: 'Shabbat Morning',
  isHH: false,
  slots: [
    { id: 's1', role: 'Greeter', timeSlot: null, volunteer: 'Jon Eisenstein', volunteerEmail: 'jon.eisenstein@gmail.com' },
    { id: 's2', role: 'Usher', timeSlot: null, volunteer: null, volunteerEmail: null },
  ],
  ...overrides,
});

describe('reported app behavior regressions', () => {
  it('does not silently restore a persisted user on public app load', () => {
    const persisted: User = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };

    expect(shouldRestorePersistedUser(JSON.stringify(persisted))).toBe(false);
    expect(shouldRestorePersistedUser(null)).toBe(false);
  });

  it('labels current Google/password sign-in as mock auth rather than validated OAuth', () => {
    const result = lookupMockAuthUser('jon.eisenstein@gmail.com', 'google');

    expect(result).toMatchObject({
      name: 'Jon Eisenstein',
      email: 'jon.eisenstein@gmail.com',
      role: 'admin',
      source: 'google',
      verifiedByProvider: false,
    });
  });

  it('finds My Dates assignments by signed-in user email, not only exact display name', () => {
    const user: User = { name: 'Jonathan Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'volunteer', source: 'manual' };

    const matches = findUserAssignments([svc()], user, '2026-06-01');

    expect(matches).toHaveLength(1);
    expect(matches[0].slot.id).toBe('s1');
  });

  it('finds My Dates assignments by case-insensitive lookup query against name or email', () => {
    expect(findUserAssignments([svc()], null, '2026-06-01', 'JON.EISENSTEIN@GMAIL.COM')).toHaveLength(1);
    expect(findUserAssignments([svc()], null, '2026-06-01', 'eisenstein')).toHaveLength(1);
  });

  it('builds a real confirmation email payload addressed to the volunteer', () => {
    const email = buildConfirmationEmail(svc(), svc().slots[0], { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com' });

    expect(email.to).toBe('jon.eisenstein@gmail.com');
    expect(email.subject).toContain('Shabbat Morning');
    expect(email.text).toContain('Jon');
    expect(email.text).toContain('Saturday, June 6');
    expect(email.text).toContain('9:30 AM');
  });

  it('calendar date click exposes signup action for volunteers and admin edit action for admins', () => {
    expect(getCalendarDayPrimaryAction([svc()], '2026-06-06', 'volunteer')).toEqual({ type: 'signup', serviceId: 'svc-1' });
    expect(getCalendarDayPrimaryAction([svc()], '2026-06-06', 'admin')).toEqual({ type: 'manage', serviceId: 'svc-1' });
    expect(getCalendarDayPrimaryAction([svc()], '2026-06-07', 'volunteer')).toEqual({ type: 'none' });
  });
});
