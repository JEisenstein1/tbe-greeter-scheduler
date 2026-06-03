export const INITIAL_SERVICES = [
  service('1','2026-05-29','6:30 PM','Kabbalat Shabbat',[slot('s1','Greeter')]),
  service('2','2026-05-30','9:30 AM','Shabbat Morning',[slot('s2','Greeter')]),
  service('3','2026-06-05','6:30 PM','Kabbalat Shabbat',[slot('s3','Greeter')]),
  service('4','2026-06-06','9:30 AM','Shabbat Morning',[slot('s4','Greeter')]),
  service('5','2026-06-12','6:30 PM','Kabbalat Shabbat',[slot('s5','Greeter')]),
  service('6','2026-06-13','9:30 AM','Shabbat Morning',[slot('s6','Greeter')]),
  service('7','2026-06-19','6:30 PM','Kabbalat Shabbat',[slot('s7','Greeter')]),
  service('8','2026-06-20','9:30 AM','Shabbat Morning',[slot('s8','Greeter')]),
  service('9','2026-06-26','6:30 PM','Kabbalat Shabbat',[slot('s9','Greeter')]),
  service('10','2026-06-27','9:30 AM','Shabbat Morning',[slot('s10','Greeter')]),
  service('11','2026-09-20','9:00 AM – 1:00 PM','Rosh Hashanah Morning',hh('s11', ['9:00 AM – 9:30 AM','9:30 AM – 10:00 AM','10:00 AM – 10:30 AM','10:30 AM – 11:00 AM']), true),
  service('12','2026-09-22','9:00 AM – 1:00 PM','Rosh Hashanah Second Day',hh('s27', ['9:00 AM – 9:30 AM','9:30 AM – 10:00 AM','10:00 AM – 10:30 AM','10:30 AM – 11:00 AM']), true),
  service('13','2026-09-29','9:00 AM – 1:00 PM','Yom Kippur Morning',hh('s43', ['9:00 AM – 9:30 AM','9:30 AM – 10:00 AM','10:00 AM – 10:30 AM','10:30 AM – 11:00 AM']), true),
];

function slot(id, role, timeSlot = null) { return { id, role, timeSlot, volunteer: null, volunteerEmail: null, coverageRequested: false }; }
function fmtDate(iso) { return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function service(id, dateISO, time, type, slots, isHH = false) { return { id, dateISO, date: fmtDate(dateISO), time, type, isHH, slots }; }
function hh(prefix, windows) {
  let n = Number(prefix.replace(/^s/, ''));
  const roles = ['Greeter 1','Greeter 2','Usher 1','Usher 2'];
  return windows.flatMap(w => roles.map(role => slot(`s${n++}`, role, w)));
}
