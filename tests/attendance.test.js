import { beforeEach, describe, expect, it } from 'vitest';
import { fakeReq, freshDb, publicStudent, publicTeacher, setupEnv } from './helpers.js';
import { codeFor, currentCode, verifyCode, windowOf, WINDOW_SECONDS } from '../lib/attendance-code.js';
import {
  attendanceReport, buildReport, checkIn, closeSession, createSession, liveSession, markAttendance,
  openForStudent, sessionRoster, studentAttendance,
} from '../lib/services/attendance.js';
import { buildCheckinUrl } from '../lib/checkin-url.js';

let fake;
let t1;
let t2;
const T0 = new Date('2026-11-10T01:00:00Z'); // 08:00 Thai time
const at = (seconds) => new Date(T0.getTime() + seconds * 1000);
const studentCtx = (student, lineUserId = `U_${student.student_code}`) => ({ student, session: { lineUserId } });

async function open(overrides = {}) {
  const { session } = await createSession(t1, { classroom: 'ม.2/1', subject: 'คณิตศาสตร์', lateAfterMinutes: 10, ...overrides }, T0);
  return session;
}

beforeEach(() => {
  setupEnv();
  fake = freshDb();
  t1 = publicTeacher(fake, 'T001');
  t2 = publicTeacher(fake, 'T002');
});

describe('rotating attendance code', () => {
  it('is 6 digits, stable within a window and changes across windows', () => {
    const now = T0.getTime();
    const code = currentCode('session-a', now);
    expect(code).toMatch(/^\d{6}$/);
    expect(currentCode('session-a', now + 1000)).toBe(codeFor('session-a', windowOf(now + 1000)));
    expect(codeFor('session-a', 1)).not.toBe(codeFor('session-a', 2));
    expect(codeFor('session-a', 5)).not.toBe(codeFor('session-b', 5));
  });

  it('stays valid for up to 3 windows (≤ 60 s) then expires', () => {
    const start = windowOf(T0.getTime()) * WINDOW_SECONDS * 1000; // beginning of a window
    const code = currentCode('s', start);
    expect(verifyCode('s', code, start + 59_000)).toBe(true);
    expect(verifyCode('s', code, start + 60_000)).toBe(false);
    expect(verifyCode('other', code, start)).toBe(false);
    expect(verifyCode('s', 'abc', start)).toBe(false);
  });

  it('pads codes that start with zero', () => {
    for (let w = 0; w < 300; w += 1) expect(codeFor('pad', w)).toHaveLength(6);
  });

  it('QR url: miniapp in production, local url on localhost', () => {
    expect(buildCheckinUrl('sid', '123456', fakeReq({ host: 'app.vercel.app' })))
      .toBe('https://miniapp.line.me/1234567890-AbCdEf/student/checkin?s=sid&c=123456');
    expect(buildCheckinUrl('sid', '123456', fakeReq())).toBe('http://localhost:3000/student/checkin?s=sid&c=123456');
  });
});

describe('teacher sessions', () => {
  it('one open session per room per teacher; others cannot see it', async () => {
    const s = await open();
    await expect(open()).rejects.toMatchObject({ status: 409, details: { sessionId: s.id } });
    await expect(liveSession(t2, s.id, fakeReq(), T0)).rejects.toMatchObject({ status: 404 });
    const live = await liveSession(t1, s.id, fakeReq(), T0);
    expect(live.code).toMatch(/^\d{6}$/);
    expect(live.qrSvg).toMatch(/^<svg/);
    expect(live.counts).toMatchObject({ checked: 0, total: 4 });
  });
});

