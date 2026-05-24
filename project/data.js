// Seed data for Temple Beth El Greeter Scheduler

const VOLUNTEERS = [
  { name: "Sarah Goldberg",  email: "sgoldberg@gmail.com",  active: true,  joined: "2024-09-10", servedCount: 12 },
  { name: "Daniel Levin",    email: "dlevin@gmail.com",     active: true,  joined: "2023-03-22", servedCount: 27 },
  { name: "Miriam Katz",     email: "mkatz@gmail.com",      active: true,  joined: "2025-01-04", servedCount: 5 },
  { name: "Aaron Feldman",   email: "afeldman@gmail.com",   active: true,  joined: "2022-08-15", servedCount: 41 },
  { name: "Rachel Stein",    email: "rstein@gmail.com",     active: true,  joined: "2024-11-30", servedCount: 8 },
  { name: "Joshua Cohen",    email: "jcohen@gmail.com",     active: true,  joined: "2023-06-18", servedCount: 19 },
  { name: "Hannah Bernstein",email: "hbernstein@gmail.com", active: true,  joined: "2024-02-12", servedCount: 14 },
  { name: "Eli Rosen",       email: "erosen@gmail.com",     active: true,  joined: "2022-12-03", servedCount: 33 },
  { name: "Naomi Friedman",  email: "nfriedman@gmail.com",  active: false, joined: "2021-05-09", servedCount: 52 },
  { name: "Benjamin Klein",  email: "bklein@gmail.com",     active: true,  joined: "2025-03-21", servedCount: 3 },
];

const ADMINS = [
  { name: "Rabbi David Mendel", email: "rabbi@tbe.org",       role: "Owner",  joined: "2020-01-01", source: "google"   },
  { name: "Rebecca Schwartz",   email: "rschwartz@tbe.org",   role: "Admin",  joined: "2022-04-18", source: "password" },
  { name: "Michael Greenberg",  email: "mgreenberg@tbe.org",  role: "Admin",  joined: "2023-09-04", source: "google"   },
];

const SYNAGOGUE = {
  name: "Temple Beth El",
  address: "1820 Eastover Drive, Charlotte, NC 28207",
  defaultFridayTime: "6:30 PM",
  defaultSaturdayTime: "9:30 AM",
  reminderDay: "Monday",
  reminderHour: "8:00 AM",
  integrations: {
    gmail: { connected: true, account: "office@tbe.org" },
    gcal:  { connected: true, account: "office@tbe.org" },
  },
};

// Helper to build slot id
let __sid = 1;
const slot = (role, timeSlot = null, volunteer = null, volunteerEmail = null) => ({
  id: "s" + (__sid++),
  role, timeSlot, volunteer, volunteerEmail,
});

// Build services for May 2026 (current month) + a few in June + Rosh Hashanah preview in Sep
// Date format: ISO + display

const fmtDate = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};

const wdShort = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
};
const moShort = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
};
const dayNum = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.getDate();
};

let __id = 1;
const mkService = (dateISO, time, type, slots, isHH = false) => ({
  id: __id++,
  dateISO,
  date: fmtDate(dateISO),
  time,
  type,
  isHH,
  slots,
});

// Standard Shabbat helpers
const friShabbat = (iso, filled = null) => mkService(
  iso, "6:30 PM", "Kabbalat Shabbat",
  [slot("Greeter", null, filled?.name ?? null, filled?.email ?? null)]
);
const satShabbat = (iso, filled = null) => mkService(
  iso, "9:30 AM", "Shabbat Morning",
  [slot("Greeter", null, filled?.name ?? null, filled?.email ?? null)]
);

// High Holiday: 30-min windows × 4 roles each
const hhWindows = (windows, filledMap = {}) => {
  const out = [];
  windows.forEach(w => {
    ["Greeter 1", "Greeter 2", "Usher 1", "Usher 2"].forEach(role => {
      const key = `${w}|${role}`;
      const f = filledMap[key];
      out.push(slot(role, w, f?.name ?? null, f?.email ?? null));
    });
  });
  return out;
};

const SERVICES = [
  // Past/early May (skipped, focus on current)
  mkService("2026-05-01", "6:30 PM", "Kabbalat Shabbat",
    [slot("Greeter", null, "Sarah Goldberg", "sgoldberg@gmail.com")]),
  mkService("2026-05-02", "9:30 AM", "Shabbat Morning",
    [slot("Greeter", null, "Daniel Levin", "dlevin@gmail.com")]),

  // mid-May
  friShabbat("2026-05-08"),
  satShabbat("2026-05-09", { name: "Miriam Katz", email: "mkatz@gmail.com" }),

  friShabbat("2026-05-15"),
  satShabbat("2026-05-16"),

  // Shavuot weekend (May 22-23, 2026) — High-Holiday-style multi-window
  mkService("2026-05-22", "8:00 PM – 10:00 PM", "Erev Shavuot",
    hhWindows(["8:00 PM – 8:30 PM", "8:30 PM – 9:00 PM"], {
      "8:00 PM – 8:30 PM|Greeter 1": { name: "Aaron Feldman", email: "afeldman@gmail.com" },
      "8:00 PM – 8:30 PM|Usher 1":   { name: "Rachel Stein",   email: "rstein@gmail.com" },
    }),
    true
  ),
  mkService("2026-05-23", "9:30 AM", "Shavuot Morning",
    [slot("Greeter", null, "Joshua Cohen", "jcohen@gmail.com")]),

  friShabbat("2026-05-29"),
  satShabbat("2026-05-30"),

  // June
  friShabbat("2026-06-05", { name: "Hannah Bernstein", email: "hbernstein@gmail.com" }),
  satShabbat("2026-06-06"),
  friShabbat("2026-06-12"),
  satShabbat("2026-06-13", { name: "Eli Rosen", email: "erosen@gmail.com" }),
  friShabbat("2026-06-19"),
  satShabbat("2026-06-20"),

  // Rosh Hashanah preview — Sep 12, 2026
  mkService("2026-09-12", "9:00 AM – 1:00 PM", "Rosh Hashanah Morning",
    hhWindows([
      "9:00 AM – 9:30 AM",
      "9:30 AM – 10:00 AM",
      "10:00 AM – 10:30 AM",
      "10:30 AM – 11:00 AM",
    ]),
    true
  ),
];

// Helpers used by views
function statusFor(svc) {
  const filled = svc.slots.filter(s => s.volunteer).length;
  const total = svc.slots.length;
  if (filled === total) return { kind: "full",    label: "Fully Staffed" };
  if (filled === 0)     return { kind: "open",    label: total === 1 ? "1 Open" : `${total} Open` };
  return                       { kind: "partial", label: `${total - filled} Open` };
}

function openCount(svc) {
  return svc.slots.filter(s => !s.volunteer).length;
}

function groupSlotsByTime(slots) {
  // returns [{ timeSlot: string|null, slots: [] }, ...]
  const out = [];
  const map = new Map();
  for (const s of slots) {
    const key = s.timeSlot ?? "__none__";
    if (!map.has(key)) { map.set(key, { timeSlot: s.timeSlot, slots: [] }); out.push(map.get(key)); }
    map.get(key).slots.push(s);
  }
  return out;
}

// Make data available globally for non-module scripts
Object.assign(window, {
  TBE_DATA: { VOLUNTEERS, SERVICES, ADMINS, SYNAGOGUE },
  TBE_HELPERS: { statusFor, openCount, groupSlotsByTime, wdShort, moShort, dayNum, fmtDate, fmtDate },
});
