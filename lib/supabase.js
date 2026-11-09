import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env.js';
import { HttpError } from './http.js';

let client = null;

// Server-only Supabase client using the secret key (bypasses RLS). Never import this from public/.
export function getSupabase() {
  if (!client) {
    const env = getEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

// For tests
export function setSupabaseForTests(fake) {
  client = fake;
}

export function toDbError(error) {
  if (!error) return null;
  if (error.code === '23505') return new HttpError(409, 'duplicate', 'ข้อมูลนี้มีอยู่แล้วในระบบ');
  if (error.code === '23503') return new HttpError(409, 'in_use', 'ข้อมูลนี้ถูกใช้งานอยู่ จึงแก้ไขไม่ได้');
  if (error.code === '23514') return new HttpError(400, 'check_failed', 'ข้อมูลไม่อยู่ในรูปแบบที่ระบบรับได้');
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new HttpError(500, 'table_missing', 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารันไฟล์ SQL ใน Supabase');
  }
  const err = new Error(`Database error: ${error.message || 'unknown'}`);
  err.code = error.code;
  return err;
}

// Unwrap a Supabase response and throw on error.
export function must(result) {
  if (result.error) throw toDbError(result.error);
  return result.data;
}

const PAGE = 1000; // PostgREST returns at most 1000 rows per request by default

// Fetch every row of a query, page by page. `build` must return a fresh query builder each call.
export async function selectAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const data = must(await build().range(from, from + PAGE - 1));
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// Run a query for a long list of ids in chunks (keeps the URL short).
export async function selectIn(ids, build, chunkSize = 100) {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    rows.push(...(await selectAll(() => build(chunk))));
  }
  return rows;
}
