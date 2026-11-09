# ClassTrack — ระบบติดตามงานนักเรียนบน LINE Mini App

LINE Mini App (LIFF) ให้ครูสร้างงานและติดตามการส่ง นักเรียนดูงานและแจ้งส่ง และเช็กชื่อรายคาบด้วยการสแกน QR code
หน้าเว็บ HTML/CSS/JavaScript ล้วน + Vercel Functions (JavaScript) + Supabase (PostgreSQL) deploy บน Vercel

ผู้ใช้โปรเจกต์นี้ใช้ Claude Code เป็นหลักและเขียนโค้ดเองไม่คล่อง:
- อธิบายสั้นๆ เป็นภาษาไทยว่ากำลังทำอะไรและทำไม
- ขั้นที่ผู้ใช้ต้องทำเอง (กรอก .env, รัน SQL ใน Supabase, กดบนเว็บ) ให้บอกทีละขั้นแล้วรอคำตอบ
- ผู้ใช้ใช้ Windows (PowerShell)
- UI และข้อความ error ที่ผู้ใช้เห็นเป็นภาษาไทย ส่วนชื่อตัวแปร/ฟังก์ชัน/คอมเมนต์โค้ดเป็นภาษาอังกฤษ

## Tech Stack (ห้ามเปลี่ยนโดยไม่ถามผู้ใช้)

- Frontend: HTML + CSS + JavaScript ES Modules ล้วน **ไม่มี framework ไม่มี bundler ไม่มี build step**
- LIFF SDK v2 จาก CDN `https://static.line-scdn.net/liff/edge/2/sdk.js` (ตัวแปร global `liff`)
- Backend: Vercel Functions JavaScript (Node.js 22, `"type": "module"`) รูปแบบ `export default async function handler(req, res)`
- Database: Supabase PostgreSQL ผ่าน `@supabase/supabase-js` ด้วย secret key (ฝั่ง server เท่านั้น)
- QR code: `qrcode` ฝั่ง server เท่านั้น (สร้าง SVG ส่งให้หน้าเว็บแสดงด้วย `<img>` data URL)
- Session: JWT HS256 ด้วย `jose` ใน cookie `ct_session`
- Validation: `zod` (ฝั่ง server) · Test: Vitest · Dev: `npm run dev` (vercel dev) / `npm run dev:local` (ไม่ต้อง login Vercel) / `npm run dev:demo` (ฐานข้อมูลจำลองในหน่วยความจำ ไม่ต้องมี Supabase)
- Hosting: Vercel region `sin1`, Supabase region Singapore
- ห้ามเพิ่ม: React/Vue/Next.js/Express/Tailwind/jQuery/bundler/ORM หรือ library ฝั่งหน้าเว็บใดๆ
- หน้าตา (UX/UI): ตามต้นแบบ `design/prototype.html` ที่ผู้ใช้ให้มา — **ห้ามแก้หรือลบไฟล์นี้**

## โครงสร้างโฟลเดอร์

```
public/                       ← Vercel เสิร์ฟเฉพาะโฟลเดอร์นี้ (outputDirectory)
  index.html                  ← bootstrap LIFF → login → พาไปหน้าตาม role
  link.html  profile.html  404.html
  teacher/  index.html (หน้าหลัก) assignments.html new.html edit.html assignment.html overview.html reports.html
  teacher/attendance/  index.html live.html session.html report.html
  student/  index.html (หน้าหลัก) tasks.html assignment.html checkin.html attendance.html reports.html
  css/style.css
  js/
    config.js                 ← ค่า public เท่านั้น (LIFF_ID)
    api.js liff.js auth.js page.js dom.js ui.js format.js nav.js header.js bottom-sheet.js checkin.js student-ui.js
    pages/<ชื่อหน้า>.js       ← 1 ไฟล์ต่อ 1 หน้า
api/                          ← 1 ไฟล์ = 1 Vercel Function (มีแค่ 5 ไฟล์)
  health.js auth.js link.js teacher.js student.js
lib/                          ← โค้ด server ที่ใช้ร่วมกัน
  env.js supabase.js http.js session.js line-verify.js identity.js guard.js time.js rate-limit.js
  attendance-code.js qr.js checkin-url.js codes.js
  repos/       teachers.js students.js assignments.js submissions.js audit.js attendance.js attempts.js
  services/    link.js assignments.js board.js attendance.js dashboard.js
  validators/  assignment.js submission.js attendance.js
supabase/                     ← SQL ที่ผู้ใช้รันเองใน SQL Editor
  migrations/001_init.sql  002_attendance.sql  seed.sql  generate-codes.sql  remove-seed.sql
design/prototype.html         ← ต้นแบบ UX/UI (อ้างอิงเท่านั้น ไม่ถูกเสิร์ฟ)
scripts/dev-server.js           ← dev server แทน vercel dev (+ --demo)
scripts/fake-supabase.js        ← Supabase จำลองในหน่วยความจำ ใช้ใน tests และ dev:demo เท่านั้น
tests/  templates/
```

