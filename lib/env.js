import { z } from 'zod';
import { HttpError } from './http.js';

// Always needed (database + sessions)
const CORE = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET'];
// Needed only for real LINE login / production QR links (mock login on localhost works without them)
const LINE = ['LINE_CHANNEL_ID', 'LIFF_ID'];
const ALL = [...CORE, ...LINE];

const schema = z.object({
  SUPABASE_URL: z.string().regex(/^https:\/\/\S+$/, 'SUPABASE_URL ต้องขึ้นต้นด้วย https://'),
  SUPABASE_SECRET_KEY: z.string().min(20, 'SUPABASE_SECRET_KEY สั้นเกินไป'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร'),
  LINE_CHANNEL_ID: z.string().regex(/^\d+$/, 'LINE_CHANNEL_ID ต้องเป็นตัวเลขเท่านั้น').optional(),
  LIFF_ID: z.string().regex(/^\d+-[A-Za-z0-9]+$/, 'LIFF_ID ต้องมีรูปแบบ 1234567890-AbCdEfGh').optional(),
});

const value = (key) => String(process.env[key] || '').trim();

export function missingEnv(keys = ALL) {
  return keys.filter((key) => !value(key));
}

export function missingLineEnv() {
  return missingEnv(LINE);
}

let cached = null;
let cachedFrom = null;

export function getEnv() {
  const fingerprint = ALL.map(value).join('|');
  if (cached && cachedFrom === fingerprint) return cached;

  const missing = missingEnv(CORE);
  if (missing.length) {
    throw new HttpError(500, 'env_missing', `ยังไม่ได้ตั้งค่าตัวแปร: ${missing.join(', ')} (ดูวิธีตั้งค่าใน .env.example)`);
  }
  const values = Object.fromEntries(ALL.filter((k) => value(k)).map((k) => [k, value(k)]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    throw new HttpError(500, 'env_invalid', `ค่าตัวแปรไม่ถูกต้อง: ${parsed.error.issues.map((i) => i.message).join(' · ')}`);
  }
  cached = parsed.data;
  cachedFrom = fingerprint;
  return cached;
}

// For LINE settings that are only needed in some code paths
export function requireEnv(key) {
  const v = getEnv()[key];
  if (!v) throw new HttpError(500, 'env_missing', `ยังไม่ได้ตั้งค่าตัวแปร: ${key} (ดูวิธีตั้งค่าใน .env.example)`);
  return v;
}

export function isMockLoginEnabled() {
  return process.env.DEV_MOCK_LOGIN === 'true' && !['production', 'preview'].includes(process.env.VERCEL_ENV || '');
}
