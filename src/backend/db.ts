import type { Service, Slot, User, UserRole } from '../types';

export interface DbUser extends User {
  id: string;
  googleSub: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentInput {
  slotId: string;
  user: Pick<User, 'name' | 'email' | 'role'>;
}

export interface EmailDeliveryLogInput {
  to: string;
  subject: string;
  provider: string;
  status: 'queued' | 'sent' | 'failed';
  providerMessageId?: string | null;
  error?: string | null;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'volunteer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  date_iso DATE NOT NULL,
  date_label TEXT NOT NULL,
  time_label TEXT NOT NULL,
  type TEXT NOT NULL,
  is_hh BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  time_slot TEXT,
  volunteer_name TEXT,
  volunteer_email TEXT,
  coverage_requested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_date_iso ON services(date_iso);
CREATE INDEX IF NOT EXISTS idx_slots_service_id ON slots(service_id);
CREATE INDEX IF NOT EXISTS idx_slots_volunteer_email ON slots(LOWER(volunteer_email));
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_recipient ON email_delivery_log(LOWER(recipient));
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
`;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function roleForEmail(email: string, adminEmails: string): UserRole {
  const normalized = normalizeEmail(email);
  const admins = adminEmails.split(',').map(normalizeEmail).filter(Boolean);
  return admins.includes(normalized) ? 'admin' : 'volunteer';
}

export function assertCanMutateSlot(user: User | null, slot: Slot, action: 'signup' | 'request_coverage' | 'remove' | 'admin_assign'): void {
  if (!user) throw new Error('AUTH_REQUIRED');
  if (user.role === 'admin') return;

  const ownsSlot = !!slot.volunteerEmail && normalizeEmail(slot.volunteerEmail) === normalizeEmail(user.email);

  if (action === 'signup') {
    if (slot.volunteerEmail || slot.volunteer) throw new Error('SLOT_ALREADY_FILLED');
    return;
  }

  if ((action === 'request_coverage' || action === 'remove') && ownsSlot) return;

  throw new Error('FORBIDDEN');
}

export function serializeServiceForDb(service: Service): Array<Record<string, unknown>> {
  return [
    {
      table: 'services',
      id: String(service.id),
      date_iso: service.dateISO,
      date_label: service.date,
      time_label: service.time,
      type: service.type,
      is_hh: service.isHH,
    },
    ...service.slots.map(slot => ({
      table: 'slots',
      id: slot.id,
      service_id: String(service.id),
      role: slot.role,
      time_slot: slot.timeSlot,
      volunteer_name: slot.volunteer,
      volunteer_email: slot.volunteerEmail ? normalizeEmail(slot.volunteerEmail) : null,
      coverage_requested: !!slot.coverageRequested,
    })),
  ];
}

export function applySignup(service: Service, slotId: string, user: Pick<User, 'name' | 'email'>): Service {
  return {
    ...service,
    slots: service.slots.map(slot => {
      if (slot.id !== slotId) return slot;
      assertCanMutateSlot({ ...user, role: 'volunteer', source: 'google' }, slot, 'signup');
      return { ...slot, volunteer: user.name, volunteerEmail: normalizeEmail(user.email), coverageRequested: false };
    }),
  };
}