- ลำดับการเรียก: `api/*.js` → `lib/services` → `lib/repos` → Supabase (api ห้ามเรียก supabase ตรง)
- ห้ามเพิ่มไฟล์ใน `api/` (Vercel Hobby จำกัดจำนวน function) — เพิ่มความสามารถด้วยการเพิ่ม `op` ในไฟล์เดิม
- หน้าเว็บ import โค้ดจาก `public/js/` เท่านั้น ห้าม import จาก `lib/`
- ห้าม import ไฟล์ใน `public/js/pages/` จากไฟล์อื่น (จะรันหน้านั้นซ้ำ) — ของที่ใช้ร่วมกันให้ย้ายไป `public/js/*.js`
- ทุกหน้า (ยกเว้น index, checkin) เริ่มด้วย `runPage(async () => { const { me, main } = await initPage(role) ... })` จาก `page.js`

## API Convention

เรียกแบบ `/api/<file>?op=<operation>&...` · แต่ละไฟล์มีตาราง `ops = { name: { method, handler } }`

| ไฟล์ | op |
|---|---|
| health | (GET) |
| auth | line (POST), me (GET), logout (POST) |
| link | student (POST), teacher (POST) |
| teacher | dashboard, assignments, assignment, classrooms, subjects, board, overview, attendance-sessions, attendance-live, attendance-session, attendance-report (GET) · create-assignment, update-assignment, review, create-attendance, mark-attendance, close-attendance (POST) |
| student | dashboard, assignments, assignment, attendance-open, attendance (GET) · submit, checkin (POST) |

- ใช้แค่ GET กับ POST · ทุก handler ครอบด้วย `withApi()`
- สำเร็จ: JSON ข้อมูลตรงๆ · ผิดพลาด: `{ error: { code, message } }` (message ภาษาไทย)
- 400 validation · 401 ไม่ได้ login · 403 role ผิด/Origin ผิด · 404 ไม่พบหรือไม่มีสิทธิ์ · 405 method ผิด · 409 สถานะไม่อนุญาต (เช่น ส่งงานที่ตรวจแล้ว) · 429 rate limit · 500 อื่นๆ
- หน้าเว็บเรียกผ่าน `apiGet` / `apiPost` ใน `public/js/api.js` เท่านั้น

## โครงสร้างฐานข้อมูล (Supabase)

นิยามจริงอยู่ที่ `supabase/migrations/001_init.sql`

| ตาราง | คอลัมน์ |
|---|---|
| teachers | id uuid, teacher_code (unique), name, reg_code, line_user_id (unique), linked_at, active, created_at |
| students | id uuid, student_code (unique), prefix, first_name, last_name, classroom, number int, verify_code (6 หลัก), line_user_id (unique), linked_at, active, created_at |
| assignments | id uuid, title, description, subject, classroom, teacher_id → teachers, due_at timestamptz, status, created_at, updated_at |
| submissions | id uuid, assignment_id → assignments (cascade), student_id → students, status, note, link_url, submitted_at, is_late, reviewed_by → teachers, reviewed_at, teacher_comment, updated_at · unique (assignment_id, student_id) |
| link_attempts | id, line_user_id, kind ('link' / 'checkin'), success, created_at |
| attendance_sessions | id uuid, teacher_id → teachers, classroom, subject, title, starts_at, late_after_minutes, status, closed_at, created_at |
| attendance_records | id uuid, session_id → attendance_sessions (cascade), student_id → students, status, method, checked_at, marked_by → teachers, note, updated_at · unique (session_id, student_id) |
| audit_log | id, created_at, actor, action, detail jsonb |
| view assignment_progress | assignment_id, total_students, submitted_count, approved_count, revise_count, late_count (security_invoker) |

