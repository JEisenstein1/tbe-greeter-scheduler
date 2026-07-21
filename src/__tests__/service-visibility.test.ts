import { describe, expect, it } from 'vitest';
import { findUserAssignments } from '../appLogic';
import type { Service, User } from '../types';
// @ts-expect-error Vercel helper is plain JS.
import { servicesForViewer } from '../../lib/service-visibility.js';

const services = [{
  id: 'svc-1',
  dateISO: '2026-08-01',
  date: 'Saturday, August 1',
  time: '9:30 AM',
  type: 'Shabbat Morning',
  isHH: false,
  slots: [{
    id: 'slot-1',
    role: 'Greeter',
    volunteer: 'Private Volunteer',
    volunteerEmail: 'private@example.org',
    coverageRequested: true,
  }],
}];

describe('service API role-based visibility', () => {
  it('gives guests occupancy without roster identity or coverage metadata', () => {
    const slot = servicesForViewer(services, 'guest')[0].slots[0];
    expect(slot).toMatchObject({ volunteer: 'FILLED', volunteerEmail: null, coverageRequested: false });
  });

  it('lets logged-in volunteers see assigned names but never contact details', () => {
    const slot = servicesForViewer(services, 'volunteer')[0].slots[0];
    expect(slot).toMatchObject({ volunteer: 'Private Volunteer', volunteerEmail: null, coverageRequested: true });
  });

  it('preserves only the signed-in volunteer’s own email so exact assignment matching still works', () => {
    const user: User = { name: 'Different Display Name', email: 'private@example.org', role: 'volunteer', source: 'google' };
    const projected = servicesForViewer(services, 'volunteer', user.email) as Service[];
    expect(projected[0].slots[0].volunteerEmail).toBe(user.email);
    expect(findUserAssignments(projected, user, '2026-07-21')).toHaveLength(1);
  });

  it('keeps full assignment details for admins', () => {
    const slot = servicesForViewer(services, 'admin')[0].slots[0];
    expect(slot).toMatchObject({ volunteer: 'Private Volunteer', volunteerEmail: 'private@example.org', coverageRequested: true });
  });
});
