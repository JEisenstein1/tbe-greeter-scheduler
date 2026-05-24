import type { Service, Slot } from './types';

export function statusFor(svc: Service): { kind: 'full' | 'partial' | 'open'; label: string } {
  const filled = svc.slots.filter(s => s.volunteer).length;
  const total = svc.slots.length;
  if (filled === total) return { kind: 'full',    label: 'Fully Staffed' };
  if (filled === 0)     return { kind: 'open',    label: total === 1 ? '1 Open' : `${total} Open` };
  return                       { kind: 'partial', label: `${total - filled} Open` };
}

export function openCount(svc: Service): number {
  return svc.slots.filter(s => !s.volunteer).length;
}

export function groupSlotsByTime(slots: Slot[]): { timeSlot: string | null; slots: Slot[] }[] {
  const out: { timeSlot: string | null; slots: Slot[] }[] = [];
  const map = new Map<string, { timeSlot: string | null; slots: Slot[] }>();
  for (const s of slots) {
    const key = s.timeSlot ?? '__none__';
    if (!map.has(key)) {
      const entry = { timeSlot: s.timeSlot, slots: [] as Slot[] };
      map.set(key, entry);
      out.push(entry);
    }
    map.get(key)!.slots.push(s);
  }
  return out;
}

export function wdShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

export function moShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

export function dayNum(iso: string): number {
  const d = new Date(iso + 'T12:00:00');
  return d.getDate();
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function abbrev(type: string): string {
  return type
    .replace('Kabbalat Shabbat', 'Kab. Shab.')
    .replace('Shabbat Morning', 'Shab. AM')
    .replace('Rosh Hashanah Morning', 'Rosh Hash.')
    .replace('Yom Kippur Morning', 'Yom Kip.')
    .replace('Erev Shavuot', 'Shavuot Eve')
    .replace('Shavuot Morning', 'Shavuot AM');
}
