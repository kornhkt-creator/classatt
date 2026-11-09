// HTTP helpers shared by every Vercel Function in api/.
// Works with both Vercel's Node runtime and the local dev server (scripts/dev-server.js).

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = 'bad_request') => new HttpError(400, code, message);
export const unauthorized = (message = 'กรุณาเข้าสู่ระบบใหม่', code = 'unauthorized') => new HttpError(401, code, message);
export const forbidden = (message = 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้', code = 'forbidden') => new HttpError(403, code, message);
export const notFound = (message = 'ไม่พบข้อมูลที่ต้องการ', code = 'not_found') => new HttpError(404, code, message);
export const conflict = (message, code = 'conflict', details) => new HttpError(409, code, message, details);

const MAX_BODY_BYTES = 64 * 1024;

export function getQuery(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return Object.fromEntries(url.searchParams);
}

export function getHost(req) {
  const raw = req.headers['x-forwarded-host'] || req.headers.host || '';
  return String(raw).split(',')[0].trim().toLowerCase();
}

export function isLocalhost(req) {
  const hostname = getHost(req).replace(/:\d+$/, '');
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    return parseJson(text);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป');
    chunks.push(chunk);
  }
  return parseJson(Buffer.concat(chunks).toString('utf8'));
}

function parseJson(text) {
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : {};
  } catch {
    throw badRequest('ข้อมูลที่ส่งมาไม่ถูกต้อง', 'bad_json');
  }
}

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(data));
}

// POST requests must come from this app's own pages (basic CSRF protection).
export function checkOrigin(req) {
  const source = req.headers.origin || req.headers.referer;
  if (!source) throw forbidden('คำขอไม่ได้มาจากแอปนี้', 'bad_origin');
  let url;
  try {
    url = new URL(source);
  } catch {
    throw forbidden('คำขอไม่ได้มาจากแอปนี้', 'bad_origin');
  }
  if (url.host.toLowerCase() !== getHost(req)) throw forbidden('คำขอไม่ได้มาจากแอปนี้', 'bad_origin');
}

function hasThai(text) {
  return /[฀-๿]/.test(text || '');
}

export function errorPayload(err) {
  if (err instanceof HttpError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return { status: err.status, body: { error } };
  }
  if (err && err.name === 'ZodError' && Array.isArray(err.issues)) {
    const first = err.issues[0];
    const message = hasThai(first?.message)
      ? first.message
      : `ข้อมูลไม่ถูกต้อง${first?.path?.length ? ` (${first.path.join('.')})` : ''}`;
    return { status: 400, body: { error: { code: 'validation', message } } };
  }
  return null;
}

export function withApi(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      const known = errorPayload(err);
      if (known) return sendJson(res, known.status, known.body);
      // Log only what is needed — never tokens, cookies or codes.
      console.error('[api error]', err?.code || '', err?.message || err);
      sendJson(res, 500, { error: { code: 'server_error', message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' } });
    }
  };
}

// Build one Vercel Function that serves many operations: /api/<file>?op=<name>
export function createApi(ops) {
  return withApi(async (req, res) => {
    const query = getQuery(req);
    const op = ops[query.op || ''];
    if (!op || !Object.hasOwn(ops, query.op || '')) throw notFound('ไม่พบคำสั่งนี้', 'unknown_op');
    if (req.method !== op.method) throw new HttpError(405, 'method_not_allowed', 'วิธีเรียกใช้งานไม่ถูกต้อง');
    let body;
    if (req.method === 'POST') {
      checkOrigin(req);
      body = await readJson(req);
    }
    const result = await op.handler({ req, res, query, body });
    if (!res.writableEnded) sendJson(res, 200, result ?? { ok: true });
  });
}
