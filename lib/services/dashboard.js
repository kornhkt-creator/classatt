import * as assignmentsRepo from '../repos/assignments.js';
import * as attendanceRepo from '../repos/attendance.js';
import * as studentsRepo from '../repos/students.js';
import { thaiDateKey, thaiDayRange } from '../time.js';
import { listStudentAssignments, progressItem } from './assignments.js';
import { countRecords, openForStudent } from './attendance.js';

// ---------- Student ----------

export function topTasks(items, limit = 3) {
  return items.filter((i) => i.status === 'not_submitted' || i.status === 'revise').slice(0, limit);
}

export async function studentDashboard(student, now = new Date()) {
  const [{ items, summary }, open, todayRecords] = await Promise.all([
    listStudentAssignments(student, now),
    openForStudent(student, now),
    todayStudentRecords(student, now),
  ]);
  return {
    student: { firstName: student.first_name, classroom: student.classroom, number: student.number },
    taskStats: {
      total: summary.total,
      approved: summary.approved,
      pending: summary.pending,
      submitted: summary.submitted,
      overdue: summary.overdue,
    },
    topTasks: topTasks(items),
    openAttendance: open.items,
    checkedToday: todayRecords,
  };
}

async function todayStudentRecords(student, now) {
  const [start, end] = thaiDayRange(thaiDateKey(now));
  const records = (await attendanceRepo.listRecordsByStudent(student.id, 20))
    .filter((r) => new Date(r.checked_at) >= start && new Date(r.checked_at) < end);
  if (!records.length) return [];
  const sessions = await attendanceRepo.listSessionsByIds(records.map((r) => r.session_id));
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return records
    .filter((r) => byId.has(r.session_id))
    .map((r) => ({ subject: byId.get(r.session_id).subject, status: r.status, checkedAt: r.checked_at }));
}

// ---------- Teacher ----------

export function pickTodaySession(sessions, now = new Date()) {
  const [start, end] = thaiDayRange(thaiDateKey(now));
  const today = sessions.filter((s) => new Date(s.starts_at) >= start && new Date(s.starts_at) < end);
  return today.find((s) => s.status === 'open') || today[0] || null;
}

export async function teacherDashboard(teacher, now = new Date()) {
  const [start] = thaiDayRange(thaiDateKey(now));
  const [assignments, sessions] = await Promise.all([
    assignmentsRepo.listByTeacher(teacher.id),
    attendanceRepo.listSessionsByTeacher(teacher.id, start.toISOString()),
  ]);
  const progress = await assignmentsRepo.getProgress(assignments.map((a) => a.id));
  const byId = new Map(progress.map((p) => [p.assignment_id, p]));
  const items = assignments.map((a) => progressItem(a, byId.get(a.id), now));
  const open = items.filter((i) => i.status === 'open');

  const session = pickTodaySession(sessions, now);
  let todaySession = null;
  if (session) {
    const [students, records] = await Promise.all([
      studentsRepo.listByClassroom(session.classroom),
      attendanceRepo.listRecords(session.id),
    ]);
    const ids = new Set(students.map((s) => s.id));
    todaySession = {
      id: session.id, classroom: session.classroom, subject: session.subject, title: session.title,
      starts_at: session.starts_at, isOpen: session.status === 'open',
      counts: countRecords(records.filter((r) => ids.has(r.student_id)), students.length),
    };
  }

  const recent = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  const reviewedTotal = items.reduce((n, i) => n + i.approved, 0);
  const sentTotal = items.reduce((n, i) => n + i.approved + i.submitted, 0);
  return {
    teacher: { name: teacher.name },
    todaySession,
    workStats: {
      openAssignments: open.length,
      toReview: items.reduce((n, i) => n + i.submitted, 0),
      overdueAssignments: open.filter((i) => i.overdue).length,
      classrooms: new Set(assignments.map((a) => a.classroom)).size,
      reviewed: reviewedTotal,
      sent: sentTotal,
    },
    recentAssignments: recent,
  };
}
