import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from './env.js';
import { isLocalhost } from './http.js';

export const COOKIE_NAME = 'ct_session';
export const SESSION_SECONDS = 12 * 60 * 60;

function key() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[name] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

function serialize(value, maxAge, secure) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

// The cookie only stores who the LINE user is. Role and ids are looked up from the database on every request.
export async function createSessionCookie({ lineUserId, displayName = '', pictureUrl = '' }, req) {
  const token = await new SignJWT({ ln: lineUserId, dn: displayName.slice(0, 100), pu: pictureUrl.slice(0, 500) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(key());
  return serialize(token, SESSION_SECONDS, !isLocalhost(req));
}

export function clearSessionCookie(req) {
  return serialize('', 0, !isLocalhost(req));
}

export async function readSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (typeof payload.ln !== 'string' || !payload.ln) return null;
    return {
      lineUserId: payload.ln,
      displayName: typeof payload.dn === 'string' ? payload.dn : '',
      pictureUrl: typeof payload.pu === 'string' ? payload.pu : '',
    };
  } catch {
    return null;
  }
}
