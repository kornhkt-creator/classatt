import { Readable } from 'node:stream';
import { createFakeSupabase, seedDemo } from '../scripts/fake-supabase.js';
import { setSupabaseForTests } from '../lib/supabase.js';

export function setupEnv() {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test_key_000000000000',
    SESSION_SECRET: 'test-session-secret-0123456789-0123456789',
    LINE_CHANNEL_ID: '1234567890',
    LIFF_ID: '1234567890-AbCdEf',
    DEV_MOCK_LOGIN: 'true',
  });
  delete process.env.VERCEL_ENV;
}

export function freshDb() {
  const fake = seedDemo(createFakeSupabase());
  setSupabaseForTests(fake);
  return fake;
}

export const teacherRow = (fake, code = 'T001') => fake._db.teachers.find((t) => t.teacher_code === code);
export const studentRow = (fake, code) => fake._db.students.find((s) => s.student_code === code);

export function publicTeacher(fake, code = 'T001') {
  const t = teacherRow(fake, code);
  return { id: t.id, teacher_code: t.teacher_code, name: t.name };
}

export function publicStudent(fake, code) {
  const s = studentRow(fake, code);
  return {
    id: s.id, student_code: s.student_code, prefix: s.prefix, first_name: s.first_name,
    last_name: s.last_name, classroom: s.classroom, number: s.number,
  };
}

export function fakeReq({ method = 'GET', url = '/', host = 'localhost:3000', cookie, origin, body } = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host };
  if (cookie) req.headers.cookie = cookie;
  if (origin) req.headers.origin = origin;
  return req;
}

export function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(text) { this.body = text ? JSON.parse(text) : null; this.writableEnded = true; },
  };
  return res;
}

export async function call(handler, opts) {
  const res = fakeRes();
  await handler(fakeReq(opts), res);
  return res;
}

// Log in through the real api/auth handler with a mock token; returns the cookie string
export async function loginAs(authHandler, mockId) {
  const res = await call(authHandler, {
    method: 'POST', url: '/api/auth?op=line', origin: 'http://localhost:3000', body: { idToken: `mock:${mockId}` },
  });
  if (res.statusCode !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
  return res.headers['set-cookie'].split(';')[0];
}
