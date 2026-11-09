import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb, publicStudent, publicTeacher, setupEnv } from './helpers.js';
import {
  createAssignments, getBoard, getOverview, getStudentAssignment, getTeacherAssignment, listStudentAssignments,
  listTeacherAssignments, reviewSubmissions, submitAssignment, updateAssignment,
} from '../lib/services/assignments.js';
import { createAssignmentSchema } from '../lib/validators/assignment.js';
import { submitSchema } from '../lib/validators/submission.js';
import { buildMatrix } from '../lib/services/board.js';

let fake;
let t1;
let t2;

async function createOne(overrides = {}) {
  const res = await createAssignments(t1, {
    title: 'แบบฝึกหัดบทที่ 1', subject: 'คณิตศาสตร์', classrooms: ['ม.2/1'], dueDate: '2099-11-20', dueTime: '23:59', ...overrides,
  });
  return res.ids[0];
}

beforeEach(() => {
  setupEnv();
  fake = freshDb();
  t1 = publicTeacher(fake, 'T001');
  t2 = publicTeacher(fake, 'T002');
});

describe('validators', () => {
  it('assignment: Thai messages', () => {
    const r = createAssignmentSchema.safeParse({ title: '  ', subject: 'x', classrooms: ['ม.2/1'], dueDate: '2026-11-20' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toBe('กรุณากรอกชื่องาน');
    expect(createAssignmentSchema.safeParse({ title: 'a', subject: 'x', classrooms: [], dueDate: '2026-11-20' }).error.issues[0].message)
      .toMatch(/ห้องเรียน/);
  });

  it('submission: rejects javascript: links, too long text and empty form', () => {
    expect(submitSchema.safeParse({ linkUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(submitSchema.safeParse({ note: 'x'.repeat(501) }).success).toBe(false);
    expect(submitSchema.safeParse({ note: '  ', linkUrl: '' }).success).toBe(false);
    expect(submitSchema.safeParse({ linkUrl: 'https://drive.google.com/x' }).success).toBe(true);
  });
});

describe('teacher assignments', () => {
  it('creates one row per classroom with Thai due time', async () => {
    const res = await createAssignments(t1, {
      title: 'งาน', subject: 'คณิตศาสตร์', classrooms: ['ม.2/1', 'ม.2/2'], dueDate: '2026-11-20', dueTime: '23:59',
    });
    expect(res.created).toBe(2);
    expect(fake._db.assignments.map((a) => a.classroom).sort()).toEqual(['ม.2/1', 'ม.2/2']);
    expect(fake._db.assignments[0].due_at).toBe('2026-11-20T16:59:00.000Z');
    const { items } = await listTeacherAssignments(t1, 'open');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ total: 4, done: 0 });
  });

  it('rejects unknown classrooms', async () => {
    await expect(createAssignments(t1, { title: 'a', subject: 'b', classrooms: ['ม.9/9'], dueDate: '2026-11-20' }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('other teachers get 404, also for malformed ids', async () => {
    const id = await createOne();
    await expect(getTeacherAssignment(t2, id)).rejects.toMatchObject({ status: 404 });
    await expect(updateAssignment(t2, id, { title: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(getBoard(t2, id)).rejects.toMatchObject({ status: 404 });
    await expect(getTeacherAssignment(t1, 'not-a-uuid')).rejects.toMatchObject({ status: 404 });
  });

  it('update keeps the Thai time when only the date changes, and can close', async () => {
    const id = await createOne();
    const { assignment } = await updateAssignment(t1, id, { dueDate: '2099-12-01' });
    expect(assignment.dueTime).toBe('23:59');
    expect(assignment.dueDate).toBe('2099-12-01');
    await updateAssignment(t1, id, { status: 'closed' });
    expect((await listTeacherAssignments(t1, 'closed')).items).toHaveLength(1);
  });

  it('review: approve / revise / reset, students outside the room are rejected', async () => {
    const id = await createOne();
    const s1 = publicStudent(fake, '65001');
    const s2 = publicStudent(fake, '65002');
    const outsider = publicStudent(fake, '65005');
    let board = await reviewSubmissions(t1, id, { studentIds: [s1.id, s2.id], action: 'approve' });
    expect(board.summary).toMatchObject({ approved: 2, not_submitted: 2 });
    expect(fake._db.submissions).toHaveLength(2);

    await expect(reviewSubmissions(t1, id, { studentIds: [s1.id], action: 'revise' })).rejects.toMatchObject({ name: 'ZodError' });
    board = await reviewSubmissions(t1, id, { studentIds: [s1.id], action: 'revise', comment: 'แก้ข้อ 3' });
    expect(board.rows.find((r) => r.student.id === s1.id)).toMatchObject({ status: 'revise', submission: { teacher_comment: 'แก้ข้อ 3' } });

    board = await reviewSubmissions(t1, id, { studentIds: [s1.id], action: 'reset' });
    expect(board.rows.find((r) => r.student.id === s1.id).status).toBe('not_submitted');
    expect(fake._db.submissions).toHaveLength(2); // upsert, no duplicates

    await expect(reviewSubmissions(t1, id, { studentIds: [outsider.id], action: 'approve' })).rejects.toMatchObject({ status: 400 });
  });

  it('board never exposes secret student fields', async () => {
    const id = await createOne();
    const board = await getBoard(t1, id);
    expect(JSON.stringify(board)).not.toMatch(/verify_code|line_user_id|111111/);
  });

  it('overview matrix and outstanding counts', async () => {
    const id = await createOne({ dueDate: '2000-01-01' }); // already past due
    const s1 = publicStudent(fake, '65001');
    await reviewSubmissions(t1, id, { studentIds: [s1.id], action: 'approve' });
    const o = await getOverview(t1, { room: 'ม.2/1' });
    expect(o.room).toBe('ม.2/1');
    expect(o.cells[s1.id][id]).toBe('approved');
    const s2 = publicStudent(fake, '65002');
    expect(o.cells[s2.id][id]).toBe('missing');
    expect(o.outstanding[s1.id]).toBe(0);
    expect(o.outstanding[s2.id]).toBe(1);
    // other teacher sees nothing
    expect((await getOverview(t2, { room: 'ม.2/1' })).assignments).toHaveLength(0);
  });

  it('buildMatrix: pending before due date', () => {
    const { cells } = buildMatrix([{ id: 's' }], [{ id: 'a', due_at: '2099-01-01T00:00:00Z' }], []);
    expect(cells.s.a).toBe('pending');
  });
});

describe('student assignments', () => {
  it('sees only own classroom and can submit; late is computed on the server', async () => {
    const id = await createOne({ dueDate: '2000-01-01' });
    await createAssignments(t1, { title: 'งานห้องอื่น', subject: 'ไทย', classrooms: ['ม.2/2'], dueDate: '2099-01-01' });
    const s1 = publicStudent(fake, '65001');
    const list = await listStudentAssignments(s1);
    expect(list.items.map((i) => i.title)).toEqual(['แบบฝึกหัดบทที่ 1']);
    expect(list.items[0].overdue).toBe(true);

    const res = await submitAssignment(s1, id, { note: 'ส่งที่โต๊ะครูแล้ว', linkUrl: 'https://drive.google.com/x' });
    expect(res.status).toBe('submitted');
    expect(res.submission.is_late).toBe(true);
  });

  it('other classroom → 404, approved → 409, closed → 409, javascript: → validation error', async () => {
    const id = await createOne();
    const s1 = publicStudent(fake, '65001');
    const other = publicStudent(fake, '65005');
    await expect(getStudentAssignment(other, id)).rejects.toMatchObject({ status: 404 });
    await expect(submitAssignment(s1, id, { linkUrl: 'javascript:alert(1)' })).rejects.toMatchObject({ name: 'ZodError' });

    await reviewSubmissions(t1, id, { studentIds: [s1.id], action: 'approve' });
    await expect(submitAssignment(s1, id, { note: 'again' })).rejects.toMatchObject({ status: 409 });

    const s2 = publicStudent(fake, '65002');
    await updateAssignment(t1, id, { status: 'closed' });
    await expect(submitAssignment(s2, id, { note: 'late' })).rejects.toMatchObject({ status: 409 });
  });

  it('revise → resubmit clears the old teacher comment', async () => {
    const id = await createOne();
    const s1 = publicStudent(fake, '65001');
    await submitAssignment(s1, id, { note: 'v1' });
    await reviewSubmissions(t1, id, { studentIds: [s1.id], action: 'revise', comment: 'แก้ข้อ 2' });
    let view = await getStudentAssignment(s1, id);
    expect(view.item).toMatchObject({ status: 'revise', teacher_comment: 'แก้ข้อ 2' });
    view = await submitAssignment(s1, id, { note: 'v2' });
    expect(view.submission).toMatchObject({ status: 'submitted', teacher_comment: null, note: 'v2' });
  });
});