- submission status: `not_submitted` | `submitted` | `approved` | `revise` — ไม่มีแถว = `not_submitted`
- assignment status: `open` | `closed` — ไม่มีการลบงาน มีแค่ปิดรับ
- 1 งาน = 1 ห้อง (สร้างหลายห้อง = หลายแถว)
- attendance status: `present` | `late` | `absent` | `leave` | `sick` · method: `qr` | `code` | `manual` | `auto`
- attendance session status: `open` | `closed` — ระหว่างเปิด ไม่มีแถว = "ยังไม่เช็ก" · ปิดรอบแล้วคนที่ไม่มีแถวถูกใส่ `absent` (method `auto`)
- `active = false` = ปิดบัญชี (ซ่อนจากทุก query)
- ยกเลิกการผูก LINE = ล้าง `line_user_id` ใน Table Editor (ไม่มี UI)
- ห้ามแก้ schema โดยไม่ถามผู้ใช้ ถ้าแก้ให้สร้างไฟล์ migration ใหม่ (`002_...sql`) ห้ามแก้ไฟล์ที่รันไปแล้ว และอัปเดต CLAUDE.md

## กฎ Supabase

- เปิด RLS ทุกตาราง **ไม่สร้าง policy** + `revoke all ... from anon, authenticated` → เข้าถึงได้ทางเดียวคือ server ด้วย secret key
- view ต้องสร้างด้วย `with (security_invoker = true)`
- `SUPABASE_SECRET_KEY` ใช้ได้เฉพาะ `lib/` และ `api/` ห้ามอยู่ใน `public/` ห้ามใช้ publishable/anon key ในโปรเจกต์นี้
- client: `createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })` แบบ singleton
- ทุก select ระบุคอลัมน์เอง ห้าม `select('*')` กับ teachers/students
- upsert submissions ด้วย `onConflict: 'assignment_id,student_id'` เท่านั้น ห้าม select แล้ว insert
- ผูก LINE ด้วย update ที่มีเงื่อนไข `.is('line_user_id', null)` แล้วเช็กจำนวนแถวที่แก้ได้
- ห้าม query ใน loop — ใช้ `.in()` ดึงทีเดียว
- ตรวจ `error` จากทุก query แล้ว throw ห้ามปล่อยเงียบ
- ชน unique constraint (code `23505`) → แปลงเป็นข้อความภาษาไทยที่เข้าใจได้

## เช็กชื่อ (Attendance)

- ครูเปิดรอบได้ 1 รอบที่ open ต่อห้องต่อครู (ซ้ำ → 409)
- รหัส 6 หลักสร้างใน `lib/attendance-code.js`: HMAC(key แยกจุดประสงค์จาก SESSION_SECRET, `sessionId:window`) ช่วงละ 20 วินาที ยอมรับ 3 ช่วง (≤ 60 วินาที) — **ห้ามเก็บรหัสในฐานข้อมูลหรือ log**
- QR = `https://miniapp.line.me/<LIFF_ID>/student/checkin?s=<sessionId>&c=<code>` (localhost ใช้ URL ของเครื่อง) สร้างที่ `lib/checkin-url.js`
- server สร้าง SVG ด้วย `lib/qr.js` → หน้าเว็บแสดงด้วย `img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)` ห้าม innerHTML
- `code` / `qrSvg` ส่งให้ครูเจ้าของรอบเท่านั้น
- มา/สาย และอายุรหัส ตัดสินด้วยเวลา server: สายเมื่อเกิน `starts_at + late_after_minutes` · เช็กไม่ได้เมื่อเกิน `starts_at + 3 ชม.` หรือรอบปิด
- นักเรียนเช็กชื่อ: upsert `ignoreDuplicates: true` (ไม่ทับสถานะที่มีอยู่) · ครูแก้สถานะ: upsert ทับได้ (method `manual`)
- ปิดรอบ: ใส่ `absent` ให้คนที่ยังไม่มีแถวด้วย upsert `ignoreDuplicates` ครั้งเดียว
- กรอกรหัสผิดเกิน 10 ครั้ง / 10 นาที (`link_attempts.kind = 'checkin'`) → 429
- รอบผิดห้อง → 404 ห้ามบอกว่ามีรอบของห้องอื่น
- % เวลาเรียน = (present + late) / รอบที่ปิดแล้ว · ค่าคงที่ `ATTENDANCE_MIN_PERCENT = 80`, `COUNT_LEAVE_AS_PRESENT` อยู่ใน `lib/services/attendance.js`
- จอ QR ดึงข้อมูลทุก 4 วินาทีด้วย setTimeout ต่อกัน หยุดเมื่อหน้าถูกซ่อน · นับถอยหลังจาก `serverNow` ไม่ใช้นาฬิกาเครื่อง

