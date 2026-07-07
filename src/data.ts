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

const slot = (id: string, role: string, timeSlot: string | null = null): Slot => ({
  id, role, timeSlot, volunteer: null, volunteerEmail: null,
});

const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const mkService = (id: string, dateISO: string, time: string, type: string, slots: Slot[], isHH = false): Service => ({
  id, dateISO, date: fmtDate(dateISO), time, type, isHH, slots,
});

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Weekly Shabbat services generated relative to a reference date so the demo
// fixture never goes stale: one past weekend (exercises the collapsed-past UI)
// plus `futureWeekends` upcoming Friday/Saturday pairs. Deterministic date-based
// ids keep the fixture aligned with the string ids the database path uses.
export function buildShabbatServices(todayISO: string, pastWeekends = 1, futureWeekends = 9): Service[] {
  const today = new Date(todayISO + 'T12:00:00');
  const friday = new Date(today);
  friday.setDate(friday.getDate() - ((friday.getDay() - 5 + 7) % 7) - pastWeekends * 7);
  const out: Service[] = [];
  for (let w = 0; w < pastWeekends + futureWeekends; w++) {
    const fri = new Date(friday); fri.setDate(fri.getDate() + w * 7);
    const sat = new Date(fri);    sat.setDate(sat.getDate() + 1);
    const friISO = isoOf(fri), satISO = isoOf(sat);
    out.push(mkService(`fri-${friISO}`, friISO, SYNAGOGUE.defaultFridayTime, 'Kabbalat Shabbat', [slot(`fri-${friISO}-s1`, 'Greeter')]));
    out.push(mkService(`sat-${satISO}`, satISO, SYNAGOGUE.defaultSaturdayTime, 'Shabbat Morning', [slot(`sat-${satISO}-s1`, 'Greeter')]));
  }
  return out;
}

const hhWindows = (svcId: string, windows: string[]): Slot[] => {
  let n = 1;
  return windows.flatMap(w =>
    ['Greeter 1', 'Greeter 2', 'Usher 1', 'Usher 2'].map(role => slot(`${svcId}-s${n++}`, role, w))
  );
};

const HH_WINDOWS = ['9:00 AM – 9:30 AM', '9:30 AM – 10:00 AM', '10:00 AM – 10:30 AM', '10:30 AM – 11:00 AM'];

export const HIGH_HOLIDAY_SERVICES: Service[] = [
  mkService('hh-2026-09-20', '2026-09-20', '9:00 AM – 1:00 PM', 'Rosh Hashanah Morning', hhWindows('hh-2026-09-20', HH_WINDOWS), true),
  mkService('hh-2026-09-22', '2026-09-22', '9:00 AM – 1:00 PM', 'Rosh Hashanah Second Day', hhWindows('hh-2026-09-22', HH_WINDOWS), true),
  mkService('hh-2026-09-29', '2026-09-29', '9:00 AM – 1:00 PM', 'Yom Kippur Morning', hhWindows('hh-2026-09-29', HH_WINDOWS), true),
];

export const INITIAL_SERVICES: Service[] = [
  ...buildShabbatServices(isoOf(new Date())),
  ...HIGH_HOLIDAY_SERVICES,
].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
