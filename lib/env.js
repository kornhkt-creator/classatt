import { z } from 'zod';
import { HttpError } from './http.js';

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SESSION_SECRET', 'LINE_CHANNEL_ID', 'LIFF_ID'];

const schema = z.object({
  SUPABASE_URL: z.string().regex(/^https:\/\/\S+$/, 'SUPABASE_URL ต้องขึ้นต้นด้วย https://'),
  SUPABASE_SECRET_KEY: z.string().min(20, 'SUPABASE_SECRET_KEY สั้นเกินไป'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร'),
  LINE_CHANNEL_ID: z.string().regex(/^\d+$/, 'LINE_CHANNEL_ID ต้องเป็นตัวเลขเท่านั้น'),
  LIFF_ID: z.string().regex(/^\d+-[A-Za-z0-9]+$/, 'LIFF_ID ต้องมีรูปแบบ 1234567890-AbCdEfGh'),
});

export function missingEnv(keys = REQUIRED) {
  return keys.filter((key) => !String(process.env[key] || '').trim());
}

let cached = null;
let cachedFrom = null;

export function getEnv() {
  const fingerprint = REQUIRED.map((k) => process.env[k] || '').join('|');
  if (cached && cachedFrom === fingerprint) return cached;

  const missing = missingEnv();
  if (missing.length) {
    throw new HttpError(500, 'env_missing', `ยังไม่ได้ตั้งค่าตัวแปร: ${missing.join(', ')} (ดูวิธีตั้งค่าใน .env.example)`);
  }
  const values = Object.fromEntries(REQUIRED.map((k) => [k, String(process.env[k]).trim()]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    throw new HttpError(500, 'env_invalid', `ค่าตัวแปรไม่ถูกต้อง: ${parsed.error.issues.map((i) => i.message).join(' · ')}`);
  }
  cached = parsed.data;
  cachedFrom = fingerprint;
  return cached;
}

export function isMockLoginEnabled() {
  return process.env.DEV_MOCK_LOGIN === 'true' && !['production', 'preview'].includes(process.env.VERCEL_ENV || '');
}
