import type { Service, Volunteer, Admin, Synagogue, Slot } from './types';

export const VOLUNTEERS: Volunteer[] = [
  { name: 'Sarah Goldberg',   email: 'sgoldberg@gmail.com',  active: true,  joined: '2024-09-10', servedCount: 12 },
  { name: 'Daniel Levin',     email: 'dlevin@gmail.com',     active: true,  joined: '2023-03-22', servedCount: 27 },
  { name: 'Miriam Katz',      email: 'mkatz@gmail.com',      active: true,  joined: '2025-01-04', servedCount: 5 },
  { name: 'Aaron Feldman',    email: 'afeldman@gmail.com',   active: true,  joined: '2022-08-15', servedCount: 41 },
  { name: 'Rachel Stein',     email: 'rstein@gmail.com',     active: true,  joined: '2024-11-30', servedCount: 8 },
  { name: 'Joshua Cohen',     email: 'jcohen@gmail.com',     active: true,  joined: '2023-06-18', servedCount: 19 },
  { name: 'Hannah Bernstein', email: 'hbernstein@gmail.com', active: true,  joined: '2024-02-12', servedCount: 14 },
  { name: 'Eli Rosen',        email: 'erosen@gmail.com',     active: true,  joined: '2022-12-03', servedCount: 33 },
  { name: 'Naomi Friedman',   email: 'nfriedman@gmail.com',  active: false, joined: '2021-05-09', servedCount: 52 },
  { name: 'Benjamin Klein',   email: 'bklein@gmail.com',     active: true,  joined: '2025-03-21', servedCount: 3 },
];

export const ADMINS: Admin[] = [
  { name: 'Rabbi David Mendel', email: 'rabbi@tbe.org',      role: 'Owner', joined: '2020-01-01', source: 'google'   },
  { name: 'Rebecca Schwartz',   email: 'rschwartz@tbe.org',  role: 'Admin', joined: '2022-04-18', source: 'password' },
  { name: 'Michael Greenberg',  email: 'mgreenberg@tbe.org', role: 'Admin', joined: '2023-09-04', source: 'google'   },
];

export const SYNAGOGUE: Synagogue = {
  name: 'Temple Beth El',
  address: '1820 Eastover Drive, Charlotte, NC 28207',
  defaultFridayTime: '6:30 PM',
  defaultSaturdayTime: '9:30 AM',
  reminderDay: 'Monday',
  reminderHour: '8:00 AM',
  integrations: {
    gmail: { connected: true, account: 'office@tbe.org' },
    gcal:  { connected: true, account: 'office@tbe.org' },
  },
};

let __sid = 1;
const slot = (role: string, timeSlot: string | null = null, volunteer: string | null = null, volunteerEmail: string | null = null): Slot => ({
  id: 's' + (__sid++),
  role, timeSlot, volunteer, volunteerEmail,
});

const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

let __id = 1;
const mkService = (dateISO: string, time: string, type: string, slots: Slot[], isHH = false): Service => ({
  id: __id++,
  dateISO, date: fmtDate(dateISO), time, type, isHH, slots,
});

const friShabbat = (iso: string, filled?: { name: string; email: string }): Service =>
  mkService(iso, '6:30 PM', 'Kabbalat Shabbat',
    [slot('Greeter', null, filled?.name ?? null, filled?.email ?? null)]);

const satShabbat = (iso: string, filled?: { name: string; email: string }): Service =>
  mkService(iso, '9:30 AM', 'Shabbat Morning',
    [slot('Greeter', null, filled?.name ?? null, filled?.email ?? null)]);

const hhWindows = (windows: string[], filledMap: Record<string, { name: string; email: string }> = {}): Slot[] => {
  const out: Slot[] = [];
  windows.forEach(w => {
    ['Greeter 1', 'Greeter 2', 'Usher 1', 'Usher 2'].forEach(role => {
      const key = `${w}|${role}`;
      const f = filledMap[key];
      out.push(slot(role, w, f?.name ?? null, f?.email ?? null));
    });
  });
  return out;
};

export const INITIAL_SERVICES: Service[] = [
  mkService('2026-05-01', '6:30 PM', 'Kabbalat Shabbat',
    [slot('Greeter', null, 'Sarah Goldberg', 'sgoldberg@gmail.com')]),
  mkService('2026-05-02', '9:30 AM', 'Shabbat Morning',
    [slot('Greeter', null, 'Daniel Levin', 'dlevin@gmail.com')]),

  friShabbat('2026-05-08'),
  satShabbat('2026-05-09', { name: 'Miriam Katz', email: 'mkatz@gmail.com' }),

  friShabbat('2026-05-15'),
  satShabbat('2026-05-16'),

  mkService('2026-05-22', '8:00 PM – 10:00 PM', 'Erev Shavuot',
    hhWindows(['8:00 PM – 8:30 PM', '8:30 PM – 9:00 PM'], {
      '8:00 PM – 8:30 PM|Greeter 1': { name: 'Aaron Feldman',  email: 'afeldman@gmail.com' },
      '8:00 PM – 8:30 PM|Usher 1':   { name: 'Rachel Stein',   email: 'rstein@gmail.com' },
    }),
    true
  ),
  mkService('2026-05-23', '9:30 AM', 'Shavuot Morning',
    [slot('Greeter', null, 'Joshua Cohen', 'jcohen@gmail.com')]),

  friShabbat('2026-05-29'),
  satShabbat('2026-05-30'),

  friShabbat('2026-06-05', { name: 'Hannah Bernstein', email: 'hbernstein@gmail.com' }),
  satShabbat('2026-06-06'),
  friShabbat('2026-06-12'),
  satShabbat('2026-06-13', { name: 'Eli Rosen', email: 'erosen@gmail.com' }),
  friShabbat('2026-06-19'),
  satShabbat('2026-06-20'),

  mkService('2026-09-12', '9:00 AM – 1:00 PM', 'Rosh Hashanah Morning',
    hhWindows([
      '9:00 AM – 9:30 AM',
      '9:30 AM – 10:00 AM',
      '10:00 AM – 10:30 AM',
      '10:30 AM – 11:00 AM',
    ]),
    true
  ),
];
