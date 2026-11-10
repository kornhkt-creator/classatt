# DEPLOY — นำ ClassTrack ขึ้นใช้งานจริง

ลำดับ: Supabase → Vercel → LINE → ทดสอบบนมือถือ → Rich Menu → ใส่ข้อมูลจริง
(ไม่ต้องใช้ GitHub — อัปโหลดจากเครื่องด้วยคำสั่ง `npx vercel`)

## 1. Supabase
1. สร้างโปรเจกต์ (region **Singapore**)
2. SQL Editor → รันตามลำดับ: `supabase/migrations/001_init.sql` → `002_attendance.sql` → `seed.sql` (ข้อมูลทดสอบ)
3. Project Settings → Data API: คัดลอก **Project URL** · Project Settings → API Keys: คัดลอก **Secret key** (`sb_secret_...`)
4. ใส่ใน `.env.local` แล้วรัน `npm run check:env` และ `npm run dev:local` → http://localhost:3000/api/health ต้องได้ `ok: true`

## 2. Vercel (อัปโหลดจากเครื่อง ไม่ใช้ GitHub)
1. สมัคร/เข้าสู่ระบบที่ https://vercel.com (ครั้งแรกครั้งเดียว)
2. PowerShell ในโฟลเดอร์โปรเจกต์: `npx vercel login` → ทำตามที่เบราว์เซอร์บอก (ครั้งแรกครั้งเดียว)
3. ตั้ง Environment Variables (Production) ตามตารางด้านล่าง — บนเว็บ: Project → Settings → Environment Variables
4. อัปโหลดขึ้นเว็บจริง: `npx vercel --prod` (ทุกครั้งที่แก้โค้ด ให้รันคำสั่งนี้ใหม่)

`.vercelignore` กันไม่ให้ `.env*` และไฟล์ที่ไม่ต้องใช้ถูกอัปโหลด — ห้ามลบไฟล์นี้

Environment Variables (Production):

| ตัวแปร | ค่า |
|---|---|
| `SUPABASE_URL` | Project URL ของ Supabase |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_...`) |
| `SESSION_SECRET` | สุ่มใหม่ **ไม่ใช้ค่าเดียวกับ dev**: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `LINE_CHANNEL_ID` | Channel ID ของ LINE MINI App channel |
| `LIFF_ID` | LIFF ID (ต้องตรงกับ `public/js/config.js`) |

**ห้ามตั้ง `DEV_MOCK_LOGIN`** บน Vercel · แก้ env แล้วต้อง Redeploy

ตรวจ `https://<project>.vercel.app/api/health` → `ok: true`

## 3. LINE Developers Console (LINE MINI App channel)
- Endpoint URL = `https://<project>.vercel.app`
- Scope: `openid` + `profile` · เปิด **Scan QR**
- คัดลอก LIFF ID ใส่ `public/js/config.js` และ env `LIFF_ID` → รัน `npx vercel --prod` ใหม่
- `npm run check:env -- --strict` ต้องผ่าน (บนเครื่อง ถ้าใส่ค่าใน `.env.local` ด้วย)

## 4. ทดสอบบนมือถือ
- เปิด `https://miniapp.line.me/<LIFF_ID>` ใน LINE → ผูกครู → สร้างงาน → อีกบัญชีผูกนักเรียน → แจ้งส่ง → ครูยืนยัน
- เช็กชื่อ: ครูเปิดรอบ → นักเรียนสแกนด้วยกล้อง LINE และปุ่ม "สแกนเช็กชื่อ" → ปิดรอบ
- `https://<project>.vercel.app/?mockUser=x` ต้อง login ด้วย mock **ไม่ได้**
- `/lib/env.js` และ `/supabase/seed.sql` ต้อง **404**

## 5. Rich Menu
LINE Official Account Manager → Rich menu → ปุ่ม "ติดตามงาน" แบบ Link → `https://miniapp.line.me/<LIFF_ID>`

## 6. ก่อนใช้จริง
1. SQL Editor → รัน `supabase/remove-seed.sql`
2. Table Editor → students / teachers → Insert → Import data from CSV (ใช้หัวคอลัมน์ตาม `templates/students.csv`, `templates/teachers.csv`)
3. รัน `supabase/generate-codes.sql` เพื่อสุ่มรหัสยืนยัน/รหัสลงทะเบียน แล้วแจกให้เป็นรายคน
