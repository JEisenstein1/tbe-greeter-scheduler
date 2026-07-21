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
  if (user?.email && slot.volunteerEmail && slot.volunteerEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (user?.name && slot.volunteer && slot.volunteer.toLowerCase() === user.name.toLowerCase()) return true;
  const q = query?.trim().toLowerCase();
  if (!q) return false;
  // Signed-out lookup: substring match on the display name, but emails only match
  // exactly — a partial-email query (e.g. "gmail") must not enumerate assignments.
  if (slot.volunteer && slot.volunteer.toLowerCase().includes(q)) return true;
  return !!slot.volunteerEmail && slot.volunteerEmail.toLowerCase() === q;
}

export function filterSignupServices(services: Service[], user: User | null, todayISO: string): Service[] {
  return services.filter(service => {
    if (String(service.dateISO || '') < todayISO) return false;
    const hasOpen = service.slots.some(slot => !slot.volunteer);
    const mine = service.slots.some(slot => isSlotForUser(slot, user));
    return hasOpen || mine;
  });
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
    text: `Shalom ${first},\n\nThank you for signing up to serve as ${slot.role} at ${svc.type}.\n\n${svc.date} · ${svc.time}${timeSlotLine}\n\nA calendar invite will be attached to the confirmation email.\n\n— Temple Beth El`,
  };
}

// Service ids are numbers in the local fixture but strings from the database and
// from AI tool calls; compare loosely so an AI action never silently no-ops.
export function localDateISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sameId(a: Service['id'], b: Service['id']): boolean {
  return String(a) === String(b);
}

export function applyAssignVolunteer(services: Service[], svcId: Service['id'], slotId: string, vol: { name: string; email: string }): Service[] {
  // Filling a slot resolves any open coverage request on it, mirroring the
  // backend (signup sets coverage_requested=FALSE).
  return services.map(s => !sameId(s.id, svcId) ? s : ({
    ...s,
    slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email, coverageRequested: false })),
  }));
}

export function applyRemoveSignup(services: Service[], svcId: Service['id'], slotId: string): Service[] {
  return services.map(s => !sameId(s.id, svcId) ? s : ({
    ...s,
    slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: null, volunteerEmail: null, coverageRequested: false })),
  }));
}

export function applyRequestCoverage(services: Service[], svcId: Service['id'], slotId: string): Service[] {
  return services.map(s => !sameId(s.id, svcId) ? s : ({
    ...s,
    slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, coverageRequested: true })),
  }));
}

export interface AiAction {
  action: string;
  svcId?: string | number;
  slotId?: string;
  volunteerName?: string;
  volunteerEmail?: string;
  service?: Service;
}

export type AiActionPlan =
  | { kind: 'signup'; svcId: Service['id']; slotId: string; vol: { name: string; email: string } }
  | { kind: 'remove'; svcId: Service['id']; slotId: string }
  | { kind: 'coverage'; svcId: Service['id']; slotId: string }
  | { kind: 'create'; service: Service };

// Pure dispatch mirroring AIView's action loop. Returns the mutation a frontend
// action should trigger, or null for a no-op (unknown action, missing fields, or a
// self-signup with no signed-in user). Keeping this pure lets App/AIView and tests
// share one source of truth for which slots an AI action is allowed to touch.
export function planAiAction(act: AiAction, user: User | null): AiActionPlan | null {
  if (act.action === 'sign_me_up' && act.svcId && act.slotId) {
    if (!user) return null;
    return { kind: 'signup', svcId: act.svcId, slotId: act.slotId, vol: { name: user.name, email: user.email } };
  }
  if (act.action === 'assign_volunteer' && act.svcId && act.slotId && act.volunteerName && act.volunteerEmail) {
    return { kind: 'signup', svcId: act.svcId, slotId: act.slotId, vol: { name: act.volunteerName, email: act.volunteerEmail } };
  }
  if (act.action === 'remove_signup' && act.svcId && act.slotId) {
    return { kind: 'remove', svcId: act.svcId, slotId: act.slotId };
  }
  if (act.action === 'request_coverage' && act.svcId && act.slotId) {
    return { kind: 'coverage', svcId: act.svcId, slotId: act.slotId };
  }
  if (act.action === 'create_service' && act.service) {
    return { kind: 'create', service: act.service };
  }
  return null;
}

// Frontend-equivalent reducer composing planAiAction with the pure slot transforms.
// Used in tests to prove the frontend action path mutates only expected slots; built
// entirely from the same primitives production uses, so there is no logic drift.
export function applyAiActions(services: Service[], actions: AiAction[], user: User | null): Service[] {
  return (actions ?? []).reduce<Service[]>((acc, act) => {
    const plan = planAiAction(act, user);
    if (!plan) return acc;
    switch (plan.kind) {
      case 'signup': return applyAssignVolunteer(acc, plan.svcId, plan.slotId, plan.vol);
      case 'remove': return applyRemoveSignup(acc, plan.svcId, plan.slotId);
      case 'coverage': return applyRequestCoverage(acc, plan.svcId, plan.slotId);
      case 'create': return [...acc, plan.service].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      default: return acc;
    }
  }, services);
}

export function getCalendarDayPrimaryAction(services: Service[], iso: string, role: UserRole): { type: 'signup' | 'manage' | 'none'; serviceId?: Service['id'] } {
  const dayServices = services.filter(s => s.dateISO === iso);
  if (dayServices.length === 0) return { type: 'none' };
  const first = dayServices[0];
  if (role === 'admin') return { type: 'manage', serviceId: first.id };
  if (first.slots.some(s => !s.volunteer)) return { type: 'signup', serviceId: first.id };
  return { type: 'none' };
}
