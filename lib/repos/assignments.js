import { getSupabase, must, selectAll, selectIn } from '../supabase.js';

export const ASSIGNMENT_COLS = 'id, title, description, subject, classroom, teacher_id, due_at, status, created_at, updated_at';

export async function getById(id) {
  return must(await getSupabase().from('assignments').select(ASSIGNMENT_COLS).eq('id', id).maybeSingle());
}

export async function listByTeacher(teacherId, { status } = {}) {
  return selectAll(() => {
    let q = getSupabase().from('assignments').select(ASSIGNMENT_COLS).eq('teacher_id', teacherId);
    if (status) q = q.eq('status', status);
    return q.order('due_at', { ascending: true });
  });
}

export async function listByTeacherRoom(teacherId, classroom, subject) {
  return selectAll(() => {
    let q = getSupabase().from('assignments').select(ASSIGNMENT_COLS).eq('teacher_id', teacherId).eq('classroom', classroom);
    if (subject) q = q.eq('subject', subject);
    return q.order('due_at', { ascending: false });
  });
}

export async function listByClassroom(classroom) {
  return selectAll(() => getSupabase().from('assignments').select(ASSIGNMENT_COLS)
    .eq('classroom', classroom).order('due_at', { ascending: true }));
}

export async function createMany(rows) {
  return must(await getSupabase().from('assignments').insert(rows).select(ASSIGNMENT_COLS));
}

export async function update(id, patch) {
  return must(await getSupabase().from('assignments').update(patch).eq('id', id).select(ASSIGNMENT_COLS).single());
}

export async function getProgress(ids) {
  if (!ids.length) return [];
  return selectIn(ids, (chunk) => getSupabase().from('assignment_progress')
    .select('assignment_id, total_students, submitted_count, approved_count, revise_count, late_count')
    .in('assignment_id', chunk));
}
