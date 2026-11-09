import { getSupabase, must, toDbError } from '../supabase.js';
import { HttpError } from '../http.js';

// Public columns only — reg_code and line_user_id are never returned to pages
export const TEACHER_COLS = 'id, teacher_code, name';

export async function getById(id) {
  return must(await getSupabase().from('teachers').select(TEACHER_COLS).eq('id', id).eq('active', true).maybeSingle());
}

export async function getManyByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  return must(await getSupabase().from('teachers').select(TEACHER_COLS).in('id', unique));
}

export async function getByLineUserId(lineUserId) {
  return must(await getSupabase().from('teachers').select(TEACHER_COLS)
    .eq('line_user_id', lineUserId).eq('active', true).maybeSingle());
}

// Internal: includes secret fields for the link service only
export async function getForLink(teacherCode) {
  return must(await getSupabase().from('teachers')
    .select('id, teacher_code, name, reg_code, line_user_id, active')
    .eq('teacher_code', teacherCode).maybeSingle());
}

// Returns true when exactly one row was linked (line_user_id was still empty)
export async function linkLineUser(id, lineUserId) {
  const { data, error } = await getSupabase().from('teachers')
    .update({ line_user_id: lineUserId, linked_at: new Date().toISOString() })
    .eq('id', id).is('line_user_id', null).select('id');
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'line_taken', 'บัญชี LINE นี้ผูกกับผู้ใช้อื่นแล้ว กรุณาติดต่อครู');
    throw toDbError(error);
  }
  return data.length === 1;
}
