import { db, hasDb, listServices, migrate, seedServices } from '../_db.js';
import { INITIAL_SERVICES } from '../_data.js';
import { handleError } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!hasDb()) return res.status(200).json({ services: INITIAL_SERVICES, source: 'seed-fixture' });
    const sql = db();
    await migrate(sql);
    let services = await listServices(sql);
    if (!services.length) {
      await seedServices(sql);
      services = await listServices(sql);
    }
    return res.status(200).json({ services, source: 'database' });
  } catch (error) { return handleError(res, error); }
}
