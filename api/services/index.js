import { db, hasDb, listServices, migrate, seedServices } from '../../lib/_db.js';
import { INITIAL_SERVICES } from '../../lib/_data.js';
import { COOKIE_NAME, parseCookies, roleForEmail, verifySessionCookie } from '../../lib/_auth.js';
import { servicesForViewer } from '../../lib/service-visibility.js';
import { handleError } from '../../lib/_http.js';

function viewer(req) {
  try {
    const sessionUser = verifySessionCookie(parseCookies(req)[COOKIE_NAME]);
    return sessionUser?.email
      ? { role: roleForEmail(sessionUser.email), email: sessionUser.email }
      : { role: 'guest', email: '' };
  } catch {
    return { role: 'guest', email: '' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  try {
    const { role, email } = viewer(req);
    if (!hasDb()) return res.status(200).json({ services: servicesForViewer(INITIAL_SERVICES, role, email), source: 'seed-fixture' });
    const sql = db();
    await migrate(sql);
    let services = await listServices(sql);
    if (!services.length) {
      await seedServices(sql);
      services = await listServices(sql);
    }
    return res.status(200).json({ services: servicesForViewer(services, role, email), source: 'database' });
  } catch (error) { return handleError(res, error); }
}
