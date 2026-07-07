import { describe, expect, it } from 'vitest';
import type { Service } from '../types';
import {
  applyAssignVolunteer,
  applyRemoveSignup,
  applyRequestCoverage,
  isSlotForUser,
  findUserAssignments,
  sameId,
} from '../appLogic';
import { buildShabbatServices, INITIAL_SERVICES } from '../data';

// Regressions fixed in the 2026-07-07 audit (docs/fable5-audit-20260707.md).

function fixtureService(id: Service['id']): Service {
  return {
    id, dateISO: '2026-07-10', date: 'Friday, July 10', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false,
    slots: [
      { id: 's1', role: 'Greeter', timeSlot: null, volunteer: null, volunteerEmail: null },
      { id: 's2', role: 'Usher', timeSlot: null, volunteer: 'Sue Frieden', volunteerEmail: 'susanfrieden8@gmail.com', coverageRequested: true },
    ],
  };
}

describe('service id coercion — AI actions vs numeric fixture ids', () => {
  it('sameId matches across number/string representations', () => {
    expect(sameId(3, '3')).toBe(true);
    expect(sameId('3', 3)).toBe(true);
    expect(sameId(3, '4')).toBe(false);
  });

  it('applyAssignVolunteer fills the slot when svcId arrives as a string for a numeric service id', () => {
    const after = applyAssignVolunteer([fixtureService(3)], '3', 's1', { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' });
    expect(after[0].slots[0].volunteer).toBe('Emma Adler');
  });

  it('applyRemoveSignup and applyRequestCoverage also match loosely', () => {
    const removed = applyRemoveSignup([fixtureService(7)], '7', 's2');
    expect(removed[0].slots[1].volunteer).toBeNull();

    const covered = applyRequestCoverage([fixtureService(7)], '7', 's2');
    expect(covered[0].slots[1].coverageRequested).toBe(true);
  });
});

describe('assigning a volunteer resolves an open coverage request (matches backend)', () => {
  it('clears coverageRequested on the filled slot only', () => {
    const after = applyAssignVolunteer([fixtureService('svc-1')], 'svc-1', 's2', { name: 'Carl Shapiro', email: 'cshapiro@optonline.net' });
    expect(after[0].slots[1]).toMatchObject({ volunteer: 'Carl Shapiro', coverageRequested: false });
    expect(after[0].slots[0].coverageRequested).toBeUndefined();
  });
});

describe('signed-out My Dates lookup privacy', () => {
  const slot = { id: 's2', role: 'Usher', timeSlot: null, volunteer: 'Sue Frieden', volunteerEmail: 'susanfrieden8@gmail.com' };

  it('still matches by name substring and exact email', () => {
    expect(isSlotForUser(slot, null, 'sue')).toBe(true);
    expect(isSlotForUser(slot, null, 'Susanfrieden8@gmail.com')).toBe(true);
  });

  it('does not let a partial-email query enumerate assignments', () => {
    expect(isSlotForUser(slot, null, 'gmail')).toBe(false);
    expect(isSlotForUser(slot, null, '@')).toBe(false);

    const matches = findUserAssignments([fixtureService('svc-1')], null, '2026-01-01', 'gmail.com');
    expect(matches).toHaveLength(0);
  });
});

describe('evergreen shabbat fixture', () => {
  it('generates Friday/Saturday pairs around a reference date with deterministic ids', () => {
    const services = buildShabbatServices('2026-07-07', 1, 2);
    expect(services.map(s => s.id)).toEqual([
      'fri-2026-06-26', 'sat-2026-06-27',
      'fri-2026-07-03', 'sat-2026-07-04',
      'fri-2026-07-10', 'sat-2026-07-11',
    ]);
    expect(services.every(s => s.slots.length === 1 && s.slots[0].role === 'Greeter')).toBe(true);
    expect(new Set(services.flatMap(s => s.slots.map(sl => sl.id))).size).toBe(services.length);
  });

  it('keeps INITIAL_SERVICES stocked with upcoming weekly services relative to today', () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const upcomingWeekly = INITIAL_SERVICES.filter(s => !s.isHH && s.dateISO >= todayISO);
    expect(upcomingWeekly.length).toBeGreaterThanOrEqual(8);
  });
});
