import * as assignmentsRepo from '../repos/assignments.js';
import * as submissionsRepo from '../repos/submissions.js';
import * as studentsRepo from '../repos/students.js';
import * as teachersRepo from '../repos/teachers.js';
import * as attendanceRepo from '../repos/attendance.js';
import * as audit from '../repos/audit.js';
import { badRequest, conflict, notFound } from '../http.js';
import { isDueSoon, isLate, thaiDateKey, thaiTimeKey, toDueAt } from '../time.js';
import { createAssignmentSchema, idSchema, reviewSchema, updateAssignmentSchema } from '../validators/assignment.js';
import { submitSchema } from '../validators/submission.js';
import { buildBoard, buildMatrix, isOverdue, submissionStatus } from './board.js';

const NOT_FOUND = 'ไม่พบงานนี้';

function parseId(id) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw notFound(NOT_FOUND);
  return parsed.data;
}

// ---------- Teacher ----------

export async function getOwnedAssignment(teacher, id) {
  const assignment = await assignmentsRepo.getById(parseId(id));
  if (!assignment || assignment.teacher_id !== teacher.id) throw notFound(NOT_FOUND);
  return assignment;
}

function publicAssignment(a) {
  return {
    id: a.id, title: a.title, description: a.description, subject: a.subject, classroom: a.classroom,
    due_at: a.due_at, status: a.status, created_at: a.created_at, updated_at: a.updated_at,
  };
}

export function progressItem(assignment, progress, now = new Date()) {
  const p = progress || { total_students: 0, submitted_count: 0, approved_count: 0, revise_count: 0, late_count: 0 };
  const done = p.submitted_count + p.approved_count;
  return {
    ...publicAssignment(assignment),
    total: p.total_students,
    done,
    submitted: p.submitted_count,
    approved: p.approved_count,
    revise: p.revise_count,
    late: p.late_count,
    overdue: isOverdue(assignment, now) && done < p.total_students,
  };
}

export async function listTeacherAssignments(teacher, filter, now = new Date()) {
  const status = filter === 'open' || filter === 'closed' ? filter : undefined;
  const assignments = await assignmentsRepo.listByTeacher(teacher.id, { status });
  const progress = await assignmentsRepo.getProgress(assignments.map((a) => a.id));
  const byId = new Map(progress.map((p) => [p.assignment_id, p]));
  let items = assignments.map((a) => progressItem(a, byId.get(a.id), now));
  if (filter === 'review') items = items.filter((i) => i.submitted > 0);
  return { items };
}

export async function listClassrooms() {
  return { classrooms: await studentsRepo.listClassrooms() };
}

export async function listTeacherSubjects(teacher) {
  const [assignments, sessions] = await Promise.all([
    assignmentsRepo.listByTeacher(teacher.id),
    attendanceRepo.listTeacherRoomsAndSubjects(teacher.id),
  ]);
  const subjects = [...new Set([...assignments.map((a) => a.subject), ...sessions.map((s) => s.subject)])]
    .sort((a, b) => a.localeCompare(b, 'th'));
  const rooms = [...new Set([...assignments.map((a) => a.classroom), ...sessions.map((s) => s.classroom)])]
    .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  return { subjects, rooms };
}

export async function createAssignments(teacher, input) {
  const data = createAssignmentSchema.parse(input);
  const known = new Set(await studentsRepo.listClassrooms());
  const classrooms = [...new Set(data.classrooms)];
  const unknown = classrooms.filter((c) => !known.has(c));
  if (unknown.length) throw badRequest(`ไม่พบห้องเรียน: ${unknown.join(', ')}`);
  const dueAt = toDueAt(data.dueDate, data.dueTime).toISOString();
  const rows = classrooms.map((classroom) => ({
    title: data.title, description: data.description, subject: data.subject, classroom,
    teacher_id: teacher.id, due_at: dueAt, status: 'open',
  }));
  const created = await assignmentsRepo.createMany(rows);
  await audit.log(`teacher:${teacher.id}`, 'create_assignment', { ids: created.map((c) => c.id), title: data.title });
  return { created: created.length, ids: created.map((c) => c.id) };
}

export async function getTeacherAssignment(teacher, id) {
  const assignment = await getOwnedAssignment(teacher, id);
  return {
    assignment: { ...publicAssignment(assignment), dueDate: thaiDateKey(assignment.due_at), dueTime: thaiTimeKey(assignment.due_at) },
  };
}

