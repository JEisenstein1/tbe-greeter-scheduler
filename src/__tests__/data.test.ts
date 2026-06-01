import { describe, expect, it } from 'vitest';
import { ADMINS, INITIAL_SERVICES, SYNAGOGUE, VOLUNTEERS } from '../data';

describe('seed data', () => {
  it('has Jon configured as the owner/admin', () => {
    expect(ADMINS).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'Owner' }),
    ]));
  });

  it('has a usable volunteer roster', () => {
    expect(VOLUNTEERS.length).toBeGreaterThan(20);
    expect(VOLUNTEERS.every(v => v.active && v.email.includes('@'))).toBe(true);
  });

  it('defines Temple Beth El identity and reminder defaults', () => {
    expect(SYNAGOGUE.name).toBe('Temple Beth El');
    expect(SYNAGOGUE.defaultFridayTime).toBe('6:30 PM');
    expect(SYNAGOGUE.defaultSaturdayTime).toBe('9:30 AM');
  });

  it('seeds services with unique service ids', () => {
    const ids = INITIAL_SERVICES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seeds each service with required fields and slots', () => {
    for (const svc of INITIAL_SERVICES) {
      expect(svc.dateISO).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(svc.date).toBeTruthy();
      expect(svc.time).toBeTruthy();
      expect(svc.type).toBeTruthy();
      expect(svc.slots.length).toBeGreaterThan(0);
    }
  });

  it('includes high holiday services with multi-window slot coverage', () => {
    const hh = INITIAL_SERVICES.filter(s => s.isHH);
    expect(hh.length).toBeGreaterThanOrEqual(3);
    expect(hh.every(s => s.slots.length >= 16)).toBe(true);
  });
});
