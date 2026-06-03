import { db, migrate, seedServices } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.MIGRATION_SECRET || req.headers['x-migration-secret'] !== process.env.MIGRATION_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const sql = db();
  await migrate(sql);
  await seedServices(sql);
  res.status(200).json({ ok: true, migrated: ['users', 'services', 'slots', 'email_delivery_log', 'audit_log'], seeded: 'INITIAL_SERVICES' });
}
