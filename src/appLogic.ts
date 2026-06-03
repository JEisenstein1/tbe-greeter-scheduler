import type { AuthSource, Service, Slot, User, UserRole } from './types';
import { ADMINS, VOLUNTEERS } from './data';

export interface AuthLookupResult extends User {
  verifiedByProvider: boolean;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

export function shouldRestorePersistedUser(_raw: string | null): boolean {
  // Public volunteer kiosk-style app: do not silently restore the last browser user.
  // The old behavior made the app appear to auto-login as Jon/admin on shared devices.
  return false;
}

export function lookupMockAuthUser(email: string, source: AuthSource): AuthLookupResult | null {
  const e = email.toLowerCase().trim();
  if (!e) return null;
  const adminMatch = ADMINS.find(a => a.email.toLowerCase() === e);
  if (adminMatch) {
    return { name: adminMatch.name, email: adminMatch.email, source, role: 'admin', verifiedByProvider: false };
  }
  const volMatch = VOLUNTEERS.find(v => v.email.toLowerCase() === e);
  if (volMatch) {
    return { name: volMatch.name, email: volMatch.email, source, role: 'volunteer', verifiedByProvider: false };
  }
  return null;
}

export function nameFromEmail(email: string): string {
  return email.split('@')[0].split(/[._-]/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Volunteer';
}

export function isSlotForUser(slot: Slot, user: User | null, query?: string): boolean {
  if (!slot.volunteer && !slot.volunteerEmail) return false;
  const terms = [slot.volunteer, slot.volunteerEmail].filter(Boolean).map(v => String(v).toLowerCase());
  if (user?.email && slot.volunteerEmail && slot.volunteerEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (user?.name && slot.volunteer && slot.volunteer.toLowerCase() === user.name.toLowerCase()) return true;
  const q = query?.trim().toLowerCase();
  return !!q && terms.some(t => t.includes(q));
}

export function findUserAssignments(services: Service[], user: User | null, todayISO: string, query?: string): { svc: Service; slot: Slot }[] {
  const submitted = user ? undefined : query?.trim();
  if (!user && !submitted) return [];
  const out: { svc: Service; slot: Slot }[] = [];
  services.forEach(svc => {
    if (svc.dateISO < todayISO) return;
    svc.slots.forEach(slot => {
      if (isSlotForUser(slot, user, submitted)) out.push({ svc, slot });
    });
  });
  return out.sort((a, b) => a.svc.dateISO.localeCompare(b.svc.dateISO));
}

export function buildConfirmationEmail(svc: Service, slot: Slot, vol: { name: string; email: string }): EmailPayload {
  const first = vol.name.trim().split(/\s+/)[0] || 'friend';
  const timeSlotLine = slot.timeSlot ? `\nSlot: ${slot.timeSlot}` : '';
  return {
    to: vol.email.trim(),
    subject: `Thank you for signing up — ${svc.type}`,
    text: `Shalom ${first},\n\nThank you for signing up to serve as ${slot.role} at ${svc.type}.\n\n${svc.date} · ${svc.time}${timeSlotLine}\n\nA calendar invite will follow from Temple Beth El once email/calendar integration is connected.\n\n— Temple Beth El`,
  };
}

export function getCalendarDayPrimaryAction(services: Service[], iso: string, role: UserRole): { type: 'signup' | 'manage' | 'none'; serviceId?: Service['id'] } {
  const dayServices = services.filter(s => s.dateISO === iso);
  if (dayServices.length === 0) return { type: 'none' };
  const first = dayServices[0];
  if (role === 'admin') return { type: 'manage', serviceId: first.id };
  if (first.slots.some(s => !s.volunteer)) return { type: 'signup', serviceId: first.id };
  return { type: 'none' };
}
