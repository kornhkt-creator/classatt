import * as attendanceRepo from '../repos/attendance.js';
import * as studentsRepo from '../repos/students.js';
import * as teachersRepo from '../repos/teachers.js';
import * as audit from '../repos/audit.js';
import { badRequest, conflict, notFound } from '../http.js';
import { assertNotLimited, recordAttempt } from '../rate-limit.js';
import { currentCode, verifyCode, windowEndsAt } from '../attendance-code.js';
import { buildCheckinUrl } from '../checkin-url.js';
import { toSvg } from '../qr.js';
import { addDaysKey, thaiDateKey, thaiDayRange } from '../time.js';
import { checkinSchema, createAttendanceSchema, markAttendanceSchema, reportSchema } from '../validators/attendance.js';
import { idSchema } from '../validators/assignment.js';
import { publicStudent } from './board.js';

// ===== ปรับได้ตามระเบียบของโรงเรียน =====
// เปอร์เซ็นต์เวลาเรียนขั้นต่ำ (ต่ำกว่านี้ = เสี่ยง มส.)
export const ATTENDANCE_MIN_PERCENT = 80;
// true = นับ "ลากิจ/ลาป่วย" เป็นเวลาเรียน · false = ไม่นับ (ค่าเริ่มต้น)
export const COUNT_LEAVE_AS_PRESENT = false;
// เช็กชื่อได้ไม่เกินกี่ชั่วโมงหลังเปิดรอบ
export const MAX_OPEN_HOURS = 3;
const LIST_DAYS = 14;

const NOT_FOUND = 'ไม่พบรอบเช็กชื่อ';
const NOT_FOUND_STUDENT = 'ไม่พบรอบเช็กชื่อนี้ในห้องของคุณ';

// ---------- Pure helpers ----------

export function isExpired(session, now = new Date()) {
  return new Date(now).getTime() > new Date(session.starts_at).getTime() + MAX_OPEN_HOURS * 3600 * 1000;
}

export function lateStatus(session, now = new Date()) {
  const lateAt = new Date(session.starts_at).getTime() + session.late_after_minutes * 60 * 1000;
  return new Date(now).getTime() > lateAt ? 'late' : 'present';
}

export function countRecords(records, totalStudents) {
  const c = { present: 0, late: 0, absent: 0, leave: 0, sick: 0, checked: 0, notYet: 0, total: totalStudents };
  for (const r of records) {
    c[r.status] += 1;
    c.checked += 1;
  }
  c.notYet = Math.max(0, totalStudents - c.checked);
  return c;
}

export function attendedCount(c) {
  return c.present + c.late + (COUNT_LEAVE_AS_PRESENT ? c.leave + c.sick : 0);
}

export function percentOf(c, total) {
  if (!total) return null;
  return Math.round((attendedCount(c) / total) * 1000) / 10;
}

export function summarize(records) {
  const c = { present: 0, late: 0, absent: 0, leave: 0, sick: 0 };
  for (const r of records) c[r.status] += 1;
  const total = records.length;
  return { ...c, total, percent: percentOf(c, total) };
}

export function buildRoster(students, records) {
  const byStudent = new Map(records.map((r) => [r.student_id, r]));
  const rows = students.map((s) => {
    const r = byStudent.get(s.id);
    return {
      student: publicStudent(s),
      record: r ? { status: r.status, method: r.method, checked_at: r.checked_at, note: r.note } : null,
    };
  });
  const inRoom = records.filter((r) => students.some((s) => s.id === r.student_id));
  return { rows, summary: countRecords(inRoom, students.length) };
}

export function buildReport(students, sessions, records) {
  const key = (sid, stid) => `${sid}:${stid}`;
  const recs = new Map(records.map((r) => [key(r.session_id, r.student_id), r]));
  const cells = {};
  const totals = {};
  for (const s of students) {
    cells[s.id] = {};
    const mine = [];
    for (const session of sessions) {
      const r = recs.get(key(session.id, s.id));
      cells[s.id][session.id] = r ? r.status : null;
      if (r) mine.push(r);
    }
    const c = summarize(mine);
    totals[s.id] = { ...c, percent: percentOf(c, sessions.length), risk: sessions.length > 0 && percentOf(c, sessions.length) < ATTENDANCE_MIN_PERCENT };
  }
  return { cells, totals };
}

