import { beforeEach, describe, expect, it } from 'vitest';
import { call, freshDb, loginAs, setupEnv, studentRow, teacherRow } from './helpers.js';
import { linkStudent, linkTeacher } from '../lib/services/link.js';
import authApi from '../api/auth.js';
import linkApi from '../api/link.js';
import teacherApi from '../api/teacher.js';
import studentApi from '../api/student.js';

let fake;
const ctx = (lineUserId, role = 'unlinked') => ({ session: { lineUserId }, role });

beforeEach(() => {
  setupEnv();
  fake = freshDb();
});

describe('link student', () => {
  it('previews without saving, then links on confirm', async () => {
    const preview = await linkStudent(ctx('U_s1'), { studentCode: '65001', verifyCode: '111111' });
    expect(preview.preview).toMatchObject({ first_name: 'สมชาย', classroom: 'ม.2/1', number: 1 });
    expect(preview.preview.verify_code).toBeUndefined();
    expect(studentRow(fake, '65001').line_user_id).toBeNull();

    const done = await linkStudent(ctx('U_s1'), { studentCode: ' 65001 ', verifyCode: '111 111', confirm: true });
    expect(done.linked).toBe(true);
    expect(studentRow(fake, '65001').line_user_id).toBe('U_s1');
  });

  it('same message for unknown code and wrong verify code', async () => {
    const a = linkStudent(ctx('U_s1'), { studentCode: '99999', verifyCode: '111111' });
    const b = linkStudent(ctx('U_s1'), { studentCode: '65001', verifyCode: '999999' });
    await expect(a).rejects.toMatchObject({ status: 400, message: 'รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
    await expect(b).rejects.toMatchObject({ status: 400, message: 'รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
  });

  it('cannot link a code already linked to another LINE account', async () => {
    await linkStudent(ctx('U_s1'), { studentCode: '65001', verifyCode: '111111', confirm: true });
    await expect(linkStudent(ctx('U_s2'), { studentCode: '65001', verifyCode: '111111', confirm: true }))
      .rejects.toMatchObject({ status: 409, message: expect.stringMatching(/ถูกผูกกับบัญชี LINE อื่นแล้ว/) });
  });

  it('inactive students cannot link', async () => {
    studentRow(fake, '65002').active = false;
    await expect(linkStudent(ctx('U_s1'), { studentCode: '65002', verifyCode: '222222' })).rejects.toMatchObject({ status: 400 });
  });

  it('already linked users cannot link again', async () => {
    await expect(linkStudent(ctx('U_s1', 'student'), { studentCode: '65001', verifyCode: '111111' })).rejects.toMatchObject({ status: 409 });
  });

  it('rate limits after 5 wrong attempts in 15 minutes', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(linkStudent(ctx('U_bad'), { studentCode: '65001', verifyCode: '000000' })).rejects.toMatchObject({ status: 400 });
    }
    await expect(linkStudent(ctx('U_bad'), { studentCode: '65001', verifyCode: '111111' })).rejects.toMatchObject({ status: 429 });
  });
});

describe('link teacher', () => {
  it('links with case-insensitive registration code', async () => {
    const res = await linkTeacher(ctx('U_t1'), { teacherCode: 'T001', regCode: 'test01', confirm: true });
    expect(res.role).toBe('teacher');
    expect(teacherRow(fake, 'T001').line_user_id).toBe('U_t1');
  });
});

describe('end to end through the API', () => {
  it('student links, then gets student role; teacher ops are forbidden', async () => {
    let cookie = await loginAs(authApi, 'U_s1');
    const res = await call(linkApi, {
      method: 'POST', url: '/api/link?op=student', origin: 'http://localhost:3000', cookie,
      body: { studentCode: '65001', verifyCode: '111111', confirm: true },
    });
    expect(res.statusCode).toBe(200);
    cookie = await loginAs(authApi, 'U_s1');
    const me = await call(authApi, { url: '/api/auth?op=me', cookie });
    expect(me.body.role).toBe('student');
    expect(JSON.stringify(me.body)).not.toMatch(/verify_code|line_user_id|111111/);
    expect((await call(teacherApi, { url: '/api/teacher?op=assignments', cookie })).statusCode).toBe(403);
    expect((await call(studentApi, { url: '/api/student?op=assignments', cookie })).statusCode).toBe(200);
  });
});