## กฎความปลอดภัย (Non-negotiable)

- ตัวตนมาจาก LINE ID token ที่ server ตรวจกับ `https://api.line.me/oauth2/v2.1/verify` เท่านั้น ห้ามเชื่อ userId/profile ที่หน้าเว็บส่งมา
- cookie เก็บแค่ lineUserId/displayName/pictureUrl — role และ teacher/student id ต้อง resolve จากฐานข้อมูลทุก request
- teacher id / student id ใช้จาก `requireRole` เท่านั้น ห้ามรับจาก body หรือ query
- ทุก op (ยกเว้น `health`, `auth?op=line`) ต้องผ่าน `requireSession` / `requireRole`
- งานของครูคนอื่น หรืองานของห้องอื่น → 404
- ทุก input ตรวจด้วย zod ที่ server (หน้าเว็บตรวจเพิ่มเพื่อ UX ได้ แต่ไม่ใช่ตัวป้องกัน)
- URL จากนักเรียนรับเฉพาะ `http:` / `https:` (ตรวจด้วย `new URL()`)
- **หน้าเว็บห้ามใช้ `innerHTML` / `insertAdjacentHTML` / `outerHTML` กับข้อมูลที่ไม่ใช่ค่าคงที่** ใช้ `h()` / `textContent` ใน `dom.js`
- ห้ามมี inline `<script>` หรือ `onclick=""` ใน HTML (ให้ CSP ทำงานได้)
- response เลือก field เอง ห้ามหลุด `verify_code`, `reg_code`, `line_user_id`
- เทียบรหัสด้วย `crypto.timingSafeEqual`; รหัสผิด/ไม่พบ ใช้ข้อความเดียวกัน
- ผูกบัญชีผิดเกิน 5 ครั้ง / 15 นาที (นับจาก `link_attempts`) → 429
- POST ต้องผ่านการตรวจ Origin (fallback Referer)
- ห้าม log ID token, cookie, secret key, verify_code, reg_code
- Mock login ยอมรับเฉพาะเมื่อครบ 3 ข้อ: `DEV_MOCK_LOGIN === "true"` + `VERCEL_ENV` ไม่ใช่ production/preview + host เป็น localhost
- ห้าม commit `.env`, `.env*.local`, `.vercel`

## LIFF

