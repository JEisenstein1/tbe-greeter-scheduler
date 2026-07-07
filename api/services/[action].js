import signupHandler from '../../lib/signup.js';
import createHandler from '../../lib/create.js';
import deleteHandler from '../../lib/delete.js';
import removeHandler from '../../lib/remove.js';
import requestCoverageHandler from '../../lib/request-coverage.js';

const handlers = {
  signup: signupHandler,
  create: createHandler,
  delete: deleteHandler,
  remove: removeHandler,
  'request-coverage': requestCoverageHandler,
};

export default async function handler(req, res) {
  const action = String(req.query?.action || '').replace(/\.js$/, '');
  const selected = handlers[action];
  if (!selected) return res.status(404).json({ error: 'Unknown service action' });
  return selected(req, res);
}