function publicSession(s) {
  return {
    id: s.id, classroom: s.classroom, subject: s.subject, title: s.title, starts_at: s.starts_at,
    late_after_minutes: s.late_after_minutes, status: s.status, closed_at: s.closed_at,
  };
}

function parseId(id, message = NOT_FOUND) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw notFound(message);
  return parsed.data;
}

// ---------- Teacher ----------

export async function getOwnedSession(teacher, id) {
  const session = await attendanceRepo.getSession(parseId(id));
  if (!session || session.teacher_id !== teacher.id) throw notFound(NOT_FOUND);
  return session;
}

export async function createSession(teacher, input, now = new Date()) {
  const data = createAttendanceSchema.parse(input);
  const rooms = await studentsRepo.listClassrooms();
  if (!rooms.includes(data.classroom)) throw badRequest('ไม่พบห้องเรียนนี้');
  const open = await attendanceRepo.findOpenByTeacherRoom(teacher.id, data.classroom);
  if (open) throw conflict(`มีรอบเช็กชื่อห้อง ${data.classroom} เปิดอยู่แล้ว`, 'session_open', { sessionId: open.id });
  const session = await attendanceRepo.createSession({
    teacher_id: teacher.id,
    classroom: data.classroom,
    subject: data.subject,
    title: data.title || null,
    starts_at: new Date(now).toISOString(),
    late_after_minutes: data.lateAfterMinutes,
    status: 'open',
  });
  await audit.log(`teacher:${teacher.id}`, 'open_attendance', { session: session.id, classroom: session.classroom });
  return { session: publicSession(session) };
}

export async function listTeacherSessions(teacher, now = new Date()) {
  const since = thaiDayRange(addDaysKey(thaiDateKey(now), -LIST_DAYS))[0].toISOString();
  const sessions = await attendanceRepo.listSessionsByTeacher(teacher.id, since);
  const [records, students] = await Promise.all([
    attendanceRepo.listRecordsBySessions(sessions.map((s) => s.id)),
    studentsRepo.listByClassrooms(sessions.map((s) => s.classroom)),
  ]);
  const roomSize = {};
  for (const s of students) roomSize[s.classroom] = (roomSize[s.classroom] || 0) + 1;
  const bySession = {};
  for (const r of records) (bySession[r.session_id] ||= []).push(r);
  return {
    items: sessions.map((s) => ({
      ...publicSession(s),
      expired: s.status === 'open' && isExpired(s, now),
      counts: countRecords(bySession[s.id] || [], roomSize[s.classroom] || 0),
    })),
  };
}

export async function liveSession(teacher, id, req, now = new Date()) {
  const session = await getOwnedSession(teacher, id);
  if (session.status !== 'open') return { session: publicSession(session), closed: true };
  const nowMs = new Date(now).getTime();
  const [students, records] = await Promise.all([
    studentsRepo.listByClassroom(session.classroom),
    attendanceRepo.listRecords(session.id),
  ]);
  const code = currentCode(session.id, nowMs);
  const checkinUrl = buildCheckinUrl(session.id, code, req);
  const names = new Map(students.map((s) => [s.id, s]));
  const inRoom = records.filter((r) => names.has(r.student_id));
  const recent = [...inRoom]
    .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))
    .slice(0, 10)
    .map((r) => {
      const s = names.get(r.student_id);
      return { number: s.number, name: `${s.prefix}${s.first_name} ${s.last_name}`.trim(), status: r.status, checkedAt: r.checked_at };
    });
  return {
    session: publicSession(session),
    expired: isExpired(session, now),
    code,
    qrSvg: await toSvg(checkinUrl),
    checkinUrl: checkinUrl.startsWith('http://') ? checkinUrl : undefined, // shown only on localhost (dev)
    windowEndsAt: windowEndsAt(nowMs),
    serverNow: nowMs,
    counts: countRecords(inRoom, students.length),
    recent,
  };
}

