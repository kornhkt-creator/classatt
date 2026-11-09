import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { call, freshDb, loginAs, setupEnv } from './helpers.js';
import authApi from '../api/auth.js';
import linkApi from '../api/link.js';
import teacherApi from '../api/teacher.js';
import studentApi from '../api/student.js';

const ORIGIN = 'http://localhost:3000';
const ID = '00000000-0000-4000-8000-000000000000';

const TEACHER_OPS = {
  GET: ['dashboard', 'assignments', 'assignment', 'classrooms', 'subjects', 'board', 'overview',
    'attendance-sessions', 'attendance-live', 'attendance-session', 'attendance-report'],
  POST: ['create-assignment', 'update-assignment', 'review', 'create-attendance', 'mark-attendance', 'close-attendance'],
};
const STUDENT_OPS = {
  GET: ['dashboard', 'assignments', 'assignment', 'attendance-open', 'attendance'],
  POST: ['submit', 'checkin'],
};

async function linked(mockId, role, body) {
  let cookie = await loginAs(authApi, mockId);
  const res = await call(linkApi, { method: 'POST', url: `/api/link?op=${role}`, origin: ORIGIN, cookie, body: { ...body, confirm: true } });
  if (res.statusCode !== 200) throw new Error(JSON.stringify(res.body));
  cookie = await loginAs(authApi, mockId);
  return cookie;
}

let teacherCookie;
let studentCookie;

beforeEach(async () => {
  setupEnv();
  freshDb();
  teacherCookie = await linked('U_t1', 'teacher', { teacherCode: 'T001', regCode: 'TEST01' });
  studentCookie = await linked('U_s1', 'student', { studentCode: '65001', verifyCode: '111111' });
});

function request(api, fn, method, op, cookie, origin = ORIGIN) {
  return call(api, {
    method, url: `/api/${fn}?op=${op}&id=${ID}`, cookie,
    origin: method === 'POST' ? origin : undefined, body: method === 'POST' ? {} : undefined,
  });
}

describe('every teacher op', () => {
  for (const [method, ops] of Object.entries(TEACHER_OPS)) {
    for (const op of ops) {
      it(`${method} ${op}: 401 without login, 403 for students`, async () => {
        expect((await request(teacherApi, 'teacher', method, op)).statusCode).toBe(401);
        expect((await request(teacherApi, 'teacher', method, op, studentCookie)).statusCode).toBe(403);
      });
    }
  }
});

describe('every student op', () => {
  for (const [method, ops] of Object.entries(STUDENT_OPS)) {
    for (const op of ops) {
      it(`${method} ${op}: 401 without login, 403 for teachers`, async () => {
        expect((await request(studentApi, 'student', method, op)).statusCode).toBe(401);
        expect((await request(studentApi, 'student', method, op, teacherCookie)).statusCode).toBe(403);
      });
    }
  }
});

describe('CSRF: POST must come from this app', () => {
  const cases = [
    [authApi, 'auth', 'logout'], [linkApi, 'link', 'student'], [teacherApi, 'teacher', 'create-assignment'], [studentApi, 'student', 'checkin'],
  ];
  for (const [api, fn, op] of cases) {
    it(`${fn}?op=${op} rejects missing or foreign Origin`, async () => {
      const cookie = fn === 'student' ? studentCookie : teacherCookie;
      const evil = await request(api, fn, 'POST', op, cookie, 'https://evil.example');
      expect(evil.statusCode).toBe(403);
      const none = await call(api, { method: 'POST', url: `/api/${fn}?op=${op}`, cookie, body: {} });
      expect(none.statusCode).toBe(403);
    });
  }
});

describe('ownership and leaks', () => {
  it('ids that do not belong to the teacher → 404 (not 403)', async () => {
    for (const op of ['assignment', 'board', 'attendance-live', 'attendance-session']) {
      const res = await request(teacherApi, 'teacher', 'GET', op, teacherCookie);
      expect(res.statusCode).toBe(404);
    }
  });

  it('error responses never include stack traces', async () => {
    const res = await call(teacherApi, { url: '/api/teacher?op=board&id=not-a-uuid', cookie: teacherCookie });
    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|Error:/);
  });

  it('unknown ops → 404', async () => {
    expect((await call(teacherApi, { url: '/api/teacher?op=__proto__', cookie: teacherCookie })).statusCode).toBe(404);
    expect((await call(teacherApi, { url: '/api/teacher?op=toString', cookie: teacherCookie })).statusCode).toBe(404);
  });
});

describe('security headers (vercel.json)', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const all = Object.fromEntries(config.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));

  it('sets nosniff, referrer policy, permissions policy and CSP', () => {
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(all['Permissions-Policy']).toMatch(/camera=\(self/);
    expect(all['Permissions-Policy']).toMatch(/geolocation=\(\)/);
  });

  it('CSP: no inline scripts, QR data images allowed', () => {
    const csp = all['Content-Security-Policy'];
    const script = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(script).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp).toMatch(/img-src[^;]*data:/);
    expect(csp).toMatch(/object-src 'none'/);
  });
});
