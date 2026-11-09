import { beforeEach, describe, expect, it } from 'vitest';
import { call, fakeReq, freshDb, loginAs, setupEnv } from './helpers.js';
import { createSessionCookie, readSession } from '../lib/session.js';
import { verifyIdToken } from '../lib/line-verify.js';
import { getEnv, missingEnv } from '../lib/env.js';
import authApi from '../api/auth.js';
import teacherApi from '../api/teacher.js';
import studentApi from '../api/student.js';
import { createApi } from '../lib/http.js';
import { z } from 'zod';

beforeEach(() => {
  setupEnv();
  freshDb();
});

describe('env', () => {
  it('lists every missing variable in Thai', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.LIFF_ID;
    expect(missingEnv()).toEqual(['SUPABASE_URL', 'LIFF_ID']);
    expect(() => getEnv()).toThrow(/SUPABASE_URL, LIFF_ID/);
  });

  it('rejects a short SESSION_SECRET', () => {
    process.env.SESSION_SECRET = 'short';
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
  });
});

describe('session cookie', () => {
  it('round-trips and rejects tampering', async () => {
    const cookie = (await createSessionCookie({ lineUserId: 'U1', displayName: 'A' }, fakeReq())).split(';')[0];
    expect(await readSession(fakeReq({ cookie }))).toMatchObject({ lineUserId: 'U1', displayName: 'A' });
    const tampered = `${cookie.slice(0, -3)}abc`;
    expect(await readSession(fakeReq({ cookie: tampered }))).toBeNull();
  });

  it('is Secure except on localhost', async () => {
    expect(await createSessionCookie({ lineUserId: 'U1' }, fakeReq({ host: 'app.vercel.app' }))).toMatch(/Secure/);
    expect(await createSessionCookie({ lineUserId: 'U1' }, fakeReq())).not.toMatch(/Secure/);
  });
});

describe('verifyIdToken', () => {
  it('accepts mock tokens only on localhost with DEV_MOCK_LOGIN outside production', async () => {
    await expect(verifyIdToken('mock:U_test', fakeReq())).resolves.toMatchObject({ lineUserId: 'U_test' });
    await expect(verifyIdToken('mock:U_test', fakeReq({ host: 'app.vercel.app' }))).rejects.toMatchObject({ status: 401 });
    process.env.VERCEL_ENV = 'production';
    await expect(verifyIdToken('mock:U_test', fakeReq())).rejects.toMatchObject({ status: 401 });
    delete process.env.VERCEL_ENV;
    process.env.DEV_MOCK_LOGIN = 'false';
    await expect(verifyIdToken('mock:U_test', fakeReq())).rejects.toMatchObject({ status: 401 });
  });

  it('verifies real tokens with LINE and detects expiry', async () => {
    const ok = async () => ({ ok: true, json: async () => ({ sub: 'Uabc', name: 'Somchai', picture: 'https://x/p.png' }) });
    await expect(verifyIdToken('real', fakeReq(), ok)).resolves.toEqual({ lineUserId: 'Uabc', displayName: 'Somchai', pictureUrl: 'https://x/p.png' });
    const expired = async () => ({ ok: false, json: async () => ({ error: 'invalid_request', error_description: 'IdToken expired.' }) });
    await expect(verifyIdToken('real', fakeReq(), expired)).rejects.toMatchObject({ code: 'token_expired' });
    const bad = async () => ({ ok: false, json: async () => ({ error_description: 'Invalid IdToken.' }) });
    await expect(verifyIdToken('real', fakeReq(), bad)).rejects.toMatchObject({ code: 'invalid_token' });
  });
});

describe('api router', () => {
  const api = createApi({
    ping: { method: 'GET', handler: async () => ({ pong: true }) },
    save: { method: 'POST', handler: async ({ body }) => z.object({ name: z.string().min(1, 'กรุณากรอกชื่อ') }).parse(body) },
  });

  it('dispatches ops and validates method/origin', async () => {
    expect((await call(api, { url: '/api/x?op=ping' })).body).toEqual({ pong: true });
    expect((await call(api, { url: '/api/x?op=nope' })).statusCode).toBe(404);
    expect((await call(api, { url: '/api/x?op=save' })).statusCode).toBe(405);
    expect((await call(api, { method: 'POST', url: '/api/x?op=save', body: { name: 'a' } })).statusCode).toBe(403);
    const evil = await call(api, { method: 'POST', url: '/api/x?op=save', origin: 'https://evil.example', body: { name: 'a' } });
    expect(evil.statusCode).toBe(403);
    const bad = await call(api, { method: 'POST', url: '/api/x?op=save', origin: 'http://localhost:3000', body: { name: '' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.error.message).toBe('กรุณากรอกชื่อ');
  });
});

describe('auth api', () => {
  it('logs in with a mock token, then /me works; unlinked user has role unlinked', async () => {
    const cookie = await loginAs(authApi, 'U_new');
    const me = await call(authApi, { url: '/api/auth?op=me', cookie });
    expect(me.statusCode).toBe(200);
    expect(me.body.role).toBe('unlinked');
    expect((await call(authApi, { url: '/api/auth?op=me' })).statusCode).toBe(401);
  });

  it('rejects a fake token', async () => {
    const res = await call(authApi, { method: 'POST', url: '/api/auth?op=line', origin: 'http://localhost:3000', body: { idToken: 'mock:bad id!' } });
    expect(res.statusCode).toBe(401);
    expect(res.body.error.message).toMatch(/LINE/);
  });

  it('role guard: unlinked user cannot call teacher or student ops', async () => {
    const cookie = await loginAs(authApi, 'U_new');
    expect((await call(teacherApi, { url: '/api/teacher?op=dashboard', cookie })).statusCode).toBe(403);
    expect((await call(studentApi, { url: '/api/student?op=dashboard', cookie })).statusCode).toBe(403);
  });
});
