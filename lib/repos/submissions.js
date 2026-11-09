import { getSupabase, must, selectAll, selectIn } from '../supabase.js';

export const SUBMISSION_COLS = 'id, assignment_id, student_id, status, note, link_url, submitted_at, is_late, reviewed_by, reviewed_at, teacher_comment, updated_at';

export async function listByAssignment(assignmentId) {
  return selectAll(() => getSupabase().from('submissions').select(SUBMISSION_COLS).eq('assignment_id', assignmentId));
}

export async function listByAssignments(ids) {
  return selectIn(ids, (chunk) => getSupabase().from('submissions').select(SUBMISSION_COLS).in('assignment_id', chunk));
}

export async function listByStudent(studentId) {
  return selectAll(() => getSupabase().from('submissions').select(SUBMISSION_COLS).eq('student_id', studentId));
}

export async function getOne(assignmentId, studentId) {
  return must(await getSupabase().from('submissions').select(SUBMISSION_COLS)
    .eq('assignment_id', assignmentId).eq('student_id', studentId).maybeSingle());
}

// Insert or overwrite by (assignment_id, student_id). Every row must have the same keys.
export async function upsertMany(rows) {
  if (!rows.length) return [];
  return must(await getSupabase().from('submissions')
    .upsert(rows, { onConflict: 'assignment_id,student_id' }).select(SUBMISSION_COLS));
}