export async function updateAssignment(teacher, id, input) {
  const assignment = await getOwnedAssignment(teacher, id);
  const data = updateAssignmentSchema.parse(input);
  const patch = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.subject !== undefined) patch.subject = data.subject;
  if (data.status !== undefined) patch.status = data.status;
  if (data.dueDate) patch.due_at = toDueAt(data.dueDate, data.dueTime || thaiTimeKey(assignment.due_at)).toISOString();
  if (!Object.keys(patch).length) return getTeacherAssignment(teacher, id);
  await assignmentsRepo.update(assignment.id, patch);
  await audit.log(`teacher:${teacher.id}`, data.status ? `assignment_${data.status}` : 'update_assignment', { id: assignment.id });
  return getTeacherAssignment(teacher, id);
}

export async function getBoard(teacher, id) {
  const assignment = await getOwnedAssignment(teacher, id);
  const [students, submissions] = await Promise.all([
    studentsRepo.listByClassroom(assignment.classroom),
    submissionsRepo.listByAssignment(assignment.id),
  ]);
  return { assignment: publicAssignment(assignment), ...buildBoard(assignment, students, submissions) };
}

export function buildReviewRows(assignment, studentIds, existing, action, comment, teacherId, now) {
  const nowIso = now.toISOString();
  return studentIds.map((studentId) => {
    const prev = existing.get(studentId);
    const base = {
      assignment_id: assignment.id,
      student_id: studentId,
      note: prev?.note ?? null,
      link_url: prev?.link_url ?? null,
      submitted_at: prev?.submitted_at ?? null,
      is_late: prev?.is_late ?? false,
    };
    if (action === 'approve') {
      const submittedAt = prev?.submitted_at || nowIso;
      return {
        ...base, status: 'approved', submitted_at: submittedAt,
        is_late: prev?.submitted_at ? prev.is_late : isLate(submittedAt, assignment.due_at),
        reviewed_by: teacherId, reviewed_at: nowIso, teacher_comment: null,
      };
    }
    if (action === 'revise') {
      return { ...base, status: 'revise', reviewed_by: teacherId, reviewed_at: nowIso, teacher_comment: comment };
    }
    return {
      ...base, status: 'not_submitted', note: null, link_url: null, submitted_at: null, is_late: false,
      reviewed_by: null, reviewed_at: null, teacher_comment: null,
    };
  });
}

export async function reviewSubmissions(teacher, id, input, now = new Date()) {
  const assignment = await getOwnedAssignment(teacher, id);
  const data = reviewSchema.parse(input);
  const studentIds = [...new Set(data.studentIds)];
  const students = await studentsRepo.listByClassroom(assignment.classroom);
  const inRoom = new Set(students.map((s) => s.id));
  if (studentIds.some((sid) => !inRoom.has(sid))) throw badRequest('มีนักเรียนที่ไม่ได้อยู่ในห้องของงานนี้');
  const existing = new Map((await submissionsRepo.listByAssignment(assignment.id)).map((s) => [s.student_id, s]));
  const rows = buildReviewRows(assignment, studentIds, existing, data.action, data.comment || null, teacher.id, now);
  await submissionsRepo.upsertMany(rows);
  await audit.log(`teacher:${teacher.id}`, `review_${data.action}`, { assignment: assignment.id, count: rows.length });
  return getBoard(teacher, id);
}