describe('student check-in', () => {
  it('present before the late threshold, late after it, never twice', async () => {
    const s = await open();
    const a = publicStudent(fake, '65001');
    const b = publicStudent(fake, '65002');
    const r1 = await checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, at(60).getTime()) }, at(60));
    expect(r1).toMatchObject({ status: 'present', alreadyChecked: false, subject: 'คณิตศาสตร์' });

    const r2 = await checkIn(studentCtx(b), { code: currentCode(s.id, at(11 * 60).getTime()) }, at(11 * 60));
    expect(r2.status).toBe('late');
    expect(fake._db.attendance_records.find((r) => r.student_id === b.id).method).toBe('code');

    const again = await checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, at(120).getTime()) }, at(120));
    expect(again).toMatchObject({ alreadyChecked: true, status: 'present' });
    expect(fake._db.attendance_records).toHaveLength(2);
  });

  it('expired code, other classroom, closed session', async () => {
    const s = await open();
    const a = publicStudent(fake, '65001');
    const old = currentCode(s.id, at(0).getTime());
    await expect(checkIn(studentCtx(a), { sessionId: s.id, code: old }, at(80))).rejects.toMatchObject({ status: 400 });

    const other = publicStudent(fake, '65005');
    await expect(checkIn(studentCtx(other), { sessionId: s.id, code: currentCode(s.id, T0.getTime()) }, T0))
      .rejects.toMatchObject({ status: 404, message: 'ไม่พบรอบเช็กชื่อนี้ในห้องของคุณ' });

    await closeSession(t1, s.id, at(30));
    await expect(checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, at(40).getTime()) }, at(40)))
      .rejects.toMatchObject({ status: 409 });
  });

  it('does not overwrite a status the teacher already set (e.g. leave)', async () => {
    const s = await open();
    const a = publicStudent(fake, '65001');
    await markAttendance(t1, s.id, { studentIds: [a.id], status: 'leave' }, T0);
    const res = await checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, T0.getTime()) }, T0);
    expect(res).toMatchObject({ alreadyChecked: true, status: 'leave' });
  });

  it('cannot check in after 3 hours', async () => {
    const s = await open();
    const a = publicStudent(fake, '65001');
    const late = at(3 * 3600 + 5);
    await expect(checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, late.getTime()) }, late)).rejects.toMatchObject({ status: 409 });
  });

  it('rate limits after 10 wrong codes', async () => {
    // Attempts are timestamped by the database clock, so use real time here
    const now = new Date();
    const { session: s } = await createSession(t1, { classroom: 'ม.2/1', subject: 'คณิตศาสตร์' }, now);
    const a = publicStudent(fake, '65001');
    const wrong = currentCode(s.id, now.getTime()) === '000000' ? '111111' : '000000';
    for (let i = 0; i < 10; i += 1) {
      await expect(checkIn(studentCtx(a), { sessionId: s.id, code: wrong }, now)).rejects.toMatchObject({ status: 400 });
    }
    await expect(checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, now.getTime()) }, now))
      .rejects.toMatchObject({ status: 429 });
  });

  it('student sees open sessions they have not checked yet', async () => {
    const s = await open();
    const a = publicStudent(fake, '65001');
    expect((await openForStudent(a, T0)).items).toHaveLength(1);
    await checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, T0.getTime()) }, T0);
    expect((await openForStudent(a, T0)).items).toHaveLength(0);
  });
});

describe('close, edit and report', () => {
  it('closing marks unchecked students absent without touching existing records', async () => {
    const s = await open();
    const [a, b, c, d] = ['65001', '65002', '65003', '65004'].map((code) => publicStudent(fake, code));
    await checkIn(studentCtx(a), { sessionId: s.id, code: currentCode(s.id, T0.getTime()) }, T0);
    await checkIn(studentCtx(b), { sessionId: s.id, code: currentCode(s.id, T0.getTime()) }, T0);
    await markAttendance(t1, s.id, { studentIds: [c.id], status: 'sick' }, T0);
    let roster = await sessionRoster(t1, s.id);
    expect(roster.summary).toMatchObject({ present: 2, sick: 1, notYet: 1 });

    roster = await closeSession(t1, s.id, at(600));
    expect(roster.summary).toMatchObject({ present: 2, sick: 1, absent: 1, notYet: 0 });
    expect(roster.rows.find((r) => r.student.id === d.id).record).toMatchObject({ status: 'absent', method: 'auto' });
    await expect(closeSession(t1, s.id)).rejects.toMatchObject({ status: 409 });

    // teacher can still edit after closing
    roster = await markAttendance(t1, s.id, { studentIds: [d.id], status: 'leave', note: 'ลาไปแข่งกีฬา' }, at(900));
    expect(roster.rows.find((r) => r.student.id === d.id).record).toMatchObject({ status: 'leave', method: 'manual', note: 'ลาไปแข่งกีฬา' });

    await expect(markAttendance(t1, s.id, { studentIds: [publicStudent(fake, '65005').id], status: 'present' })).rejects.toMatchObject({ status: 400 });
    await expect(markAttendance(t2, s.id, { studentIds: [a.id], status: 'present' })).rejects.toMatchObject({ status: 404 });
  });

  it('report counts only closed sessions; percent = (present + late) / sessions', async () => {
    const a = publicStudent(fake, '65001');
    const s1 = await open();
    await checkIn(studentCtx(a), { sessionId: s1.id, code: currentCode(s1.id, T0.getTime()) }, T0);
    await closeSession(t1, s1.id, at(600));
    const T1 = new Date('2026-11-11T01:00:00Z');
    const { session: s2 } = await createSession(t1, { classroom: 'ม.2/1', subject: 'คณิตศาสตร์' }, T1);
    await closeSession(t1, s2.id, new Date(T1.getTime() + 600_000)); // a → absent
    await createSession(t1, { classroom: 'ม.2/1', subject: 'คณิตศาสตร์' }, new Date('2026-11-12T01:00:00Z')); // still open: ignored

    const r = await attendanceReport(t1, { room: 'ม.2/1', from: '2026-11-01', to: '2026-11-30' });
    expect(r.sessions).toHaveLength(2);
    expect(r.totals[a.id]).toMatchObject({ present: 1, absent: 1, percent: 50, risk: true });
    expect(JSON.stringify(r)).not.toMatch(/verify_code|line_user_id/);

    const history = await studentAttendance(a);
    expect(history.overall).toMatchObject({ total: 2, percent: 50 });
    expect(history.subjects[0]).toMatchObject({ subject: 'คณิตศาสตร์', risk: true });
  });

  it('buildReport with no sessions does not divide by zero', () => {
    const { totals } = buildReport([{ id: 'x' }], [], []);
    expect(totals.x).toMatchObject({ percent: null, risk: false });
  });
});