export async function sessionRoster(teacher, id) {
  const session = await getOwnedSession(teacher, id);
  const [students, records] = await Promise.all([
    studentsRepo.listByClassroom(session.classroom),
    attendanceRepo.listRecords(session.id),
  ]);
  return { session: publicSession(session), ...buildRoster(students, records) };
}

export async function markAttendance(teacher, id, input, now = new Date()) {
  const session = await getOwnedSession(teacher, id);
  const data = markAttendanceSchema.parse(input);
  const students = await studentsRepo.listByClassroom(session.classroom);
  const inRoom = new Set(students.map((s) => s.id));
  const ids = [...new Set(data.studentIds)];
  if (ids.some((sid) => !inRoom.has(sid))) throw badRequest('มีนักเรียนที่ไม่ได้อยู่ในห้องของรอบนี้');
  const existing = new Map((await attendanceRepo.listRecords(session.id)).map((r) => [r.student_id, r]));
  const nowIso = new Date(now).toISOString();
  await attendanceRepo.upsertRecords(ids.map((sid) => ({
    session_id: session.id,
    student_id: sid,
    status: data.status,
    method: 'manual',
    checked_at: existing.get(sid)?.checked_at || nowIso,
    marked_by: teacher.id,
    note: data.note || null,
  })));
  await audit.log(`teacher:${teacher.id}`, 'mark_attendance', { session: session.id, status: data.status, count: ids.length });
  return sessionRoster(teacher, id);
}

export async function closeSession(teacher, id, now = new Date()) {
  const session = await getOwnedSession(teacher, id);
  if (session.status === 'closed') throw conflict('รอบเช็กชื่อนี้ปิดแล้ว', 'already_closed');
  const nowIso = new Date(now).toISOString();
  await attendanceRepo.updateSession(session.id, { status: 'closed', closed_at: nowIso });
  const students = await studentsRepo.listByClassroom(session.classroom);
  // Mark everyone without a record as absent — never overwrite existing records (e.g. "ลา")
  await attendanceRepo.insertRecordsIgnore(students.map((s) => ({
    session_id: session.id, student_id: s.id, status: 'absent', method: 'auto',
    checked_at: nowIso, marked_by: null, note: null,
  })));
  await audit.log(`teacher:${teacher.id}`, 'close_attendance', { session: session.id });
  return sessionRoster(teacher, id);
}

