import { describe, expect, it } from 'vitest';
import type { Service, User } from '../types';
import {
  SCHEMA_SQL,
  applySignup,
  assertCanMutateSlot,
  normalizeEmail,
  roleForEmail,
  serializeServiceForDb,
} from '../backend/db';

const service = (): Service => ({
  id: 'svc-1',
  dateISO: '2026-06-06',
  date: 'Saturday, June 6',
  time: '9:30 AM',
  type: 'Shabbat Morning',
  isHH: false,
  slots: [
    { id: 'slot-open', role: 'Greeter', timeSlot: null, volunteer: null, volunteerEmail: null },
    { id: 'slot-filled', role: 'Usher', timeSlot: null, volunteer: 'Emma Adler', volunteerEmail: 'emma.p.adler@gmail.com' },
  ],
});

const admin: User = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };
const volunteer: User = { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', role: 'volunteer', source: 'google' };
const otherVolunteer: User = { name: 'Other Person', email: 'other@example.com', role: 'volunteer', source: 'google' };

describe('production database/auth foundation', () => {
  it('defines the persistent tables needed for real app state and auditability', () => {
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS services');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS slots');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS email_delivery_log');
    expect(SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS audit_log');
    expect(SCHEMA_SQL).toContain('REFERENCES services(id) ON DELETE CASCADE');
  });

  it('normalizes emails before role lookup and assignment storage', () => {
    expect(normalizeEmail(' Jon.Eisenstein@GMAIL.COM ')).toBe('jon.eisenstein@gmail.com');
    expect(roleForEmail(' Jon.Eisenstein@GMAIL.COM ', 'jon.eisenstein@gmail.com,admin@example.com')).toBe('admin');
    expect(roleForEmail('emma.p.adler@gmail.com', 'jon.eisenstein@gmail.com')).toBe('volunteer');
  });

  it('allows volunteers to sign up only for open slots', () => {
    expect(() => assertCanMutateSlot(volunteer, service().slots[0], 'signup')).not.toThrow();
    expect(() => assertCanMutateSlot(volunteer, service().slots[1], 'signup')).toThrow('SLOT_ALREADY_FILLED');
  });

  it('allows volunteers to request coverage or remove only their own slots', () => {
    expect(() => assertCanMutateSlot(volunteer, service().slots[1], 'request_coverage')).not.toThrow();
    expect(() => assertCanMutateSlot(otherVolunteer, service().slots[1], 'request_coverage')).toThrow('FORBIDDEN');
    expect(() => assertCanMutateSlot(otherVolunteer, service().slots[1], 'remove')).toThrow('FORBIDDEN');
  });

  it('allows admins to mutate any slot server-side', () => {
    expect(() => assertCanMutateSlot(admin, service().slots[1], 'admin_assign')).not.toThrow();
    expect(() => assertCanMutateSlot(admin, service().slots[1], 'remove')).not.toThrow();
  });

  it('serializes current in-memory service data into DB rows', () => {
    const rows = serializeServiceForDb(service());

    expect(rows[0]).toMatchObject({ table: 'services', id: 'svc-1', date_iso: '2026-06-06' });
    expect(rows[1]).toMatchObject({ table: 'slots', service_id: 'svc-1', id: 'slot-open' });
    expect(rows[2]).toMatchObject({ table: 'slots', service_id: 'svc-1', volunteer_email: 'emma.p.adler@gmail.com' });
  });

  it('applies signup as the service mutation expected from a future persistent API', () => {
    const updated = applySignup(service(), 'slot-open', { name: 'Emma Adler', email: 'Emma.P.Adler@GMAIL.COM' });

    expect(updated.slots[0]).toMatchObject({
      volunteer: 'Emma Adler',
      volunteerEmail: 'emma.p.adler@gmail.com',
      coverageRequested: false,
    });
  });
});
