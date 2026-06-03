import { neon } from '@neondatabase/serverless';
import { INITIAL_SERVICES } from './_data.js';

export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), google_sub TEXT UNIQUE, email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin', 'volunteer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY, date_iso DATE NOT NULL, date_label TEXT NOT NULL, time_label TEXT NOT NULL,
  type TEXT NOT NULL, is_hh BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  role TEXT NOT NULL, time_slot TEXT, volunteer_name TEXT, volunteer_email TEXT,
  coverage_requested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS email_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recipient TEXT NOT NULL, subject TEXT NOT NULL,
  provider TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'disabled')),
  provider_message_id TEXT, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_email TEXT, action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_date_iso ON services(date_iso);
CREATE INDEX IF NOT EXISTS idx_slots_service_id ON slots(service_id);
CREATE INDEX IF NOT EXISTS idx_slots_volunteer_email ON slots(LOWER(volunteer_email));
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_recipient ON email_delivery_log(LOWER(recipient));
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
`;

export function getDatabaseUrl() { return process.env.DATABASE_URL || process.env.POSTGRES_URL || ''; }
export function hasDb() { return !!getDatabaseUrl(); }
export function db() { const url = getDatabaseUrl(); if (!url) throw new Error('Missing DATABASE_URL/POSTGRES_URL'); return neon(url); }
export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export async function migrate(sql = db()) {
  const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
}

export async function seedServices(sql = db()) {
  for (const svc of INITIAL_SERVICES) await upsertService(sql, svc);
}

export async function upsertService(sql, svc) {
  await sql`INSERT INTO services (id, date_iso, date_label, time_label, type, is_hh, updated_at)
    VALUES (${String(svc.id)}, ${svc.dateISO}, ${svc.date}, ${svc.time}, ${svc.type}, ${!!svc.isHH}, NOW())
    ON CONFLICT (id) DO UPDATE SET date_iso=EXCLUDED.date_iso, date_label=EXCLUDED.date_label,
    time_label=EXCLUDED.time_label, type=EXCLUDED.type, is_hh=EXCLUDED.is_hh, updated_at=NOW()`;
  for (const sl of svc.slots || []) {
    await sql`INSERT INTO slots (id, service_id, role, time_slot, volunteer_name, volunteer_email, coverage_requested, updated_at)
      VALUES (${sl.id}, ${String(svc.id)}, ${sl.role}, ${sl.timeSlot || null}, ${sl.volunteer || null}, ${sl.volunteerEmail ? normalizeEmail(sl.volunteerEmail) : null}, ${!!sl.coverageRequested}, NOW())
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, time_slot=EXCLUDED.time_slot,
      volunteer_name=COALESCE(slots.volunteer_name, EXCLUDED.volunteer_name), volunteer_email=COALESCE(slots.volunteer_email, EXCLUDED.volunteer_email),
      coverage_requested=slots.coverage_requested OR EXCLUDED.coverage_requested, updated_at=NOW()`;
  }
}

export async function listServices(sql = db()) {
  const services = await sql`SELECT id, date_iso::text AS date_iso, date_label, time_label, type, is_hh FROM services ORDER BY date_iso, time_label, id`;
  const slots = await sql`SELECT id, service_id, role, time_slot, volunteer_name, volunteer_email, coverage_requested FROM slots ORDER BY id`;
  const byService = new Map();
  for (const sl of slots) {
    const arr = byService.get(sl.service_id) || [];
    arr.push({ id: sl.id, role: sl.role, timeSlot: sl.time_slot, volunteer: sl.volunteer_name, volunteerEmail: sl.volunteer_email, coverageRequested: sl.coverage_requested });
    byService.set(sl.service_id, arr);
  }
  return services.map(s => ({ id: s.id, dateISO: s.date_iso.slice(0,10), date: s.date_label, time: s.time_label, type: s.type, isHH: s.is_hh, slots: byService.get(s.id) || [] }));
}

export async function getSlot(sql, slotId) {
  const rows = await sql`SELECT * FROM slots WHERE id=${slotId} LIMIT 1`;
  return rows[0] || null;
}

export async function logAudit(sql, actorEmail, action, entityType, entityId, metadata = {}) {
  await sql`INSERT INTO audit_log(actor_email, action, entity_type, entity_id, metadata) VALUES(${actorEmail || null}, ${action}, ${entityType}, ${String(entityId)}, ${JSON.stringify(metadata)})`;
}

export async function upsertUser(sql, { googleSub = null, email, name, role }) {
  const rows = await sql`INSERT INTO users(google_sub, email, name, role, updated_at)
    VALUES(${googleSub}, ${normalizeEmail(email)}, ${name}, ${role}, NOW())
    ON CONFLICT(email) DO UPDATE SET google_sub=COALESCE(EXCLUDED.google_sub, users.google_sub), name=EXCLUDED.name, role=EXCLUDED.role, updated_at=NOW()
    RETURNING id, google_sub, email, name, role`;
  return rows[0];
}

export async function logEmail(sql, { to, subject, provider, status, providerMessageId = null, error = null }) {
  await sql`INSERT INTO email_delivery_log(recipient, subject, provider, status, provider_message_id, error)
    VALUES(${normalizeEmail(to)}, ${subject}, ${provider}, ${status}, ${providerMessageId}, ${error})`;
}
