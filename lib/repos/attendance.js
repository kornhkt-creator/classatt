import { getSupabase, must, selectAll, selectIn } from '../supabase.js';

export const SESSION_COLS = 'id, teacher_id, classroom, subject, title, starts_at, late_after_minutes, status, closed_at, created_at';
export const RECORD_COLS = 'id, session_id, student_id, status, method, checked_at, marked_by, note, updated_at';

export async function createSession(row) {
  return must(await getSupabase().from('attendance_sessions').insert(row).select(SESSION_COLS).single());
}

export async function getSession(id) {
  return must(await getSupabase().from('attendance_sessions').select(SESSION_COLS).eq('id', id).maybeSingle());
}

export async function updateSession(id, patch) {
  return must(await getSupabase().from('attendance_sessions').update(patch).eq('id', id).select(SESSION_COLS).single());
}

export async function listSessionsByTeacher(teacherId, sinceIso) {
  return selectAll(() => getSupabase().from('attendance_sessions').select(SESSION_COLS)
    .eq('teacher_id', teacherId).gte('starts_at', sinceIso).order('starts_at', { ascending: false }));
}

export async function findOpenByTeacherRoom(teacherId, classroom) {
  const rows = must(await getSupabase().from('attendance_sessions').select(SESSION_COLS)
    .eq('teacher_id', teacherId).eq('classroom', classroom).eq('status', 'open')
    .order('starts_at', { ascending: false }).limit(1));
  return rows[0] || null;
}

export async function listOpenByClassroom(classroom) {
  return must(await getSupabase().from('attendance_sessions').select(SESSION_COLS)
    .eq('classroom', classroom).eq('status', 'open').order('starts_at', { ascending: false }));
}

export async function listSessionsByIds(ids) {
  return selectIn(ids, (chunk) => getSupabase().from('attendance_sessions').select(SESSION_COLS).in('id', chunk));
}

export async function listClosedSessions(teacherId, { classroom, subject, fromIso, toIso }) {
  return selectAll(() => {
    let q = getSupabase().from('attendance_sessions').select(SESSION_COLS)
      .eq('teacher_id', teacherId).eq('classroom', classroom).eq('status', 'closed')
      .gte('starts_at', fromIso).lt('starts_at', toIso);
    if (subject) q = q.eq('subject', subject);
    return q.order('starts_at', { ascending: true });
  });
}

export async function listTeacherRoomsAndSubjects(teacherId) {
  return selectAll(() => getSupabase().from('attendance_sessions').select('classroom, subject').eq('teacher_id', teacherId));
}

export async function listRecords(sessionId) {
  return selectAll(() => getSupabase().from('attendance_records').select(RECORD_COLS).eq('session_id', sessionId));
}

export async function listRecordsBySessions(ids) {
  return selectIn(ids, (chunk) => getSupabase().from('attendance_records').select(RECORD_COLS).in('session_id', chunk));
}

export async function listRecordsByStudent(studentId, limit = 500) {
  return must(await getSupabase().from('attendance_records').select(RECORD_COLS)
    .eq('student_id', studentId).order('checked_at', { ascending: false }).limit(limit));
}

export async function getRecord(sessionId, studentId) {
  return must(await getSupabase().from('attendance_records').select(RECORD_COLS)
    .eq('session_id', sessionId).eq('student_id', studentId).maybeSingle());
}

// Insert only rows that do not exist yet (never overwrite). Returns the inserted rows.
export async function insertRecordsIgnore(rows) {
  if (!rows.length) return [];
  return must(await getSupabase().from('attendance_records')
    .upsert(rows, { onConflict: 'session_id,student_id', ignoreDuplicates: true }).select(RECORD_COLS));
}

// Insert or overwrite (teacher edits)
export async function upsertRecords(rows) {
  if (!rows.length) return [];
  return must(await getSupabase().from('attendance_records')
    .upsert(rows, { onConflict: 'session_id,student_id' }).select(RECORD_COLS));
}
