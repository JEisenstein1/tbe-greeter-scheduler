import { describe, expect, it } from 'vitest';
import { abbrev, dayNum, fmtDate, groupSlotsByTime, moShort, openCount, statusFor, wdShort } from '../helpers';
import type { Service, Slot } from '../types';

const slot = (id: string, volunteer: string | null = null, timeSlot: string | null = null): Slot => ({
  id,
  role: 'Greeter',
  timeSlot,
  volunteer,
  volunteerEmail: volunteer ? `${volunteer}@example.com` : null,
});

const svc = (slots: Slot[]): Service => ({
  id: 'svc-1',
  dateISO: '2026-06-06',
  date: 'Saturday, June 6',
  time: '9:30 AM',
  type: 'Shabbat Morning',
  isHH: false,
  slots,
});

describe('service staffing helpers', () => {
  it('marks a service with no volunteers as open', () => {
    expect(statusFor(svc([slot('s1'), slot('s2')]))).toEqual({ kind: 'open', label: '2 Open' });
  });

  it('uses singular label for one open slot', () => {
    expect(statusFor(svc([slot('s1')]))).toEqual({ kind: 'open', label: '1 Open' });
  });

  it('marks a partially staffed service', () => {
    expect(statusFor(svc([slot('s1', 'Alice'), slot('s2')]))).toEqual({ kind: 'partial', label: '1 Open' });
  });

  it('marks a fully staffed service', () => {
    expect(statusFor(svc([slot('s1', 'Alice'), slot('s2', 'Bob')]))).toEqual({ kind: 'full', label: 'Fully Staffed' });
  });

  it('counts only unfilled slots as open', () => {
    expect(openCount(svc([slot('s1'), slot('s2', 'Bob'), slot('s3')]))).toBe(2);
  });
});

describe('slot grouping helpers', () => {
  it('groups slots by explicit timeSlot while preserving first-seen order', () => {
    const grouped = groupSlotsByTime([slot('s1', null, '9:30 AM'), slot('s2', null, '10:00 AM'), slot('s3', null, '9:30 AM')]);
    expect(grouped.map(g => g.timeSlot)).toEqual(['9:30 AM', '10:00 AM']);
    expect(grouped[0].slots.map(s => s.id)).toEqual(['s1', 's3']);
  });

  it('groups null time slots together', () => {
    const grouped = groupSlotsByTime([slot('s1'), slot('s2')]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].timeSlot).toBeNull();
    expect(grouped[0].slots.map(s => s.id)).toEqual(['s1', 's2']);
  });
});

describe('date and label helpers', () => {
  it('formats weekday, month and day deterministically', () => {
    expect(wdShort('2026-06-06')).toBe('SAT');
    expect(moShort('2026-06-06')).toBe('JUN');
    expect(dayNum('2026-06-06')).toBe(6);
    expect(fmtDate('2026-06-06')).toBe('Saturday, June 6');
  });

  it('abbreviates known service names', () => {
    expect(abbrev('Kabbalat Shabbat')).toBe('Kab. Shab.');
    expect(abbrev('Shabbat Morning')).toBe('Shab. AM');
    expect(abbrev('Rosh Hashanah Morning')).toBe('Rosh Hash.');
    expect(abbrev('Yom Kippur Morning')).toBe('Yom Kip.');
  });
});