- `liff.init({ liffId })` ทุกหน้าที่ใช้ liff ก่อนเรียกฟังก์ชันอื่น (เก็บ promise ไว้กันเรียกซ้ำ)
- ไม่ได้ login → `liff.login({ redirectUri: location.href })`
- token หมดอายุ → `liff.logout()` + `liff.login()` ใหม่ 1 ครั้ง (กัน loop ด้วย sessionStorage)
- เปิดลิงก์ภายนอก `liff.openWindow({ url, external: true })` · ปิดแอป `liff.closeWindow()`
- ต้องเปิด scope `openid` + `profile`
- LIFF_ID อยู่ใน `public/js/config.js` (ค่าสาธารณะ commit ได้)
- Dev: `localhost` + `?mockUser=<id>` จำลองผู้ใช้ (ไม่เรียก LIFF จริง)
- หน้าอื่นนอกจาก index.html ตรวจ login ด้วย `requirePage(role)` (เรียก `/api/auth?op=me`) — **ยกเว้น `/student/checkin` ที่ต้องเรียก `signIn()` เองเพื่อไม่ให้ s/c ใน URL หาย**
- index.html: ถ้า URL มี `liff.state` ให้ `liff.init()` แล้วปล่อย LIFF redirect ไปหน้าย่อยเอง ห้าม redirect ตาม role ทับ
- สแกน QR ในแอปด้วย `liff.scanCodeV2()` (ต้องเปิด "Scan QR" ใน LIFF settings) เช็ก `liff.isApiAvailable('scanCodeV2')` ก่อน ใช้ไม่ได้ให้ซ่อนปุ่ม
- `LIFF_ID` มีทั้งใน `public/js/config.js` และ env ฝั่ง server (ใช้สร้าง URL ใน QR) ต้องตรงกัน

## เวลาและภาษา

- ฐานข้อมูลเก็บ `timestamptz` (เก็บเป็น UTC ภายใน) · server สร้างวันส่งด้วย `toDueAt()` ใน `lib/time.js` (ต่อ `+07:00`)
- แสดงผลด้วย `public/js/format.js` (`formatThai`, `relativeDue`) ใช้ `Intl` + `timeZone: 'Asia/Bangkok'` เสมอ
- ห้ามใช้ `getHours()` / `toLocaleString()` ที่ไม่ระบุ timeZone
- รูปแบบวันที่ไทย พ.ศ. เช่น `20 พ.ย. 69 23:59`
- ชื่อห้องเช่น `ม.2/1` ส่งผ่าน `URLSearchParams` หรือ JSON body เสมอ

## UI

- **ต้นแบบคือ `design/prototype.html`** — ใช้ CSS และโครง HTML ของมันได้ แต่ห้าม copy JavaScript (มี innerHTML, inline script, ข้อมูลจำลอง, ปุ่มสลับบทบาท)
- prototype เป็นหน้าเดียวสลับ view · แอปจริงเป็นหลายหน้า: 1 เมนู = 1 ไฟล์ HTML
- CSS variables จาก prototype: `--green #06a84f` `--green-dark #07843f` `--mint #eaf9f0` `--ink #17251d` `--muted #66736b` `--line #e4ece7` `--bg #f4f8f5` `--purple #6955d9` `--purple-bg #f0edff` `--red #c43d45` `--amber #946000`
- ฟอนต์ `system-ui` (ไม่โหลด Google Fonts) · ไอคอนเป็นตัวอักษร/emoji (⌂ ▤ ▦ ▥ ♙ 📝) ไม่ใช้ icon library
- component: header (gradient เขียว + โลโก้ + รูปโปรไฟล์ แทน role switch) · .welcome .date · .stats .stat(.green .purple) · .grid/.two-col .panel · .task-list .task · .attendance-box · .progress · .toolbar · .field · .notice · .table-wrap · .toast · .bottom-nav .nav-btn
- ปุ่ม: `.btn.primary` (หลัก) · `.btn.secondary` (รอง/ตัวกรองที่เลือก) · `.btn.ghost` (ตัวกรองอื่น/ปุ่มเบา) · `.btn.purple` (สร้าง QR)
- pill สถานะ: `.todo` ยังไม่ส่ง/ใกล้ถึงกำหนด/ยังไม่เช็กชื่อ · `.review` รอตรวจ · `.done` ส่งแล้ว/ตรวจแล้ว/มาเรียน · `.revise` ให้แก้ไข · `.late` เลยกำหนด/มาสาย · `.absent` ขาด · `.leave` ลากิจ/ลาป่วย · `.muted` ปิดแล้ว
- bottom nav 5 เมนู — นักเรียน: หน้าหลัก `/student/` · งานของฉัน `/student/tasks` · เช็กชื่อ `/student/attendance` · รายงาน `/student/reports` · โปรไฟล์ `/profile` — ครู: หน้าหลัก `/teacher/` · งาน `/teacher/assignments` · เช็กชื่อ `/teacher/attendance/` · รายงาน `/teacher/reports` · โปรไฟล์ `/profile`
- คำในหน้าจอ: "เช็กชื่อ" (ตามราชบัณฑิตฯ และ prototype)
- Mobile-first: ≤ 700px คอลัมน์เดียว, stats 2×2 · จอใหญ่ grid 2 คอลัมน์ (max-width 1120px) · ทดสอบที่ 360px และ 1024px
- ปุ่มสูง ≥ 44px · input font ≥ 16px · ไม่เขียน style ซ้ำในแต่ละหน้า
- accessibility: skip link · `:focus-visible` · `aria-current="page"` ที่เมนู · `role="progressbar"` · toast `aria-live="polite"` · `prefers-reduced-motion`
- ทุกหน้ามี loading (.skeleton), empty (.empty) และ error state ภาษาไทย · ปุ่มที่ยิง API ต้อง disabled ระหว่างรอ

