import { getEnv, missingEnv } from '../lib/env.js';
import { getSupabase } from '../lib/supabase.js';
import { sendJson, withApi, HttpError } from '../lib/http.js';

const TABLES = ['teachers', 'students', 'assignments', 'submissions', 'link_attempts', 'audit_log', 'attendance_sessions', 'attendance_records'];

// GET /api/health — checks env vars and the database connection. Returns no data from the tables.
export default withApi(async (req, res) => {
  if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'วิธีเรียกใช้งานไม่ถูกต้อง');

  const missing = missingEnv();
  if (missing.length) {
    return sendJson(res, 500, { ok: false, error: `ยังไม่ได้ตั้งค่าตัวแปร: ${missing.join(', ')} (ดู .env.example)` });
  }
  getEnv();

  const supabase = getSupabase();
  const tables = {};
  let connected = false;
  for (const table of TABLES) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error) {
      tables[table] = 'ok';
      connected = true;
    } else if (['42P01', 'PGRST205'].includes(error.code) || /does not exist|schema cache/i.test(error.message || '')) {
      tables[table] = 'missing';
      connected = true;
    } else {
      tables[table] = 'error';
      if (/Invalid API key|JWT|apikey/i.test(error.message || '')) {
        return sendJson(res, 500, { ok: false, error: 'เชื่อมต่อ Supabase ไม่ได้: SUPABASE_SECRET_KEY ไม่ถูกต้อง (ต้องเป็น Secret key หรือ service_role)' });
      }
    }
  }
  if (!connected) {
    return sendJson(res, 500, { ok: false, error: 'เชื่อมต่อ Supabase ไม่ได้ ตรวจ SUPABASE_URL และ SUPABASE_SECRET_KEY หรือโปรเจกต์อาจถูกหยุดชั่วคราว (Restore ใน Dashboard)' });
  }
  const missingTables = Object.keys(tables).filter((t) => tables[t] !== 'ok');
  sendJson(res, missingTables.length ? 500 : 200, {
    ok: missingTables.length === 0,
    supabase: 'connected',
    tables,
    ...(missingTables.length ? { error: `ยังไม่มีตาราง: ${missingTables.join(', ')} — กรุณารันไฟล์ SQL ใน supabase/migrations` } : {}),
    serverTime: new Date().toISOString(),
  });
});
