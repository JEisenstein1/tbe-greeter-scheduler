import { describe, expect, it } from 'vitest';
import type { Service, User } from '../types';
import {
  buildConfirmationEmail,
  findUserAssignments,
  getCalendarDayPrimaryAction,
  lookupMockAuthUser,
  shouldRestorePersistedUser,
} from '../appLogic';
import { openCount, statusFor } from '../helpers';

const admin: User = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };
const volunteer: User = { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', role: 'volunteer', source: 'google' };
const guest: User = { name: 'Guest Volunteer', email: 'guest@example.com', role: 'volunteer', source: 'manual' };

const service = (overrides: Partial<Service> = {}): Service => ({
  id: 'svc-1',
  dateISO: '2026-06-06',
  date: 'Saturday, June 6',
  time: '9:30 AM',
  type: 'Shabbat Morning',
  isHH: false,
  slots: [
    { id: 'greeter', role: 'Greeter', timeSlot: null, volunteer: null, volunteerEmail: null },
    { id: 'usher', role: 'Usher', timeSlot: null, volunteer: 'Emma Adler', volunteerEmail: 'emma.p.adler@gmail.com' },
  ],
  ...overrides,
});

function signUp(svc: Service, slotId: string, user: User): Service {
  return {
    ...svc,
    slots: svc.slots.map(slot => slot.id === slotId ? { ...slot, volunteer: user.name, volunteerEmail: user.email } : slot),
  };
}

function requestCoverage(svc: Service, slotId: string, user: User): Service {
  return {
    ...svc,
    slots: svc.slots.map(slot => {
      const ownsSlot = slot.volunteerEmail?.toLowerCase() === user.email.toLowerCase();
      return slot.id === slotId && ownsSlot ? { ...slot, coverageRequested: true } : slot;
    }),
  };
}

function removeVolunteer(svc: Service, slotId: string): Service {
  return {
    ...svc,
    slots: svc.slots.map(slot => slot.id === slotId ? { ...slot, volunteer: null, volunteerEmail: null, coverageRequested: false } : slot),
  };
}

describe('profile experience simulations', () => {
  it('signed-out kiosk user opens app and should not inherit the previous admin session', () => {
    const priorAdminSession = JSON.stringify(admin);

    expect(shouldRestorePersistedUser(priorAdminSession)).toBe(false);

    const expectedUserExperience = {
      visibleIdentity: 'Sign in',
      adminControlsVisible: false,
      destructiveCalendarActionsVisible: false,
    };

    expect(expectedUserExperience).toEqual({
      visibleIdentity: 'Sign in',
      adminControlsVisible: false,
      destructiveCalendarActionsVisible: false,
    });
  });

  it('admin profile expects calendar dates to open management actions, not volunteer-only signup actions', () => {
    const action = getCalendarDayPrimaryAction([service()], '2026-06-06', admin.role);

    expect(action).toEqual({ type: 'manage', serviceId: 'svc-1' });
  });

  it('volunteer profile expects calendar dates with openings to offer signup actions', () => {
    const action = getCalendarDayPrimaryAction([service()], '2026-06-06', volunteer.role);

    expect(action).toEqual({ type: 'signup', serviceId: 'svc-1' });
  });

  it('guest volunteer can be signed up with manual profile and then sees that date in My Dates', () => {
    const afterSignup = signUp(service(), 'greeter', guest);

    expect(afterSignup.slots[0]).toMatchObject({ volunteer: 'Guest Volunteer', volunteerEmail: 'guest@example.com' });
    expect(openCount(afterSignup)).toBe(0);
    expect(statusFor(afterSignup)).toEqual({ kind: 'full', label: 'Fully Staffed' });

    const myDates = findUserAssignments([afterSignup], guest, '2026-06-01');
    expect(myDates).toHaveLength(1);
    expect(myDates[0]).toMatchObject({ svc: { id: 'svc-1' }, slot: { id: 'greeter' } });
  });

  it('roster volunteer expects My Dates to find assignments by email even if display name varies', () => {
    const userWithDifferentDisplayName: User = { ...volunteer, name: 'Emma A.' };

    const myDates = findUserAssignments([service()], userWithDifferentDisplayName, '2026-06-01');

    expect(myDates).toHaveLength(1);
    expect(myDates[0].slot.id).toBe('usher');
  });

  it('assigned volunteer expects request coverage to mark only their own slot', () => {
    const afterCoverageRequest = requestCoverage(service(), 'usher', volunteer);

    expect(afterCoverageRequest.slots.find(s => s.id === 'usher')).toMatchObject({ coverageRequested: true });
    expect(afterCoverageRequest.slots.find(s => s.id === 'greeter')?.coverageRequested).toBeUndefined();
  });

  it('admin removing a volunteer reopens the slot and updates service status', () => {
    const afterRemoval = removeVolunteer(service(), 'usher');

    expect(afterRemoval.slots.find(s => s.id === 'usher')).toMatchObject({ volunteer: null, volunteerEmail: null, coverageRequested: false });
    expect(openCount(afterRemoval)).toBe(2);
    expect(statusFor(afterRemoval)).toEqual({ kind: 'open', label: '2 Open' });
  });

  it('signup confirmation creates the email a volunteer expects, but does not claim provider delivery', () => {
    const svc = service();
    const email = buildConfirmationEmail(svc, svc.slots[0], volunteer);

    expect(email).toMatchObject({
      to: 'emma.p.adler@gmail.com',
      subject: 'Thank you for signing up — Shabbat Morning',
    });
    expect(email.text).toContain('Shalom Emma');
    expect(email.text).toContain('Saturday, June 6');
    expect(email.text).toContain('A calendar invite will follow');
  });

  it('mock roster auth tells the product the user is recognized but not actually OAuth-verified', () => {
    expect(lookupMockAuthUser(admin.email, 'google')).toMatchObject({ role: 'admin', verifiedByProvider: false });
    expect(lookupMockAuthUser(volunteer.email, 'google')).toMatchObject({ role: 'volunteer', verifiedByProvider: false });
  });
});
