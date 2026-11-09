import { getSupabase, must, selectAll, toDbError } from '../supabase.js';
import { HttpError } from '../http.js';

// Public columns only — verify_code and line_user_id are never returned to pages
export const STUDENT_COLS = 'id, student_code, prefix, first_name, last_name, classroom, number';

export async function getById(id) {
  return must(await getSupabase().from('students').select(STUDENT_COLS).eq('id', id).eq('active', true).maybeSingle());
}

export async function getByLineUserId(lineUserId) {
  return must(await getSupabase().from('students').select(STUDENT_COLS)
    .eq('line_user_id', lineUserId).eq('active', true).maybeSingle());
}

// Internal: includes secret fields for the link service only
export async function getForLink(studentCode) {
  return must(await getSupabase().from('students')
    .select(`${STUDENT_COLS}, verify_code, line_user_id, active`)
    .eq('student_code', studentCode).maybeSingle());
}

export async function listByClassroom(classroom) {
  return selectAll(() => getSupabase().from('students').select(STUDENT_COLS)
    .eq('classroom', classroom).eq('active', true)
    .order('number', { ascending: true, nullsFirst: false }).order('first_name'));
}

export async function listByClassrooms(classrooms) {
  const unique = [...new Set(classrooms.filter(Boolean))];
  if (!unique.length) return [];
  return selectAll(() => getSupabase().from('students').select(STUDENT_COLS)
    .in('classroom', unique).eq('active', true).order('classroom').order('number'));
}

export async function listClassrooms() {
  const rows = await selectAll(() => getSupabase().from('classroom_list').select('classroom'));
  return rows.map((r) => r.classroom).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
}

export async function linkLineUser(id, lineUserId) {
  const { data, error } = await getSupabase().from('students')
    .update({ line_user_id: lineUserId, linked_at: new Date().toISOString() })
    .eq('id', id).is('line_user_id', null).select('id');
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'line_taken', 'บัญชี LINE นี้ผูกกับผู้ใช้อื่นแล้ว กรุณาติดต่อครู');
    throw toDbError(error);
  }
  return data.length === 1;
}
