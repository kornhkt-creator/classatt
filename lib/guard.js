import { readSession } from './session.js';
import { resolveIdentity } from './identity.js';
import { forbidden, unauthorized } from './http.js';

// Returns { session, role, teacher?, student? } or throws 401
export async function requireSession(req) {
  const session = await readSession(req);
  if (!session) throw unauthorized();
  const identity = await resolveIdentity(session.lineUserId);
  return { session, ...identity };
}

// Returns the context for the given role or throws 401/403
export async function requireRole(req, role) {
  const ctx = await requireSession(req);
  if (ctx.role !== role) throw forbidden();
  return ctx;
}
