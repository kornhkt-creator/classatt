import { beforeEach, describe, expect, it } from 'vitest';
import { call, freshDb, loginAs, publicStudent, publicTeacher, setupEnv } from './helpers.js';
import { createAssignments, reviewSubmissions, submitAssignment } from '../lib/services/assignments.js';
import { createSession } from '../lib/services/attendance.js';
import { studentDashboard, teacherDashboard, topTasks } from '../lib/services/dashboard.js';
import authApi from '../api/auth.js';
import linkApi from '../api/link.js';
import teacherApi from '../api/teacher.js';

let fake;
let t1;

beforeEach(() => {
  setupEnv();
  fake = freshDb();
  t1 = publicTeacher(fake, 'T001');
});

describe('student dashboard', () => {
  it('counts tasks and lists top tasks (overdue first)', async () => {
    const now = new Date('2026-11-10T03:00:00Z');
    const { ids } = await createAssignments(t1, { title: 'A', subject: 'ไทย', classrooms: ['ม.2/1'], dueDate: '2026-11-11' });
    await createAssignments(t1, { title: 'B (เลยกำหนด)', subject: 'ไทย', classrooms: ['ม.2/1'], dueDate: '2026-11-01' });
    await createAssignments(t1, { title: 'C', subject: 'ไทย', classrooms: ['ม.2/1'], dueDate: '2026-12-01' });
    const s = publicStudent(fake, '65001');
    await submitAssignment(s, ids[0], { note: 'ส่งแล้ว' }, now);

    const d = await studentDashboard(s, now);
    expect(d.taskStats).toMatchObject({ total: 3, submitted: 1, pending: 2, approved: 0, overdue: 1 });
    expect(d.topTasks.map((t) => t.title)).toEqual(['B (เลยกำหนด)', 'C']);
    expect(d.openAttendance).toEqual([]);
  });

  it('topTasks keeps only unfinished tasks', () => {
    expect(topTasks([{ status: 'approved' }, { status: 'revise' }, { status: 'not_submitted' }])).toHaveLength(2);
  });
});

describe('teacher dashboard', () => {
  it('shows work stats without a session and attendance stats with one today', async () => {
    const now = new Date('2026-11-10T03:00:00Z');
    const { ids } = await createAssignments(t1, { title: 'A', subject: 'ไทย', classrooms: ['ม.2/1'], dueDate: '2026-11-20' });
    const s = publicStudent(fake, '65001');
    await submitAssignment(s, ids[0], { note: 'x' }, now);
    let d = await teacherDashboard(t1, now);
    expect(d.todaySession).toBeNull();
    expect(d.workStats).toMatchObject({ openAssignments: 1, toReview: 1, classrooms: 1 });
    expect(d.recentAssignments).toHaveLength(1);

    await createSession(t1, { classroom: 'ม.2/1', subject: 'ไทย' }, now);
    d = await teacherDashboard(t1, now);
    expect(d.todaySession).toMatchObject({ classroom: 'ม.2/1', isOpen: true, counts: { total: 4, notYet: 4 } });

    await reviewSubmissions(t1, ids[0], { studentIds: [s.id], action: 'approve' });
    d = await teacherDashboard(t1, now);
    expect(d.workStats).toMatchObject({ toReview: 0, reviewed: 1, sent: 1 });
  });
});

describe('api role guard', () => {
  it('a linked student cannot call the teacher dashboard', async () => {
    let cookie = await loginAs(authApi, 'U_s1');
    await call(linkApi, {
      method: 'POST', url: '/api/link?op=student', origin: 'http://localhost:3000', cookie,
      body: { studentCode: '65001', verifyCode: '111111', confirm: true },
    });
    cookie = await loginAs(authApi, 'U_s1');
    expect((await call(teacherApi, { url: '/api/teacher?op=dashboard', cookie })).statusCode).toBe(403);
  });
});
