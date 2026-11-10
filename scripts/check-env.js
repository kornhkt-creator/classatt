// Checks that environment variables are present and well-formed before deploying.
// Usage: npm run check:env            (reads .env.local if present)
//        npm run check:env -- --strict (LINE settings are required too — use before going live in LINE)
// Never prints secret values, only variable names and problems.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const value = (key) => String(process.env[key] || '').trim();

const errors = [];
const warnings = [];

// Core settings (always required)
const url = value('SUPABASE_URL');
if (!url) errors.push('SUPABASE_URL ยังว่าง');
else if (!/^https:\/\/\S+$/.test(url)) errors.push('SUPABASE_URL ต้องขึ้นต้นด้วย https://');

const key = value('SUPABASE_SECRET_KEY');
if (!key) errors.push('SUPABASE_SECRET_KEY ยังว่าง');
else if (key.length < 20) errors.push('SUPABASE_SECRET_KEY สั้นเกินไป');
else if (key.startsWith('sb_publishable_')) errors.push('SUPABASE_SECRET_KEY เป็น publishable key — ต้องใช้ Secret key (sb_secret_...)');

const secret = value('SESSION_SECRET');
if (!secret) errors.push('SESSION_SECRET ยังว่าง');
else if (secret.length < 32) errors.push('SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');

// LINE settings (required for real LINE login)
const lineProblems = [];
const channelId = value('LINE_CHANNEL_ID');
if (!channelId) lineProblems.push('LINE_CHANNEL_ID ยังว่าง');
else if (!/^\d+$/.test(channelId)) errors.push('LINE_CHANNEL_ID ต้องเป็นตัวเลขเท่านั้น');

const liffEnv = value('LIFF_ID');
if (!liffEnv) lineProblems.push('LIFF_ID (env) ยังว่าง');
else if (!/^\d+-[A-Za-z0-9]+$/.test(liffEnv)) errors.push('LIFF_ID (env) ต้องมีรูปแบบ 1234567890-AbCdEfGh');

const configSource = await readFile(path.join(root, 'public', 'js', 'config.js'), 'utf8');
const liffConfig = (configSource.match(/LIFF_ID\s*=\s*['"]([^'"]*)['"]/) || [])[1] || '';
if (!liffConfig) lineProblems.push('LIFF_ID ใน public/js/config.js ยังว่าง');
if (liffEnv && liffConfig && liffEnv !== liffConfig) errors.push('LIFF_ID ใน env กับใน public/js/config.js ไม่ตรงกัน');

(strict ? errors : warnings).push(...lineProblems);

if (value('DEV_MOCK_LOGIN') === 'true') {
  warnings.push('DEV_MOCK_LOGIN=true — ใช้ได้แค่บนเครื่อง ห้ามตั้งบน Vercel');
}

for (const w of warnings) console.log(`⚠️  ${w}`);
for (const e of errors) console.log(`❌ ${e}`);
if (errors.length) {
  console.log(`\nพบปัญหา ${errors.length} ข้อ — แก้ใน .env.local (หรือ Environment Variables บน Vercel) แล้วรันใหม่`);
  process.exit(1);
}
console.log(strict ? '✅ ตัวแปรครบ พร้อมใช้กับ LINE จริง' : '✅ ตัวแปรหลักครบ (เพิ่ม --strict เพื่อตรวจค่า LINE ด้วย)');
