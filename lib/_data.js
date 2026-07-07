// Seed fixture for an empty database and the no-DB fallback of /api/services.
// Weekly Shabbat services are generated relative to today so a fresh deploy
// always has upcoming sign-up opportunities. Mirrors src/data.ts.

function slot(id, role, timeSlot = null) { return { id, role, timeSlot, volunteer: null, volunteerEmail: null, coverageRequested: false }; }
function fmtDate(iso) { return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function service(id, dateISO, time, type, slots, isHH = false) { return { id, dateISO, date: fmtDate(dateISO), time, type, isHH, slots }; }
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export function buildShabbatServices(todayISO, pastWeekends = 1, futureWeekends = 9) {
  const today = new Date(`${todayISO}T12:00:00`);
  const friday = new Date(today);
  friday.setDate(friday.getDate() - ((friday.getDay() - 5 + 7) % 7) - pastWeekends * 7);
  const out = [];
  for (let w = 0; w < pastWeekends + futureWeekends; w++) {
    const fri = new Date(friday); fri.setDate(fri.getDate() + w * 7);
    const sat = new Date(fri);    sat.setDate(sat.getDate() + 1);
    const friISO = isoOf(fri), satISO = isoOf(sat);
    out.push(service(`fri-${friISO}`, friISO, '6:30 PM', 'Kabbalat Shabbat', [slot(`fri-${friISO}-s1`, 'Greeter')]));
    out.push(service(`sat-${satISO}`, satISO, '9:30 AM', 'Shabbat Morning', [slot(`sat-${satISO}-s1`, 'Greeter')]));
  }
  return out;
}

function hh(svcId, windows) {
  let n = 1;
  const roles = ['Greeter 1', 'Greeter 2', 'Usher 1', 'Usher 2'];
  return windows.flatMap(w => roles.map(role => slot(`${svcId}-s${n++}`, role, w)));
}

const HH_WINDOWS = ['9:00 AM – 9:30 AM', '9:30 AM – 10:00 AM', '10:00 AM – 10:30 AM', '10:30 AM – 11:00 AM'];

export const HIGH_HOLIDAY_SERVICES = [
  service('hh-2026-09-20', '2026-09-20', '9:00 AM – 1:00 PM', 'Rosh Hashanah Morning', hh('hh-2026-09-20', HH_WINDOWS), true),
  service('hh-2026-09-22', '2026-09-22', '9:00 AM – 1:00 PM', 'Rosh Hashanah Second Day', hh('hh-2026-09-22', HH_WINDOWS), true),
  service('hh-2026-09-29', '2026-09-29', '9:00 AM – 1:00 PM', 'Yom Kippur Morning', hh('hh-2026-09-29', HH_WINDOWS), true),
];

export const INITIAL_SERVICES = [
  ...buildShabbatServices(isoOf(new Date())),
  ...HIGH_HOLIDAY_SERVICES,
].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