## Common Gotchas

- `vercel dev` ต้อง `npx vercel login` + `npx vercel link` ก่อนครั้งแรก
- `/api/health` error เรื่อง key → ใช้ key ผิดประเภท (ต้องเป็น secret / service_role)
- `permission denied for table` จาก server → ใช้ publishable/anon key แทน secret key
- `getIDToken()` ได้ `null` → ยังไม่เปิด scope openid
- verify ได้ 400 → `LINE_CHANNEL_ID` ผิด (ต้องเป็น Channel ID ของ channel ที่มี LIFF นี้)
- `liff is not defined` → ลืมใส่ `<script src=".../sdk.js">` ก่อน module script
- import ใน `public/js` ต้องมีนามสกุล `.js` และ path เริ่มด้วย `/js/...`
- แก้ env บน Vercel แล้วต้อง Redeploy
- Supabase แผนฟรีหยุดชั่วคราวเมื่อไม่ใช้ 7 วัน → Restore ใน Dashboard
- `scanCodeV2` ไม่ทำงาน → ยังไม่เปิด Scan QR ใน LIFF settings หรือ Permissions-Policy ปิด camera (ต้องเป็น `camera=(self)`)
- รูป QR ไม่ขึ้นหลังใส่ CSP → `img-src` ต้องมี `data:`
- หน้าตาไม่เหมือนต้นแบบ → เปิด `design/prototype.html` เทียบ แล้วใช้ class จาก style.css ที่ copy มาจากมัน
- Vitest: ใช้ `scripts/fake-supabase.js` ผ่าน `tests/helpers.js` (`freshDb()`) ห้ามยิงฐานข้อมูลจริงใน test — ถ้า repo ใช้ method ใหม่ของ query builder ต้องเพิ่มใน fake ด้วย
- PostgREST คืนได้ไม่เกิน 1000 แถวต่อครั้ง — list ที่อาจยาวใช้ `selectAll()` / `selectIn()` ใน `lib/supabase.js`
- `link_attempts.created_at` ใช้นาฬิกาฐานข้อมูล — test เรื่อง rate limit ต้องใช้เวลาจริง

## Testing Priorities

1. การตรวจสิทธิ์ (role, ความเป็นเจ้าของงาน, ห้องเรียน)
2. การผูกบัญชี (รหัสผิด, ผูกซ้ำ, rate limit)
3. การคำนวณสถานะ / ส่งช้า / มาสาย / รหัสเช็กชื่อหมดอายุ / % เวลาเรียน / เวลาไทย
4. validator (URL, ความยาว, ข้อความว่าง)
5. XSS: ข้อมูลผู้ใช้ที่มี HTML ต้องแสดงเป็นข้อความ

ก่อน commit ทุกครั้ง: `npm test` ต้องผ่าน และเปิดหน้าที่แก้ใน `npm run dev` แล้วไม่มี error ใน Console

## Commit Convention

- รูปแบบ: `phase-{N}.{M}: {short description in English}`
- ก่อน commit ตรวจ `git status` ว่าไม่มี `.env*` (ยกเว้น `.env.example`) หรือ `.vercel`
- ห้าม `git push` หรือ deploy production โดยไม่ถามผู้ใช้