export async function attendanceReport(teacher, query, now = new Date()) {
  const q = reportSchema.parse(query);
  const all = await attendanceRepo.listTeacherRoomsAndSubjects(teacher.id);
  const rooms = [...new Set(all.map((s) => s.classroom))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  const room = rooms.includes(q.room) ? q.room : rooms[0] || null;
  const subjects = [...new Set(all.filter((s) => s.classroom === room).map((s) => s.subject))].sort((a, b) => a.localeCompare(b, 'th'));
  const subject = subjects.includes(q.subject) ? q.subject : null;
  const to = q.to || thaiDateKey(now);
  const from = q.from || addDaysKey(to, -29);
  const base = { rooms, subjects, room, subject, from, to, minPercent: ATTENDANCE_MIN_PERCENT, countLeaveAsPresent: COUNT_LEAVE_AS_PRESENT };
  if (!room) return { ...base, students: [], sessions: [], cells: {}, totals: {} };
  if (from > to) throw badRequest('วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
  const sessions = await attendanceRepo.listClosedSessions(teacher.id, {
    classroom: room, subject, fromIso: thaiDayRange(from)[0].toISOString(), toIso: thaiDayRange(to)[1].toISOString(),
  });
  const [students, records] = await Promise.all([
    studentsRepo.listByClassroom(room),
    attendanceRepo.listRecordsBySessions(sessions.map((s) => s.id)),
  ]);
  return {
    ...base,
    students: students.map(publicStudent),
    sessions: sessions.map(publicSession),
    ...buildReport(students, sessions, records),
  };
}

// ---------- Student ----------

export async function openForStudent(student, now = new Date()) {
  const sessions = (await attendanceRepo.listOpenByClassroom(student.classroom)).filter((s) => !isExpired(s, now));
  if (!sessions.length) return { items: [] };
  const [records, teachers] = await Promise.all([
    attendanceRepo.listRecordsBySessions(sessions.map((s) => s.id)),
    teachersRepo.getManyByIds(sessions.map((s) => s.teacher_id)),
  ]);
  const checked = new Set(records.filter((r) => r.student_id === student.id).map((r) => r.session_id));
  const names = new Map(teachers.map((t) => [t.id, t.name]));
  return {
    items: sessions.filter((s) => !checked.has(s.id)).map((s) => ({
      id: s.id, subject: s.subject, title: s.title, starts_at: s.starts_at, teacherName: names.get(s.teacher_id) || '',
    })),
  };
}

export async function studentAttendance(student) {
  const records = await attendanceRepo.listRecordsByStudent(student.id, 500);
  const sessions = await attendanceRepo.listSessionsByIds(records.map((r) => r.session_id));
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const joined = records.filter((r) => byId.has(r.session_id)).map((r) => ({ record: r, session: byId.get(r.session_id) }));
  const closed = joined.filter((j) => j.session.status === 'closed');
  const bySubject = {};
  for (const j of closed) (bySubject[j.session.subject] ||= []).push(j.record);
  const subjects = Object.entries(bySubject)
    .map(([subject, recs]) => {
      const s = summarize(recs);
      return { subject, ...s, risk: s.percent !== null && s.percent < ATTENDANCE_MIN_PERCENT };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, 'th'));
  const recent = joined
    .sort((a, b) => new Date(b.session.starts_at) - new Date(a.session.starts_at))
    .slice(0, 30)
    .map((j) => ({
      sessionId: j.session.id, subject: j.session.subject, title: j.session.title,
      starts_at: j.session.starts_at, status: j.record.status, checked_at: j.record.checked_at,
    }));
  return {
    overall: summarize(closed.map((j) => j.record)),
    subjects,
    recent,
    minPercent: ATTENDANCE_MIN_PERCENT,
    countLeaveAsPresent: COUNT_LEAVE_AS_PRESENT,
  };
}

export async function checkIn(ctx, input, now = new Date()) {
  const { student, session: login } = ctx;
  const nowDate = new Date(now);
  await assertNotLimited(login.lineUserId, 'checkin', nowDate);
  const data = checkinSchema.parse(input);
  const method = data.sessionId ? 'qr' : 'code';

  let candidates;
  if (data.sessionId) {
    const session = await attendanceRepo.getSession(data.sessionId);
    if (!session || session.classroom !== student.classroom) throw notFound(NOT_FOUND_STUDENT);
    if (session.status !== 'open') throw conflict('รอบเช็กชื่อนี้ปิดแล้ว', 'session_closed');
    if (isExpired(session, nowDate)) throw conflict('รอบเช็กชื่อนี้หมดเวลาแล้ว', 'session_expired');
    candidates = [session];
  } else {
    candidates = (await attendanceRepo.listOpenByClassroom(student.classroom)).filter((s) => !isExpired(s, nowDate));
    if (!candidates.length) throw notFound('ตอนนี้ยังไม่มีการเช็กชื่อของห้องคุณ', 'no_open_session');
  }

  const session = candidates.find((s) => verifyCode(s.id, data.code, nowDate.getTime()));
  if (!session) {
    await recordAttempt(login.lineUserId, 'checkin', false);
    throw badRequest('QR หมดอายุหรือรหัสไม่ถูกต้อง กรุณาสแกนใหม่จากจอครู', 'invalid_code');
  }

  const teacher = await teachersRepo.getById(session.teacher_id);
  const base = { subject: session.subject, title: session.title, teacherName: teacher?.name || '' };
  const status = lateStatus(session, nowDate);
  const inserted = await attendanceRepo.insertRecordsIgnore([{
    session_id: session.id, student_id: student.id, status, method,
    checked_at: nowDate.toISOString(), marked_by: null, note: null,
  }]);
  if (!inserted.length) {
    const existing = await attendanceRepo.getRecord(session.id, student.id);
    return { ...base, alreadyChecked: true, status: existing?.status || status, checkedAt: existing?.checked_at || null };
  }
  return { ...base, alreadyChecked: false, status, checkedAt: inserted[0].checked_at };
}