export async function getOverview(teacher, { room, subject } = {}, now = new Date()) {
  const all = await assignmentsRepo.listByTeacher(teacher.id);
  const rooms = [...new Set(all.map((a) => a.classroom))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  const selectedRoom = rooms.includes(room) ? room : rooms[0] || null;
  if (!selectedRoom) return { rooms, subjects: [], room: null, subject: null, students: [], assignments: [], cells: {}, outstanding: {} };
  const inRoom = all.filter((a) => a.classroom === selectedRoom);
  const subjects = [...new Set(inRoom.map((a) => a.subject))].sort((a, b) => a.localeCompare(b, 'th'));
  const selectedSubject = subjects.includes(subject) ? subject : null;
  const assignments = inRoom
    .filter((a) => !selectedSubject || a.subject === selectedSubject)
    .sort((a, b) => new Date(b.due_at) - new Date(a.due_at));
  const [students, submissions] = await Promise.all([
    studentsRepo.listByClassroom(selectedRoom),
    submissionsRepo.listByAssignments(assignments.map((a) => a.id)),
  ]);
  const { cells, outstanding } = buildMatrix(students, assignments, submissions, now);
  return {
    rooms, subjects, room: selectedRoom, subject: selectedSubject,
    students: students.map((s) => ({ id: s.id, number: s.number, prefix: s.prefix, first_name: s.first_name, last_name: s.last_name })),
    assignments: assignments.map((a) => ({ id: a.id, title: a.title, subject: a.subject, due_at: a.due_at, status: a.status })),
    cells, outstanding,
  };
}

// ---------- Student ----------

function studentItem(assignment, submission, teacherName, now) {
  const status = submissionStatus(submission);
  const overdue = isOverdue(assignment, now) && (status === 'not_submitted' || status === 'revise');
  return {
    id: assignment.id, title: assignment.title, subject: assignment.subject, due_at: assignment.due_at,
    assignmentStatus: assignment.status, teacherName, status,
    isLate: Boolean(submission?.is_late && status !== 'not_submitted'),
    overdue,
    dueSoon: !overdue && (status === 'not_submitted' || status === 'revise') && isDueSoon(assignment.due_at, now, 2),
    teacher_comment: status === 'revise' ? submission?.teacher_comment || null : null,
  };
}

export function sortStudentItems(items) {
  const rank = (i) => (i.overdue ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || new Date(a.due_at) - new Date(b.due_at));
}

export function summarizeStudentItems(items) {
  const summary = { total: items.length, pending: 0, overdue: 0, submitted: 0, approved: 0, late: 0 };
  for (const i of items) {
    if (i.status === 'not_submitted' || i.status === 'revise') summary.pending += 1;
    if (i.overdue) summary.overdue += 1;
    if (i.status === 'submitted') summary.submitted += 1;
    if (i.status === 'approved') summary.approved += 1;
    if (i.isLate) summary.late += 1;
  }
  return summary;
}

export async function listStudentAssignments(student, now = new Date()) {
  const [assignments, submissions] = await Promise.all([
    assignmentsRepo.listByClassroom(student.classroom),
    submissionsRepo.listByStudent(student.id),
  ]);
  const subs = new Map(submissions.map((s) => [s.assignment_id, s]));
  const visible = assignments.filter((a) => a.status === 'open' || submissionStatus(subs.get(a.id)) !== 'not_submitted');
  const teachers = await teachersRepo.getManyByIds(visible.map((a) => a.teacher_id));
  const names = new Map(teachers.map((t) => [t.id, t.name]));
  const items = sortStudentItems(visible.map((a) => studentItem(a, subs.get(a.id), names.get(a.teacher_id) || '', now)));
  return { items, summary: summarizeStudentItems(items) };
}

async function getVisibleAssignment(student, id) {
  const assignment = await assignmentsRepo.getById(parseId(id));
  if (!assignment || assignment.classroom !== student.classroom) throw notFound(NOT_FOUND);
  return assignment;
}

function lockReason(assignment, status) {
  if (status === 'approved') return 'ครูตรวจแล้ว';
  if (assignment.status === 'closed') return 'งานนี้ปิดรับแล้ว';
  return null;
}

export async function getStudentAssignment(student, id, now = new Date()) {
  const assignment = await getVisibleAssignment(student, id);
  const [submission, teacher] = await Promise.all([
    submissionsRepo.getOne(assignment.id, student.id),
    teachersRepo.getById(assignment.teacher_id),
  ]);
  const status = submissionStatus(submission);
  if (assignment.status === 'closed' && status === 'not_submitted') throw notFound(NOT_FOUND);
  const reason = lockReason(assignment, status);
  return {
    assignment: { ...publicAssignment(assignment), teacherName: teacher?.name || '' },
    item: studentItem(assignment, submission, teacher?.name || '', now),
    submission: submission ? {
      status: submission.status, note: submission.note, link_url: submission.link_url,
      submitted_at: submission.submitted_at, is_late: submission.is_late,
      teacher_comment: submission.teacher_comment, reviewed_at: submission.reviewed_at,
    } : null,
    status,
    canSubmit: !reason,
    lockReason: reason,
  };
}

export async function submitAssignment(student, id, input, now = new Date()) {
  const assignment = await getVisibleAssignment(student, id);
  const data = submitSchema.parse(input);
  const existing = await submissionsRepo.getOne(assignment.id, student.id);
  const reason = lockReason(assignment, submissionStatus(existing));
  if (reason) throw conflict(reason, 'locked');
  const nowIso = now.toISOString();
  await submissionsRepo.upsertMany([{
    assignment_id: assignment.id,
    student_id: student.id,
    status: 'submitted',
    note: data.note || null,
    link_url: data.linkUrl || null,
    submitted_at: nowIso,
    is_late: isLate(nowIso, assignment.due_at),
    reviewed_by: null,
    reviewed_at: null,
    teacher_comment: null,
  }]);
  return getStudentAssignment(student, id, now);
}
