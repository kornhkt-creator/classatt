// The only way pages talk to the server: /api/<fn>?op=<op>
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(fn, op, params = {}) {
  const qs = new URLSearchParams();
  if (op) qs.set('op', op);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const query = qs.toString();
  return `/api/${fn}${query ? `?${query}` : ''}`;
}

async function request(method, fn, op, params, body, options = {}) {
  let resp;
  try {
    resp = await fetch(buildUrl(fn, op, params), {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่');
  }
  let data = {};
  try {
    data = await resp.json();
  } catch {
    data = {};
  }
  if (!resp.ok) {
    const err = new ApiError(
      resp.status,
      data?.error?.code || 'error',
      data?.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      data?.error?.details,
    );
    if (resp.status === 401 && options.redirectOn401 !== false) {
      location.replace('/');
      return new Promise(() => {});
    }
    throw err;
  }
  return data;
}

export const apiGet = (fn, op, params, options) => request('GET', fn, op, params, undefined, options);
export const apiPost = (fn, op, body = {}, params, options) => request('POST', fn, op, params, body, options);
