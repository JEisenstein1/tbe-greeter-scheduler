import type { Service, Volunteer, Admin, Synagogue, Slot } from './types';

export const VOLUNTEERS: Volunteer[] = [
  { name: 'Emma Adler',           email: 'emma.p.adler@gmail.com',              active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Debbie Adler-Klein',   email: 'dakmd75@gmail.com',                   active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Alan Benet',           email: 'ajbenet@ajbenet.com',                 active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Melody Bryant',        email: 'melodybryant@gmail.com',              active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Jeff Cohen',           email: 'jcohen@sillerandcohen.com',           active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Kahla Cooper',         email: 'kahlacooper@gmail.com',               active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Amy Davidson',         email: 'adavidson303@gmail.com',              active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Melissa Dreyfus',      email: 'melissa.dreyfus@gmail.com',           active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Sue Frieden',          email: 'susanfrieden8@gmail.com',             active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Stan Friedman',        email: 'stanf@optonline.net',                 active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Suzanne Fruithandler', email: 'ctfruit@gmail.com',                   active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Leslie Glenn',         email: 'leslierglenn@gmail.com',              active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Michael Handel',       email: 'mhandel@yahoo.com',                   active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Juli Harris',          email: 'jaharris99@aol.com',                  active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Dana Horowitz',        email: 'danalhorowitz@gmail.com',             active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Devra Jaffe-Berkowitz',email: 'devrajaffe@gmail.com',                active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Nancy Kapchan',        email: 'MorahNancy1958@gmail.com',            active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Vicki Kobliner',       email: 'vkobliner@gmail.com',                 active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Erica Kraypohl',       email: 'erica.kraypohl@gmail.com',            active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Scott Krowitz',        email: 'scott.krowitz@gmail.com',             active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Gary Lessen',          email: 'garylnyy44@gmail.com',                active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Lisa Manheim',         email: 'Lisago1@gmail.com',                   active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Naomi Marks',          email: 'nsobel@hotmail.com',                  active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Chris Maroc',          email: 'Chris.Maroc@coldwellbankermoves.com', active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Marsha Matthews',      email: 'mm12169@yahoo.com',                   active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Jonathan Phair',       email: 'jonathan.phair@gmail.com',            active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Sylvan Pomerantz',     email: 'sylvan@csgroupct.com',                active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Joyce Resnick',        email: 'joyres@aol.com',                      active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Karen Resnick',        email: 'kmr925@sbcglobal.net',                active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Sol Rose',             email: 'Solrose1@gmail.com',                  active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Julie Rosenberg',      email: 'Julierosenbergslp@gmail.com',         active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Joan Rosenthal',       email: 'JoanDoc@optonline.net',               active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Eileen Rosner',        email: 'rosnereileen@gmail.com',              active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Irma Ross',            email: 'irmaross@yahoo.com',                  active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Barbara Rothstein',    email: 'brothstein320@gmail.com',             active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Carl Shapiro',         email: 'cshapiro@optonline.net',              active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Eric Sigman',          email: 'esigman1@gmail.com',                  active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Marilyn Sofer',        email: 'mgsofer@gmail.com',                   active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Jeff Turshen',         email: 'jturshen@aol.com',                    active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Carl Weinberg',        email: 'carlrw99@gmail.com',                  active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Mia Weinstein',        email: 'miamweinstein@gmail.com',             active: true, joined: '2024-01-01', servedCount: 0 },
  { name: 'Ron Zussman',          email: 'rmzussman@gmail.com',                 active: true, joined: '2024-01-01', servedCount: 0 },
];

export const ADMINS: Admin[] = [
  { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'Owner', joined: '2024-01-01', source: 'google' },
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

const friShabbat = (iso: string): Service =>
  mkService(iso, '6:30 PM', 'Kabbalat Shabbat', [slot('Greeter')]);

const satShabbat = (iso: string): Service =>
  mkService(iso, '9:30 AM', 'Shabbat Morning', [slot('Greeter')]);

const hhWindows = (windows: string[]): Slot[] =>
  windows.flatMap(w =>
    ['Greeter 1', 'Greeter 2', 'Usher 1', 'Usher 2'].map(role => slot(role, w))
  );

export const INITIAL_SERVICES: Service[] = [
  friShabbat('2026-05-29'),
  satShabbat('2026-05-30'),

  friShabbat('2026-06-05'),
  satShabbat('2026-06-06'),
  friShabbat('2026-06-12'),
  satShabbat('2026-06-13'),
  friShabbat('2026-06-19'),
  satShabbat('2026-06-20'),
  friShabbat('2026-06-26'),
  satShabbat('2026-06-27'),

  mkService('2026-09-20', '9:00 AM – 1:00 PM', 'Rosh Hashanah Morning',
    hhWindows(['9:00 AM – 9:30 AM', '9:30 AM – 10:00 AM', '10:00 AM – 10:30 AM', '10:30 AM – 11:00 AM']),
    true
  ),
  mkService('2026-09-22', '9:00 AM – 1:00 PM', 'Rosh Hashanah Second Day',
    hhWindows(['9:00 AM – 9:30 AM', '9:30 AM – 10:00 AM', '10:00 AM – 10:30 AM', '10:30 AM – 11:00 AM']),
    true
  ),
  mkService('2026-09-29', '9:00 AM – 1:00 PM', 'Yom Kippur Morning',
    hhWindows(['9:00 AM – 9:30 AM', '9:30 AM – 10:00 AM', '10:00 AM – 10:30 AM', '10:30 AM – 11:00 AM']),
    true
  ),
];
