import { createApi } from '../lib/http.js';
import { requireRole } from '../lib/guard.js';
import { getStudentAssignment, listStudentAssignments, submitAssignment } from '../lib/services/assignments.js';
import { checkIn, openForStudent, studentAttendance } from '../lib/services/attendance.js';
import { studentDashboard } from '../lib/services/dashboard.js';

// Every op: student only. The student id always comes from the session, never from the request.
const studentOp = (method, fn) => ({
  method,
  handler: async (ctx) => {
    const auth = await requireRole(ctx.req, 'student');
    return fn(auth.student, ctx, auth);
  },
});

export default createApi({
  dashboard: studentOp('GET', (s) => studentDashboard(s)),
  assignments: studentOp('GET', (s) => listStudentAssignments(s)),
  assignment: studentOp('GET', (s, { query }) => getStudentAssignment(s, query.id)),
  submit: studentOp('POST', (s, { query, body }) => submitAssignment(s, query.id, body)),
  'attendance-open': studentOp('GET', (s) => openForStudent(s)),
  attendance: studentOp('GET', (s) => studentAttendance(s)),
  checkin: studentOp('POST', (s, { body }, auth) => checkIn(auth, body)),
});
