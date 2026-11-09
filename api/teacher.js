import { createApi } from '../lib/http.js';
import { requireRole } from '../lib/guard.js';
import {
  createAssignments, getBoard, getOverview, getTeacherAssignment, listClassrooms, listTeacherAssignments,
  listTeacherSubjects, reviewSubmissions, updateAssignment,
} from '../lib/services/assignments.js';
import {
  attendanceReport, closeSession, createSession, listTeacherSessions, liveSession, markAttendance, sessionRoster,
} from '../lib/services/attendance.js';
import { teacherDashboard } from '../lib/services/dashboard.js';

// Every op: teacher only. The teacher id always comes from the session, never from the request.
const teacherOp = (method, fn) => ({
  method,
  handler: async (ctx) => {
    const { teacher } = await requireRole(ctx.req, 'teacher');
    return fn(teacher, ctx);
  },
});

export default createApi({
  dashboard: teacherOp('GET', (t) => teacherDashboard(t)),

  // ----- Assignments -----
  assignments: teacherOp('GET', (t, { query }) => listTeacherAssignments(t, query.status)),
  assignment: teacherOp('GET', (t, { query }) => getTeacherAssignment(t, query.id)),
  classrooms: teacherOp('GET', () => listClassrooms()),
  subjects: teacherOp('GET', (t) => listTeacherSubjects(t)),
  board: teacherOp('GET', (t, { query }) => getBoard(t, query.id)),
  overview: teacherOp('GET', (t, { query }) => getOverview(t, { room: query.room, subject: query.subject })),
  'create-assignment': teacherOp('POST', (t, { body }) => createAssignments(t, body)),
  'update-assignment': teacherOp('POST', (t, { query, body }) => updateAssignment(t, query.id, body)),
  review: teacherOp('POST', (t, { query, body }) => reviewSubmissions(t, query.id, body)),

  // ----- Attendance -----
  'attendance-sessions': teacherOp('GET', (t) => listTeacherSessions(t)),
  'attendance-live': teacherOp('GET', (t, { query, req }) => liveSession(t, query.id, req)),
  'attendance-session': teacherOp('GET', (t, { query }) => sessionRoster(t, query.id)),
  'attendance-report': teacherOp('GET', (t, { query }) => attendanceReport(t, {
    room: query.room, subject: query.subject, from: query.from, to: query.to,
  })),
  'create-attendance': teacherOp('POST', (t, { body }) => createSession(t, body)),
  'mark-attendance': teacherOp('POST', (t, { query, body }) => markAttendance(t, query.id, body)),
  'close-attendance': teacherOp('POST', (t, { query }) => closeSession(t, query.id)),
});
