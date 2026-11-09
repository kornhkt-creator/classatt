# ClassTrack — Prompt Kit: ระบบติดตามงานนักเรียนบน LINE Mini App (HTML/CSS/JS + Supabase)

## สรุปโปรเจกต์

ClassTrack เป็น LINE Mini App (LIFF) ที่เปิดจาก Rich Menu ของ LINE OA โรงเรียน ใช้ได้ 2 กลุ่ม:
- **ครู**: สร้างงาน/การบ้านให้ห้องเรียน กำหนดวันส่ง ดูว่าใครส่งแล้ว ใครค้าง ใครส่งช้า ยืนยันการส่งหรือสั่งให้แก้ไข และดูภาพรวมรายห้อง
- **นักเรียน**: ดูงานที่ได้รับ งานที่ค้าง งานที่เลยกำหนด แล้วกด "แจ้งส่งงาน" พร้อมหมายเหตุหรือลิงก์งาน
- **เช็กชื่อรายคาบ**: ครูเปิดจอ QR ที่เปลี่ยนทุก 20 วินาที นักเรียนสแกนด้วย LINE เพื่อเช็กชื่อ ระบบบันทึกมา/สายให้อัตโนมัติ ครูแก้เป็นลา/ขาดได้ และดูรายงาน % เวลาเรียน

ผูกตัวตนครั้งแรกด้วยรหัสนักเรียนหรือรหัสครู หลังจากนั้นระบบจำบัญชี LINE ไว้ หน้าเว็บเขียนด้วย HTML + CSS + JavaScript ล้วน ไม่ใช้ framework และไม่ต้อง build หน้าตาตามต้นแบบ `design/prototype.html` ข้อมูลเก็บใน Supabase (PostgreSQL) ทั้งหมดขึ้นบน Vercel

## Tech Stack

| ส่วน | เลือกใช้ | เหตุผล |
|---|---|---|
| หน้าเว็บ | HTML + CSS + JavaScript (ES Modules) ไม่มี framework ไม่มี build | อ่านโค้ดเข้าใจง่าย แก้ไฟล์แล้วรีเฟรชเห็นผลทันที |
| Backend | Vercel Functions เขียนด้วย JavaScript ล้วน (Node.js 22) ในโฟลเดอร์ `api/` | ต้องมีโค้ดฝั่ง server ไว้ตรวจตัวตน LINE และถือกุญแจลับของ Supabase |
| LINE | LIFF SDK v2 โหลดผ่าน CDN | SDK ทางการของ LINE Mini App |
| QR Code | `qrcode` (ฝั่ง server สร้างเป็น SVG) | หน้าเว็บไม่ต้องลง library เพิ่ม |
| Database | Supabase (PostgreSQL) ผ่าน `@supabase/supabase-js` | ฐานข้อมูลจริง มี constraint ป้องกันข้อมูลซ้ำ ครูดู/แก้ข้อมูลผ่าน Table Editor ได้เหมือนตาราง |
| Auth | ตรวจ LINE ID Token ฝั่ง server แล้วเก็บ session cookie (`jose`) | ไม่ต้องมีรหัสผ่าน |
| Validation | `zod` (ฝั่ง server) | ตรวจข้อมูลที่ส่งเข้ามา |
| Test | Vitest | ทดสอบโค้ดฝั่ง server และฟังก์ชันคำนวณ |
| Dev server | `vercel dev` | รันทั้งหน้าเว็บและ `api/` บนเครื่องเหมือนตอนขึ้นจริง |
| Hosting | Vercel (`sin1`) + Supabase (Singapore) | ใกล้ไทยทั้งคู่ ใช้แผนฟรีได้ |

### ทำไมต้องมีโฟลเดอร์ `api/` (ไม่ใช่ HTML ล้วน 100%)

ถ้าให้หน้าเว็บคุยกับ Supabase ตรงๆ ใครก็เปิด DevTools แล้วแก้ข้อมูลหรือปลอมเป็นนักเรียนคนอื่นได้ เพราะ Supabase ไม่รู้จักบัญชี LINE จึงต้องมีโค้ด JavaScript ฝั่ง server เล็กๆ (5 ไฟล์ใน `api/`) ทำ 3 อย่าง: ตรวจกับ LINE ว่าผู้ใช้เป็นใครจริง, ถือกุญแจลับของ Supabase ไว้ไม่ให้หลุดไปที่มือถือ และตรวจสิทธิ์ก่อนอ่าน/เขียนทุกครั้ง โค้ดส่วนนี้ยังเป็น JavaScript ธรรมดา ไม่มี framework

```
มือถือ (LINE)                     Vercel                          Supabase
public/*.html + js  ──fetch──►  api/*.js (ตรวจตัวตน+สิทธิ์)  ──►  PostgreSQL (RLS ปิดกั้นการเข้าถึงตรง)
```

## โครงสร้างฐานข้อมูล (Supabase)

| ตาราง | คอลัมน์หลัก |
|---|---|
| `teachers` | id, teacher_code (unique), name, reg_code, line_user_id (unique), linked_at, active |
| `students` | id, student_code (unique), prefix, first_name, last_name, classroom, number, verify_code, line_user_id (unique), linked_at, active |
| `assignments` | id, title, description, subject, classroom, teacher_id → teachers, due_at, status, created_at, updated_at |
| `submissions` | id, assignment_id → assignments, student_id → students, status, note, link_url, submitted_at, is_late, reviewed_by → teachers, reviewed_at, teacher_comment, updated_at · **unique (assignment_id, student_id)** |
| `link_attempts` | id, line_user_id, success, created_at (ใช้จำกัดจำนวนครั้งที่กรอกรหัสผิด) |
| `audit_log` | id, created_at, actor, action, detail (jsonb) |
| view `assignment_progress` | assignment_id, total_students, submitted_count, approved_count, revise_count, late_count |

สถานะการส่งงาน: `not_submitted` (ไม่มีแถวก็ถือว่าเป็นค่านี้) · `submitted` (รอตรวจ) · `approved` (ตรวจแล้ว) · `revise` (ให้แก้ไข)
สถานะงาน: `open` · `closed`

**ตารางเช็กชื่อ (เพิ่มใน Prompt 4.1 ด้วยไฟล์ `002_attendance.sql`)**

| ตาราง | คอลัมน์หลัก |
|---|---|
| `attendance_sessions` | id, teacher_id → teachers, classroom, subject, title, starts_at, late_after_minutes, status, closed_at, created_at |
| `attendance_records` | id, session_id → attendance_sessions, student_id → students, status, method, checked_at, marked_by → teachers, note, updated_at · **unique (session_id, student_id)** |

สถานะการมาเรียน: `present` (มา) · `late` (สาย) · `absent` (ขาด) · `leave` (ลากิจ) · `sick` (ลาป่วย) — ระหว่างรอบยังเปิด ไม่มีแถว = "ยังไม่เช็ก" พอปิดรอบ ระบบบันทึกคนที่ไม่มีแถวเป็น `absent`
วิธีเช็ก (method): `qr` · `code` (กรอกรหัส 6 หลัก) · `manual` (ครูกดเอง) · `auto` (ระบบใส่ขาดตอนปิดรอบ)

### การเช็กชื่อด้วย QR ทำงานอย่างไร

```
ครูเปิดรอบเช็กชื่อ ─► จอครูแสดง QR + รหัส 6 หลัก (เปลี่ยนทุก 20 วินาที)
                         │
                         │  QR = https://miniapp.line.me/<LIFF_ID>/student/checkin?s=<รอบ>&c=<รหัส>
                         ▼
นักเรียนสแกนด้วยกล้อง LINE / ปุ่ม "สแกนเช็กชื่อ" ในแอป / พิมพ์รหัส 6 หลัก
                         │
                         ▼
server ตรวจ: รหัสยังไม่หมดอายุ (≤ 60 วินาที) · รอบยังเปิด · นักเรียนอยู่ห้องนี้ · ยังไม่เคยเช็ก
                         │
                         ▼
บันทึก present หรือ late (ถ้าเกินเวลาที่ครูตั้ง) ─► จอครูนับเพิ่มทันที
```

รหัสสร้างจาก HMAC ของ (รอบเช็กชื่อ + ช่วงเวลา 20 วินาที) จึงไม่ต้องเก็บรหัสในฐานข้อมูล ถ้าเพื่อนถ่ายรูป QR ส่งให้คนที่อยู่บ้าน รหัสจะหมดอายุภายในไม่เกิน 1 นาที

## Prompt Outline

```
Phase 1 — Foundation
  1.1 โครงโปรเจกต์ HTML/CSS/JS + Vercel Functions + เชื่อม Supabase
  1.2 ฐานข้อมูล: SQL ตาราง + RLS + ข้อมูลตัวอย่าง + โค้ดเข้าถึงข้อมูล
Phase 2 — LINE Login & ตัวตน
  2.1 LIFF + ตรวจ ID Token + session (มีโหมด mock สำหรับทดสอบบนคอม)
  2.2 ผูกบัญชีครู/นักเรียนครั้งแรก
Phase 3 — Core Features
  3.1 ครู: สร้าง/แก้ไข/ปิดรับงาน
  3.2 ครู: กระดานติดตามการส่งงานรายชิ้น
  3.3 ครู: ภาพรวมการส่งงานรายห้อง
  3.4 นักเรียน: งานของฉัน + แจ้งส่งงาน
Phase 4 — เช็กชื่อด้วย QR Code
  4.1 ฐานข้อมูลเช็กชื่อ + ครูเปิดรอบเช็กชื่อ + จอ QR ที่เปลี่ยนทุก 20 วินาที
  4.2 นักเรียน: สแกน QR / กรอกรหัสเพื่อเช็กชื่อ + ประวัติการมาเรียน
  4.3 ครู: แก้สถานะรายคน + ปิดรอบ + รายงานเปอร์เซ็นต์การมาเรียน
  4.4 หน้าหลัก (Dashboard) + รายงาน + โปรไฟล์ ตาม prototype
Phase 5 — Polish & Deploy
  5.1 ปรับ UI + ความปลอดภัย + ตรวจทั้งระบบ
  5.2 Deploy Vercel + ตั้งค่า LINE Mini App + Rich Menu
```

> **วิธีใช้:** copy prompt ทีละอันไปวางใน Claude Code → รอจนเสร็จ → ทดสอบตาม Test criteria → Claude Code จะ commit ให้ → `/clear` แล้วไป prompt ถัดไป (รายละเอียดใน README.md)

---

## Phase 1 — Foundation

### Prompt 1.1 — โครงโปรเจกต์ HTML/CSS/JS + Vercel Functions + เชื่อม Supabase

> **Dependencies:** ไม่มี (prompt แรก) — ต้องสร้าง Supabase project และบัญชี Vercel ตาม README ข้อ "เตรียมก่อนเริ่ม" ก่อน
> **ไฟล์ที่สร้าง:** ~13 ไฟล์
> **Git commit:** `phase-1.1: vanilla JS project with Vercel functions and Supabase connection`

```text
คุณคือ full-stack developer ที่เชี่ยวชาญ JavaScript ล้วน (ไม่ใช้ framework), Vercel Functions, Supabase และ LINE LIFF
ผมใช้ Claude Code เป็นหลัก เขียนโค้ดเองไม่คล่อง ช่วยอธิบายสั้นๆ ว่าแต่ละขั้นทำอะไร และบอกขั้นที่ผมต้องทำเองให้ชัด แล้วรอผมตอบ
ผมใช้ Windows (PowerShell)

อ่าน CLAUDE.md ในโฟลเดอร์นี้ก่อนเริ่ม และทำตามกฎในนั้นตลอดทั้งโปรเจกต์

งาน: สร้างโครงโปรเจกต์ "classtrack" ในโฟลเดอร์ปัจจุบัน
*** โฟลเดอร์นี้มี CLAUDE.md, prompts.md, README.md อยู่แล้ว ห้ามลบหรือเขียนทับ ***

สิ่งที่ต้องสร้าง:
1. package.json: "type": "module", engines node >= 22
   - dependencies: @supabase/supabase-js, jose, zod
   - devDependencies: vercel, vitest
   - scripts: "dev": "vercel dev", "test": "vitest run"
2. โครงโฟลเดอร์ตาม CLAUDE.md (design/prototype.html คือต้นแบบ UX/UI ที่ผมให้มา ห้ามลบหรือแก้):
   public/                ← ไฟล์หน้าเว็บทั้งหมด (Vercel เสิร์ฟเฉพาะโฟลเดอร์นี้)
     index.html           ← หน้าชั่วคราว "ClassTrack กำลังพัฒนา" (ใช้ header สีเขียวแบบ prototype) + ปุ่มทดสอบเรียก /api/health
     css/style.css        ← design system ทั้งแอป สร้างจาก <style> ใน design/prototype.html (ดูข้อ 3)
     js/config.js         ← ค่า public เช่น LIFF_ID (ยังว่างไว้) — ใส่ comment ว่าค่าในไฟล์นี้ทุกคนเห็นได้ ห้ามใส่ความลับ
     js/api.js            ← ฟังก์ชัน apiGet(fn, op, params) / apiPost(fn, op, body) ห่อ fetch (credentials: 'same-origin')
                             คืน data หรือ throw Error ที่มีข้อความภาษาไทยจาก server
   api/
     health.js            ← GET /api/health
   lib/                   ← โค้ดฝั่ง server ที่ใช้ร่วมกัน (ไม่ถูกเสิร์ฟเป็นหน้าเว็บ)
     env.js               ← ตรวจ env ด้วย zod ถ้าขาดตัวไหน throw error ภาษาไทยบอกชื่อทุกตัวที่ขาดในครั้งเดียว
     supabase.js          ← สร้าง Supabase client แบบ singleton ด้วย secret key (auth: persistSession false, autoRefreshToken false)
     http.js              ← sendJson(res, status, data), sendError(res, status, code, message), withApi(handler) จับ error ทั้งหมด
   tests/
3. public/css/style.css จาก design/prototype.html
   - copy CSS variables (--green, --green-dark, --mint, --ink, --muted, --line, --bg, --purple, --purple-bg, --red, --amber, --shadow)
     และ class ทั้งหมด: header .brand .logo, .welcome .sub .date, .stats .stat (.green .purple), .section-head .link-btn,
     .grid .two-col .panel, .task-list .task .task-icon .task-main, .pill (.todo .done .late), .actions .btn (.primary .secondary .ghost .purple),
     .attendance-box, .bottom-nav .nav-btn, .toolbar .field, .empty .notice .table-wrap table .progress .toast .muted, .skip,
     media query ≤ 700px และ prefers-reduced-motion
   - เพิ่ม pill ที่ prototype ยังไม่มี: .pill.review (รอตรวจ: purple-bg/purple), .pill.revise (ให้แก้ไข: #fff0e3/#a2510c),
     .pill.absent (ขาด: พื้น --red ตัวอักษรขาว), .pill.leave (ลา: #eef1f4/#4a5560), .pill.muted (ยังไม่เช็ก/ปิดแล้ว: #f1f4f2/#66736b)
   - เพิ่ม .skeleton (กล่องเทากระพริบเบาๆ ปิดเมื่อ prefers-reduced-motion) และ .btn ต้องสูงอย่างน้อย 44px
   - ฟอนต์ใช้ system-ui ตาม prototype (ไม่โหลด Google Fonts)
   - ห้ามเปลี่ยนสีหรือขนาดจาก prototype ถ้าไม่จำเป็น
4. Environment variables (ใส่ใน .env.example พร้อม comment ภาษาไทย และสร้าง .env.local ค่าว่างให้ผมกรอก):
   SUPABASE_URL, SUPABASE_SECRET_KEY, SESSION_SECRET (≥ 32 ตัว), LINE_CHANNEL_ID, DEV_MOCK_LOGIN
5. GET /api/health: ตรวจ env แล้วลองเชื่อมต่อ Supabase (ยิง REST endpoint ด้วย key) ตอบ { ok: true, supabase: "connected", serverTime }
   หรือ { ok: false, error: "<ภาษาไทย>" } status 500
6. vercel.json: { "regions": ["sin1"], "cleanUrls": true, "outputDirectory": "public" }
   และตั้งให้โปรเจกต์ไม่มีขั้นตอน build (framework: null) — ตรวจกับเอกสาร Vercel ว่าตั้งค่าถูกต้อง
7. .gitignore: node_modules, .env, .env*.local, .vercel
8. vitest.config.js และ test ตัวอย่าง 1 ตัวของ lib/env.js
9. git init (ถ้ายังไม่มี)

ขั้นที่ผมต้องทำเอง (บอกทีละขั้น แล้วรอผม):
- กรอก .env.local (บอกว่าเอาค่าจากหน้าไหนใน Supabase Dashboard)
- รัน npx vercel login และ npx vercel link เพื่อผูกโฟลเดอร์กับโปรเจกต์บน Vercel (vercel dev ต้องใช้)

ข้อห้าม/ข้อระวัง:
*** ห้ามใช้ framework (React, Vue, Next.js, Express ฯลฯ) และห้ามมีขั้นตอน build ***
*** design/prototype.html ใช้เป็นต้นแบบหน้าตาเท่านั้น: เอา CSS และโครง HTML มาใช้ได้ แต่ห้าม copy JavaScript ของมัน
    (มันใช้ innerHTML, inline script และข้อมูลจำลอง ซึ่งผิดกฎใน CLAUDE.md) ***
*** SUPABASE_SECRET_KEY ใช้ได้เฉพาะในโฟลเดอร์ lib/ และ api/ เท่านั้น ห้ามอยู่ใน public/ เด็ดขาด ***
*** ไฟล์ใน api/ แต่ละไฟล์ = 1 Vercel Function — โปรเจกต์นี้จะมีแค่ 5 ไฟล์ (health, auth, link, teacher, student) โค้ดที่ใช้ร่วมกันใส่ใน lib/ ***
*** ห้ามเขียน credential จริงลงไฟล์ที่จะถูก commit ***

Test criteria (ต้องผ่านทุกข้อก่อน commit):
- npm run dev แล้วเปิด http://localhost:3000 เห็นหน้า "ClassTrack กำลังพัฒนา" ฟอนต์ไทยถูกต้อง
- กดปุ่มทดสอบ หรือเปิด http://localhost:3000/api/health ได้ { ok: true }
- ลบค่า SUPABASE_URL ชั่วคราว → /api/health ตอบ error ภาษาไทยที่อ่านรู้เรื่อง
- เปิด http://localhost:3000/lib/env.js และ http://localhost:3000/.env.local ต้องไม่เจอไฟล์ (404)
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local และ .vercel ไม่อยู่ใน staged files (git status)
3. git commit -m "phase-1.1: vanilla JS project with Vercel functions and Supabase connection"
4. สรุปให้ผมว่าทำอะไรไปบ้าง และ prompt ถัดไปคืออะไร
```

**✅ Test criteria:**
- [ ] `npm run dev` เปิดหน้าแรกได้
- [ ] `/api/health` ตอบ `ok: true`
- [ ] เปิดไฟล์ใน `lib/` หรือ `.env.local` จากเว็บไม่ได้
- [ ] `.env.local` ไม่ถูก commit

**⚠️ Gotcha:**
- `vercel dev` จะถามให้ login และ link โปรเจกต์ในครั้งแรก ตอบตามค่าเริ่มต้นได้ (ตั้ง Framework เป็น Other)
- ใช้ **Secret key** ของ Supabase (ขึ้นต้น `sb_secret_`) ถ้าโปรเจกต์เก่ายังเป็นแบบเดิมใช้ `service_role` key แทนได้ ห้ามใช้ publishable/anon key

---

### Prompt 1.2 — ฐานข้อมูล: SQL ตาราง + RLS + ข้อมูลตัวอย่าง + โค้ดเข้าถึงข้อมูล

> **Dependencies:** ต่อจาก Prompt 1.1
> **ไฟล์ที่สร้าง:** ~12 ไฟล์
> **Git commit:** `phase-1.2: Supabase schema, RLS, seed data and repositories`

```text
ต่อจาก Prompt 1.1 (โปรเจกต์รันได้แล้ว /api/health เชื่อม Supabase ได้)
อ่าน CLAUDE.md อีกครั้ง โดยเฉพาะส่วน "โครงสร้างฐานข้อมูล" และ "กฎ Supabase"

งาน: สร้างตารางใน Supabase และโค้ดฝั่ง server สำหรับอ่าน/เขียนข้อมูล

สิ่งที่ต้องสร้าง:
1. supabase/migrations/001_init.sql (รันซ้ำได้: ใช้ if not exists / create or replace)
   - ตาราง teachers, students, assignments, submissions, link_attempts, audit_log ตาม CLAUDE.md
   - primary key แบบ uuid default gen_random_uuid() (audit_log, link_attempts ใช้ bigint identity)
   - constraint:
     · teacher_code, student_code, line_user_id → unique
     · verify_code: null หรือตัวเลข 6 หลัก (check ~ '^[0-9]{6}$')
     · title 1–100 ตัว, description ≤ 1000, subject 1–50, note ≤ 500, teacher_comment ≤ 300
     · link_url: null หรือขึ้นต้น http:// หรือ https:// และ ≤ 500 ตัว
     · status ของ assignments อยู่ใน ('open','closed'), ของ submissions อยู่ใน ('not_submitted','submitted','approved','revise')
     · submissions: unique (assignment_id, student_id), assignment_id on delete cascade
   - วันเวลาทั้งหมดใช้ timestamptz
   - trigger อัปเดต updated_at อัตโนมัติ (assignments, submissions)
   - index: assignments(teacher_id, status), assignments(classroom, status), submissions(student_id), students(classroom), link_attempts(line_user_id, created_at)
   - view assignment_progress (นับจากนักเรียน active ในห้องของงาน) สร้างด้วย with (security_invoker = true)
   - enable row level security ทุกตาราง โดย "ไม่สร้าง policy" (= ปิดกั้น anon/authenticated ทั้งหมด)
     และ revoke all on ทุกตาราง + view from anon, authenticated
2. supabase/seed.sql — ข้อมูลทดสอบ: ครู 2 คน (T001, T002) และนักเรียน 8 คน ห้อง "ม.2/1" และ "ม.2/2" ห้องละ 4 คน
   ใช้รหัสคงที่ที่จำง่ายสำหรับทดสอบ (เช่น reg_code "TEST01", verify_code "111111") และใส่ตารางรหัสไว้ใน comment บนสุดของไฟล์
   ใช้ on conflict do nothing เพื่อรันซ้ำได้
3. supabase/generate-codes.sql — สุ่ม verify_code 6 หลักให้นักเรียนที่ยังว่าง และ reg_code 6 ตัวอักษรให้ครูที่ยังว่าง
4. supabase/remove-seed.sql — ลบเฉพาะข้อมูลทดสอบจาก seed (ใช้ก่อนใช้งานจริง)
5. lib/repos/ (ใช้ lib/supabase.js, ทุกฟังก์ชัน throw error เมื่อ Supabase ตอบ error)
   - teachers.js: getById, getByLineUserId, getByCode(teacherCode), linkLineUser(id, lineUserId)
   - students.js: getById, getByLineUserId, getByCode(studentCode), listByClassroom(classroom), listClassrooms(), linkLineUser(id, lineUserId)
   - assignments.js: getById, listByTeacher(teacherId, status), listByClassroom(classroom), createMany(rows), update(id, patch), getProgress(ids)
   - submissions.js: listByAssignment(id), listByStudent(studentId), getOne(assignmentId, studentId),
     upsertMany(rows) ด้วย .upsert(rows, { onConflict: 'assignment_id,student_id' })
   - audit.js: log(actor, action, detail)
   - linkLineUser ต้อง update แบบมีเงื่อนไข .is('line_user_id', null) แล้วเช็กว่าแก้ได้ 1 แถวจริง (กันผูกซ้ำพร้อมกัน)
   - ทุก select ระบุคอลัมน์ที่ต้องการเอง ห้าม select('*') ในตาราง teachers/students
   - กรอง active = true สำหรับ teachers/students
6. lib/time.js — toDueAt("2026-11-20T23:59") → Date ของเวลาไทยนั้น (ต่อท้าย ":00+07:00"), isLate(submittedAt, dueAt)
7. public/js/format.js (ใช้ทั้งหน้าเว็บและ test ได้) — formatThai(iso) → "20 พ.ย. 69 23:59" (Intl th-TH, timeZone Asia/Bangkok),
   relativeDue(dueAt, now) → "เหลืออีก 2 วัน" / "ครบกำหนดวันนี้" / "เลยกำหนด 3 วัน" (นับตามวันที่ของเวลาไทย)
8. ปรับ /api/health ให้นับแถวในตาราง teachers ได้ (ยืนยันว่าตารางมีอยู่) โดยไม่ส่งข้อมูลอื่นกลับ
9. Tests (Vitest, mock Supabase client ห้ามยิงจริง): time.js, format.js (ทดสอบข้ามเที่ยงคืนเวลาไทย), linkLineUser กรณีแก้ได้ 0 แถว

ขั้นที่ผมต้องทำเอง: เปิด Supabase Dashboard → SQL Editor → วางและรัน 001_init.sql แล้วตามด้วย seed.sql
(บอกผมทีละขั้น แล้วรอผมยืนยันก่อนทดสอบ)

ข้อห้าม/ข้อระวัง:
*** view ต้องมี security_invoker = true ไม่งั้น view จะข้าม RLS และเปิดข้อมูลให้ anon key อ่านได้ ***
*** ห้ามสร้าง RLS policy ที่เปิดให้ anon หรือ authenticated — การเข้าถึงทั้งหมดผ่าน api/ ด้วย secret key เท่านั้น ***
*** อย่าใช้ select('*') กับตารางที่มี verify_code / reg_code / line_user_id ***
*** server ของ Vercel ใช้เวลา UTC ห้ามใช้ getHours() หรือ toLocaleString() ที่ไม่ระบุ timeZone ***

Test criteria:
- ใน Supabase Table Editor เห็น 6 ตาราง + view และข้อมูลตัวอย่างครบ
- รัน 001_init.sql และ seed.sql ซ้ำ → ไม่มี error และไม่มีข้อมูลซ้ำ
- Supabase Dashboard → Advisors (Security) ไม่มีคำเตือนระดับ ERROR เกี่ยวกับ RLS หรือ view
- /api/health ตอบ ok: true
- npm test ผ่านทั้งหมด

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-1.2: Supabase schema, RLS, seed data and repositories"
4. สรุปสิ่งที่ทำ และแสดงตารางรหัสทดสอบจาก seed.sql ให้ผมจดไว้
```

**✅ Test criteria:**
- [ ] มีตารางครบใน Supabase พร้อมข้อมูลตัวอย่าง
- [ ] รัน SQL ซ้ำได้ไม่พัง
- [ ] Security Advisor ไม่เตือนเรื่อง RLS
- [ ] `npm test` ผ่าน

**⚠️ Gotcha:**
- ถ้า Supabase เตือน "RLS enabled, no policy" ระดับ INFO ไม่เป็นไร เพราะตั้งใจปิดกั้นทั้งหมด
- โปรเจกต์ Supabase แผนฟรีจะหยุดชั่วคราว (paused) ถ้าไม่มีการใช้งาน 7 วัน เช่น ช่วงปิดเทอม ต้องเข้า Dashboard กด Restore

---

## Phase 2 — LINE Login & ตัวตน

### Prompt 2.1 — LIFF + ตรวจ ID Token + session

> **Dependencies:** ต่อจาก Prompt 1.2 — ต้องสร้าง LINE MINI App channel และได้ LIFF ID + Channel ID แล้ว
> **ไฟล์ที่สร้าง:** ~13 ไฟล์
> **Git commit:** `phase-2.1: LIFF login with server-side ID token verification and session`

```text
ต่อจาก Prompt 1.2 (ฐานข้อมูลพร้อมแล้ว มีข้อมูลตัวอย่าง)
อ่าน CLAUDE.md ส่วน "กฎความปลอดภัย" และ "LIFF" ก่อนเริ่ม

งาน: ให้แอปเปิดผ่าน LINE แล้วรู้ว่าผู้ใช้เป็นใคร (ครู / นักเรียน / ยังไม่ผูกบัญชี) อย่างปลอดภัย
และทดสอบบนคอมได้โดยไม่ต้องเปิดใน LINE (โหมด mock)

ขั้นตอน:
  เปิด index.html → liff.init() → liff.getIDToken() → POST /api/auth?op=line { idToken }
  → server ตรวจ token กับ LINE → ได้ userId → หาใน teachers/students → สร้าง session cookie → ตอบ role
  → หน้าเว็บพาไป /teacher/, /student/ หรือ /link ตาม role

สิ่งที่ต้องสร้าง:
1. public/js/liff.js
   - initLiff(): ใช้ตัวแปร liff จาก <script src="https://static.line-scdn.net/liff/edge/2/sdk.js">
     เรียก liff.init({ liffId }) ครั้งเดียวต่อหน้า (เก็บ promise ไว้)
   - ถ้า !liff.isLoggedIn() → liff.login({ redirectUri: location.href })
   - โหมด mock: ถ้า location.hostname เป็น localhost และมี ?mockUser=<id> → ไม่เรียก LIFF จริง
     ให้ getIdToken() คืน "mock:<id>" และ profile จำลอง (จำ mockUser ไว้ใน sessionStorage ให้ใช้ข้ามหน้าได้)
   - closeApp(): liff.closeWindow() ถ้าอยู่ใน LINE, openExternal(url): liff.openWindow({ url, external: true })
2. public/js/auth.js
   - signIn(): ใช้ใน index.html — initLiff → getIdToken → POST /api/auth?op=line → คืน me
     ถ้า server ตอบว่า token หมดอายุ → liff.logout() + liff.login() ใหม่ 1 ครั้ง (กัน loop ด้วย sessionStorage)
   - requirePage(role): ใช้ทุกหน้าอื่น — GET /api/auth?op=me ถ้า 401 หรือ role ไม่ตรง → location.replace('/')
3. public/index.html — หน้า loading "กำลังเข้าสู่ระบบ..." แล้ว redirect ตาม role, หน้า error + ปุ่ม "ลองใหม่"
4. หน้าชั่วคราวที่แสดงชื่อและ role: public/link.html, public/teacher/index.html, public/student/index.html
   (แต่ละหน้ามี <script type="module" src="/js/pages/<ชื่อหน้า>.js">)
5. api/auth.js — 1 function รองรับหลาย op ผ่าน query ?op=
   - POST op=line → zod ตรวจ body → verify → resolve identity → set cookie → { role, name, displayName, pictureUrl }
   - GET  op=me → ข้อมูลผู้ใช้ปัจจุบัน หรือ 401
   - POST op=logout → ลบ cookie
   - op หรือ method ไม่ถูก → 404/405
6. lib/line-verify.js — POST https://api.line.me/oauth2/v2.1/verify (form-urlencoded: id_token, client_id = LINE_CHANNEL_ID)
   คืน { lineUserId: sub, displayName: name, pictureUrl: picture }
   โหมด mock: ยอมรับ "mock:<id>" เฉพาะเมื่อ DEV_MOCK_LOGIN === "true" และ VERCEL_ENV ไม่ใช่ "production"/"preview"
   และ host ของ request เป็น localhost — ครบทั้ง 3 เงื่อนไขเท่านั้น
7. lib/session.js — createSessionCookie(payload), readSession(req), clearSessionCookie()
   - JWT HS256 ด้วย jose, อายุ 12 ชั่วโมง, cookie ชื่อ ct_session: HttpOnly; Secure (ยกเว้น localhost); SameSite=Lax; Path=/
   - payload: lineUserId, displayName, pictureUrl
   - เขียนตัวช่วยอ่าน/เขียน cookie header เอง (ไม่ต้องลง library เพิ่ม)
8. lib/identity.js — resolveIdentity(lineUserId) → { role: 'teacher'|'student'|'unlinked', teacher?, student? } (หา teachers ก่อน)
9. lib/guard.js — requireSession(req) และ requireRole(req, role)
   resolve identity จากฐานข้อมูลทุก request (ไม่เก็บ role ใน cookie) ไม่ผ่าน → throw HttpError 401/403
10. ใส่ LIFF_ID ใน public/js/config.js (บอกผมว่าเอาจากไหน) และ DEV_MOCK_LOGIN=true ใน .env.local
11. Tests (Vitest): session สร้าง/อ่านได้, cookie ที่ถูกแก้ถูกปฏิเสธ, line-verify ปฏิเสธ "mock:" เมื่อ VERCEL_ENV=production
    หรือ host ไม่ใช่ localhost, resolveIdentity คืน role ถูกต้อง

ข้อห้าม/ข้อระวัง:
*** ห้ามเชื่อ userId หรือ profile ที่หน้าเว็บส่งมา — server ต้องตรวจ ID token กับ LINE ทุกครั้งที่สร้าง session ***
*** ห้ามเก็บ role ใน cookie หรือ localStorage แล้วเชื่อค่านั้น — ตรวจจากฐานข้อมูลทุกครั้ง ***
*** โหมด mock ต้องใช้ไม่ได้บนเว็บจริงเด็ดขาด ***
*** อย่า log ID token หรือ cookie ***
*** liff.init() ต้องเรียกก่อนใช้ฟังก์ชันอื่นของ liff ทุกครั้ง ***

Test criteria:
- เปิด http://localhost:3000/?mockUser=U_mock_new → ไปหน้า /link แสดง role "unlinked"
- เปิด http://localhost:3000/teacher/ โดยไม่มี cookie → ถูกพากลับหน้าแรก
- curl http://localhost:3000/api/auth?op=me → 401
- POST /api/auth?op=line ด้วย idToken "abc" → 401 พร้อมข้อความภาษาไทย
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-2.1: LIFF login with server-side ID token verification and session"
4. สรุปสิ่งที่ทำ และอธิบายวิธีใช้โหมด mock
```

**✅ Test criteria:**
- [ ] `/?mockUser=U_mock_new` ไปหน้า `/link`
- [ ] เข้าหน้าครู/นักเรียนโดยไม่ login ไม่ได้
- [ ] token ปลอมถูกปฏิเสธ
- [ ] test ยืนยันว่า mock ใช้ไม่ได้บน production

**⚠️ Gotcha:**
- LIFF ต้องเปิด scope `openid` และ `profile` ไม่งั้น `getIDToken()` ได้ `null`
- `LINE_CHANNEL_ID` คือ **Channel ID** (ตัวเลข) ไม่ใช่ LIFF ID
- LIFF ID ใส่ใน `public/js/config.js` ได้ เพราะเป็นค่าสาธารณะ ไม่ใช่ความลับ

---

### Prompt 2.2 — ผูกบัญชีครู/นักเรียนครั้งแรก

> **Dependencies:** ต่อจาก Prompt 2.1
> **ไฟล์ที่สร้าง:** ~9 ไฟล์
> **Git commit:** `phase-2.2: first-time account linking for teachers and students`

```text
ต่อจาก Prompt 2.1 (login ผ่าน LIFF ได้แล้ว รู้ role: teacher / student / unlinked)

งาน: ผู้ใช้ที่ยังไม่ผูกบัญชีกรอกรหัสครั้งแรกเพื่อผูก LINE กับข้อมูลในฐานข้อมูล ครั้งต่อไปเปิดแอปแล้วเข้าได้ทันที

สิ่งที่ต้องสร้าง:
1. public/js/dom.js — ตัวช่วยสร้าง element อย่างปลอดภัย: h(tag, attrs, ...children) ใส่ข้อความด้วย textContent เสมอ,
   clear(el), qs(selector) — ทุกหน้าต่อจากนี้ใช้ตัวนี้สร้าง UI
2. public/js/ui.js — showToast(message, type), showLoading(el), showError(el, message, onRetry), setBusy(button, busy)
3. public/link.html + public/js/pages/link.js
   - แสดงรูปและชื่อ LINE ของผู้ใช้
   - การ์ดเลือก "ฉันเป็นนักเรียน" / "ฉันเป็นครู"
   - ฟอร์มนักเรียน: รหัสนักเรียน + รหัสยืนยัน 6 หลัก (inputmode="numeric") + ข้อความ "ขอรหัสยืนยันได้จากครูประจำชั้น"
   - ฟอร์มครู: รหัสครู + รหัสลงทะเบียน
   - ก่อนบันทึก แสดงหน้ายืนยัน "คุณคือ ด.ช. สมชาย ใจดี ม.2/1 เลขที่ 5 ใช่หรือไม่?"
   - สำเร็จแล้วพาไป /teacher/ หรือ /student/
4. api/link.js — POST ?op=student { studentCode, verifyCode, confirm } และ POST ?op=teacher { teacherCode, regCode, confirm }
   - confirm=false → ตรวจรหัสแล้วคืนข้อมูลสำหรับหน้ายืนยัน (ยังไม่บันทึก)
   - confirm=true → ตรวจซ้ำแล้วบันทึก line_user_id + linked_at, เขียน audit_log
   - เงื่อนไข: ผู้ใช้ต้องเป็น unlinked, ข้อมูลต้อง active, รหัสต้องตรง, แถวนั้นยังไม่มี line_user_id
5. lib/services/link.js — logic การผูกบัญชีแยกจาก api เพื่อให้ test ง่าย
6. lib/rate-limit.js — นับรหัสผิดจากตาราง link_attempts: ผิดเกิน 5 ครั้งใน 15 นาทีต่อ lineUserId → 429 "ลองใหม่อีกครั้งใน X นาที"
   บันทึกทุกครั้งที่ลองผูก (success true/false)
7. public/js/header.js — ส่วนหัวสีเขียวแบบ <header> ใน design/prototype.html: โลโก้ + "ClassTrack" + "ระบบติดตามงานและเช็กชื่อเข้าเรียน"
   ด้านขวาเป็นรูปโปรไฟล์ LINE วงกลม (ลิงก์ไป /profile) แทนปุ่มสลับบทบาทของ prototype
   + skip link "ข้ามไปยังเนื้อหาหลัก" และ toast (role="status" aria-live="polite") แบบใน prototype
8. public/js/nav.js — bottom navigation 5 เมนูแบบ .bottom-nav ใน prototype (ใช้ <a> และ aria-current="page" กับเมนูที่ active)
   - นักเรียน: ⌂ หน้าหลัก (/student/) · ▤ งานของฉัน (/student/tasks) · ▦ เช็กชื่อ (/student/attendance) · ▥ รายงาน (/student/reports) · ♙ โปรไฟล์ (/profile)
   - ครู: ⌂ หน้าหลัก (/teacher/) · ▤ งาน (/teacher/assignments) · ▦ เช็กชื่อ (/teacher/attendance/) · ▥ รายงาน (/teacher/reports) · ♙ โปรไฟล์ (/profile)
   - หน้าย่อยให้เมนูแม่ active ตาม path (เช่น /teacher/assignment → งาน, /teacher/overview → รายงาน, /student/checkin → เช็กชื่อ)
   - สร้างหน้า placeholder "กำลังพัฒนา" ให้ทุกปลายทางที่ยังไม่มี (ใช้ header + nav ด้วย) เพื่อไม่ให้กดแล้ว 404 — prompt ถัดๆ ไปจะแทนที่
9. หน้า /link ใช้ .panel .field .btn ตาม prototype
10. Tests (Vitest, mock repos): ผูกสำเร็จ, รหัสผิด, รหัสไม่มีในระบบ, ถูกผูกไปแล้ว, active=false, เกิน rate limit

ข้อความ error:
- รหัสไม่มีในระบบ หรือรหัสยืนยันผิด → ข้อความเดียวกัน "รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"
- ถูกผูกกับ LINE อื่นแล้ว → "รหัสนี้ถูกผูกกับบัญชี LINE อื่นแล้ว กรุณาติดต่อครู"

ข้อห้าม/ข้อระวัง:
*** ห้ามใช้ innerHTML กับข้อมูลที่มาจากผู้ใช้หรือฐานข้อมูล — ใช้ textContent ผ่าน dom.js เท่านั้น (กัน XSS) ***
*** เทียบรหัสด้วย crypto.timingSafeEqual (แปลงเป็น Buffer ยาวเท่ากันก่อน) ***
*** บันทึก line_user_id ด้วย update แบบมีเงื่อนไข line_user_id is null (repo linkLineUser) — ถ้าแก้ได้ 0 แถวแปลว่ามีคนผูกไปก่อน ***
*** ถ้าชน unique constraint ของ line_user_id (LINE นี้ผูกกับคนอื่นแล้ว) ให้ตอบข้อความภาษาไทยที่เข้าใจได้ ไม่ใช่ error 500 ***
*** trim และตัดช่องว่างในรหัสก่อนเทียบ ***
*** ไม่ต้องทำหน้ายกเลิกการผูก — ครูทำเองโดยล้างค่า line_user_id ใน Supabase Table Editor (เขียนไว้ใน README แล้ว) ***

Test criteria (ใช้รหัสจาก seed.sql):
- /?mockUser=U_mock_s1 → ผูกเป็นนักเรียนสำเร็จ → ไป /student/ → ใน Table Editor ช่อง line_user_id เป็น U_mock_s1
- /?mockUser=U_mock_s2 ใช้รหัสนักเรียนคนเดียวกัน → "ถูกผูกกับบัญชี LINE อื่นแล้ว"
- กรอกรหัสผิด 6 ครั้ง → ครั้งที่ 6 ได้ 429
- /?mockUser=U_mock_t1 ผูกเป็นครู T001 → ไป /teacher/
- เปิด /?mockUser=U_mock_s1 ใหม่ → เข้า /student/ ทันที
- ลองกรอกชื่อ/รหัสเป็น <img src=x onerror=alert(1)> → ไม่มี alert เด้ง
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-2.2: first-time account linking for teachers and students"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] นักเรียนและครูผูกบัญชีได้
- [ ] รหัสเดียวกันผูกซ้ำกับ LINE อื่นไม่ได้
- [ ] กรอกผิดเกิน 5 ครั้งถูกบล็อก
- [ ] เปิดครั้งต่อไปเข้าได้ทันที

**⚠️ Gotcha:**
- ถ้าอยากทดสอบผูกใหม่ ให้ล้างค่า `line_user_id` ใน Table Editor แล้วลบ cookie ของ localhost ในเบราว์เซอร์

---

## Phase 3 — Core Features

### Prompt 3.1 — ครู: สร้าง/แก้ไข/ปิดรับงาน

> **Dependencies:** ต่อจาก Prompt 2.2
> **ไฟล์ที่สร้าง:** ~11 ไฟล์
> **Git commit:** `phase-3.1: teacher assignment create, edit and close`

```text
ต่อจาก Prompt 2.2 (ครูและนักเรียนผูกบัญชีได้แล้ว มี requireRole, dom.js, ui.js ให้ใช้)

งาน: ครูสร้างงาน/การบ้าน กำหนดวันส่ง ให้ได้หลายห้องพร้อมกัน แก้ไข และปิดรับงานได้

สิ่งที่ต้องสร้าง:
1. public/teacher/assignments.html + js/pages/teacher-assignments.js (เมนู "งาน" — แทนที่ placeholder)
   - หน้าตาแบบ tasksView ใน design/prototype.html: หัวข้อ + จำนวนรายการ, แถบตัวกรอง .toolbar "เปิดรับ" / "ปิดแล้ว"
     (ปุ่มที่เลือกใช้ .btn.secondary ที่เหลือ .btn.ghost)
   - รายการแบบ .task: ไอคอน 📝, ชื่องาน, "วิชา · ห้อง · กำหนดส่ง <formatThai>", แถบ .progress "ส่งแล้ว X/Y คน" (submitted + approved),
     .pill.late "เลยกำหนด" ถ้าเลยวันส่งแล้วยังมีคนค้าง
   - เรียงตามวันส่งที่ใกล้ที่สุดก่อน, ปุ่ม .btn.primary "＋ สร้างงานใหม่", empty state "ยังไม่มีงาน กดปุ่ม ＋ เพื่อสร้างงานแรก"
2. public/teacher/new.html + js/pages/teacher-new.js
   - ชื่องาน (บังคับ ≤ 100), รายละเอียด (≤ 1000), วิชา (บังคับ ≤ 50, มี <datalist> วิชาที่ครูเคยใช้)
   - เลือกห้องได้หลายห้อง (checkbox จากรายชื่อห้องที่มีนักเรียน) → สร้าง 1 งานต่อ 1 ห้อง
   - วันส่ง <input type="date"> + เวลา <input type="time"> ค่าเริ่มต้น 23:59
   - ถ้าวันส่งอยู่ในอดีต แสดงคำเตือนสีเหลือง แต่ยังบันทึกได้
   - ตรวจข้อมูลฝั่งหน้าเว็บก่อนส่ง (ข้อความไทยใต้ช่องที่ผิด) — server ตรวจซ้ำเสมอ
3. public/teacher/edit.html?id=... + js/pages/teacher-edit.js — แก้ทุกช่องยกเว้นห้อง + ปุ่ม "ปิดรับงาน" / "เปิดรับอีกครั้ง"
   (ไม่มีการลบงาน)
4. api/teacher.js — 1 function รองรับหลาย op (ทุก op ใช้ requireRole(req, 'teacher'))
   - GET  ?op=assignments&status=open|closed → งานของครูคนนี้ + ตัวเลขจาก view assignment_progress
   - POST ?op=create-assignment → body { title, description, subject, classrooms: string[], dueDate, dueTime }
   - GET  ?op=assignment&id=...
   - POST ?op=update-assignment&id=... → แก้ไข / เปลี่ยน status
   - GET  ?op=classrooms → รายชื่อห้องทั้งหมด
   - GET  ?op=subjects → วิชาที่ครูคนนี้เคยใช้
   - เขียน audit_log ทุกครั้งที่สร้าง/แก้/ปิดงาน
   - ใช้ตาราง map op → { method, handler } ให้อ่านง่าย (prompt ถัดไปจะเพิ่ม op อีก)
5. lib/validators/assignment.js — zod schema (ข้อความ error ภาษาไทย)
6. lib/services/assignments.js — logic สร้าง/แก้/รวมตัวเลขความคืบหน้า
7. ฟอร์มใช้ .panel .field แบบ createTaskPanel ใน prototype
8. Tests (Vitest): validator, สร้างงาน 2 ห้องได้ 2 แถว, ครูคนอื่นแก้งานไม่ได้ (404)

ข้อห้าม/ข้อระวัง:
*** ทุก op ต้องเช็กว่า assignment.teacher_id === teacher.id ของคนที่ login ถ้าไม่ใช่ตอบ 404 (ไม่บอกว่างานนั้นมีอยู่) ***
*** ห้ามรับ teacher_id จาก body หรือ query — ใช้จาก requireRole เท่านั้น ***
*** แปลงวันส่งที่ server ด้วย toDueAt(dueDate + 'T' + dueTime) ให้เป็นเวลาไทย ***
*** ชื่อห้องอย่าง "ม.2/1" ต้องส่งผ่าน URLSearchParams หรือ JSON body เสมอ ***
*** แสดงข้อความจากฐานข้อมูลด้วย textContent เท่านั้น ***

Test criteria (ใช้ mockUser ของครู T001):
- สร้างงาน "แบบฝึกหัดบทที่ 1" วิชาคณิตศาสตร์ ห้อง ม.2/1 และ ม.2/2 → ใน Table Editor ตาราง assignments มี 2 แถว
- หน้า /teacher/assignments แสดง 2 รายการ "ส่งแล้ว 0/4 คน"
- แก้ชื่องาน → ฐานข้อมูลเปลี่ยน, updated_at เปลี่ยน
- ปิดรับงาน → ย้ายไปแท็บ "ปิดแล้ว"
- ครู T002 เปิด /teacher/edit?id=<id ของ T001> → ขึ้น "ไม่พบงาน"
- ส่งชื่องานว่างตรงไปที่ API (curl) → 400 พร้อมข้อความภาษาไทย
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-3.1: teacher assignment create, edit and close"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] สร้างงานหลายห้องได้
- [ ] แก้ไขและปิดรับงานได้
- [ ] ครูคนอื่นเห็น/แก้งานไม่ได้
- [ ] วันส่งในฐานข้อมูลตรงกับเวลาไทยที่เลือก

**⚠️ Gotcha:**
- Supabase Table Editor แสดง `due_at` เป็นเวลา UTC (ช้ากว่าไทย 7 ชั่วโมง) เป็นเรื่องปกติ ในแอปจะแสดงเป็นเวลาไทย

---

### Prompt 3.2 — ครู: กระดานติดตามการส่งงานรายชิ้น

> **Dependencies:** ต่อจาก Prompt 3.1
> **ไฟล์ที่สร้าง:** ~7 ไฟล์
> **Git commit:** `phase-3.2: teacher submission tracking board`

```text
ต่อจาก Prompt 3.1 (ครูสร้าง/แก้/ปิดงานได้แล้ว api/teacher.js มีตาราง op อยู่แล้ว)

งาน: หน้าติดตามงาน 1 ชิ้น — ครูเห็นนักเรียนทุกคนในห้อง ใครส่ง/ไม่ส่ง/ส่งช้า และกดยืนยันหรือให้แก้ไขได้ทีละคนหรือหลายคน

สิ่งที่ต้องสร้าง:
1. public/teacher/assignment.html?id=... + js/pages/teacher-board.js
   - หัวหน้า: ชื่องาน วิชา ห้อง วันส่ง สถานะงาน ปุ่ม "แก้ไข"
   - ชิปสรุป (กดเพื่อกรอง): ทั้งหมด / ยังไม่ส่ง / รอตรวจ / ตรวจแล้ว / ให้แก้ไข / ส่งช้า
   - ช่องค้นหาชื่อนักเรียน
   - รายชื่อเรียงตามเลขที่: เลขที่, ชื่อ-สกุล, ป้ายสถานะ (.pill.todo=ยังไม่ส่ง, .pill.review=รอตรวจ, .pill.done=ตรวจแล้ว, .pill.revise=ให้แก้ไข),
     เวลาที่ส่ง, ป้าย "ส่งช้า", หมายเหตุ และลิงก์งาน (เปิดด้วย openExternal)
   - ปุ่มต่อคน: "ยืนยันส่งแล้ว", "ให้แก้ไข" (bottom sheet พิมพ์ความเห็น ≤ 300 ตัว), "รีเซ็ตเป็นยังไม่ส่ง"
   - โหมดเลือกหลายคน (checkbox) + แถบล่าง "ยืนยันส่งแล้ว (N คน)" สำหรับงานที่ส่งเป็นกระดาษ
   - ปุ่ม "คัดลอกรายชื่อคนค้างส่ง" → navigator.clipboard.writeText(...) ข้อความเช่น
     "งาน แบบฝึกหัดบทที่ 1 (ม.2/1) ยังไม่ส่ง 3 คน: เลขที่ 3 สมชาย, เลขที่ 7 ... ส่งภายใน 20 พ.ย. 69 23:59"
2. public/js/bottom-sheet.js — bottom sheet ใช้ซ้ำได้ (ปิดด้วยปุ่ม/แตะพื้นหลัง/ปุ่ม Esc)
3. เพิ่ม op ใน api/teacher.js (ตรวจความเป็นเจ้าของงานทุก op)
   - GET  ?op=board&id=... → { assignment, rows: [{ student: {id, number, prefix, first_name, last_name}, submission|null, status, isLate }], summary }
   - POST ?op=review&id=... → { studentIds: string[] (1–60), action: 'approve'|'revise'|'reset', comment? }
     · approve: ถ้ายังไม่มีแถว สร้างใหม่ submitted_at = now(), is_late คำนวณจากวันส่ง
     · revise: ต้องมี comment
     · reset: status = not_submitted, ล้าง reviewed_*
     · reviewed_by = teacher.id, reviewed_at = now()
     · เขียนทั้งหมดด้วย submissions.upsertMany ครั้งเดียว
     · studentIds ทุกคนต้องเป็นนักเรียน active ในห้องของงานนั้น ไม่งั้น 400
4. lib/services/board.js — รวมนักเรียน + การส่ง แล้วคำนวณ status/สรุป (เป็น pure function, test ง่าย ใช้ซ้ำใน 3.3)
5. Optimistic UI: กดแล้วเปลี่ยนทันที ถ้า API ล้มเหลวคืนค่าเดิม + toast error
6. Tests (Vitest): board service คำนวณสรุปถูก, isLate ถูก, review ปฏิเสธนักเรียนนอกห้อง, revise ไม่มี comment → 400

ข้อห้าม/ข้อระวัง:
*** ห้ามยิง API ทีละคนใน loop จากหน้าเว็บ — ส่ง studentIds เป็น array ครั้งเดียว ***
*** ใช้ upsert onConflict (assignment_id, student_id) เท่านั้น ห้าม select แล้วค่อย insert (เกิดแถวซ้ำเมื่อกดพร้อมกัน) ***
*** แสดงลิงก์ของนักเรียนเฉพาะที่ขึ้นต้นด้วย http:// หรือ https:// และแสดงหมายเหตุด้วย textContent ***
*** อย่าส่ง verify_code หรือ line_user_id ของนักเรียนกลับไปที่หน้าเว็บ ***

Test criteria (ครู T001 + นักเรียนจาก seed):
- เปิดงานของห้อง ม.2/1 → เห็นนักเรียน 4 คน "ยังไม่ส่ง" ทั้งหมด
- เลือก 2 คน → "ยืนยันส่งแล้ว" → ตาราง submissions มี 2 แถว status approved
- "ให้แก้ไข" พร้อมความเห็น → status revise, teacher_comment ถูกต้อง
- "รีเซ็ต" → status not_submitted
- กรอง "ยังไม่ส่ง" → เห็นเฉพาะคนที่ยังไม่ส่ง
- คัดลอกรายชื่อคนค้างส่ง → ข้อความถูกต้อง
- ดู Network ใน DevTools → response ของ board ไม่มี verify_code / line_user_id
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-3.2: teacher submission tracking board"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] เห็นสถานะนักเรียนทุกคนในห้อง
- [ ] ยืนยัน/ให้แก้/รีเซ็ต ได้ทั้งทีละคนและหลายคน
- [ ] คัดลอกรายชื่อคนค้างได้
- [ ] ไม่มีข้อมูลลับหลุดใน response

**⚠️ Gotcha:**
- `navigator.clipboard` ใช้ได้เฉพาะ HTTPS หรือ localhost ใน LINE ใช้ได้เพราะ Vercel เป็น HTTPS

---

### Prompt 3.3 — ครู: ภาพรวมการส่งงานรายห้อง

> **Dependencies:** ต่อจาก Prompt 3.2
> **ไฟล์ที่สร้าง:** ~5 ไฟล์
> **Git commit:** `phase-3.3: teacher classroom overview matrix`

```text
ต่อจาก Prompt 3.2 (กระดานติดตามงานรายชิ้นใช้ได้แล้ว มี lib/services/board.js)

งาน: หน้าภาพรวมห้องเรียน — ตารางนักเรียน × งานทุกชิ้นของครู เพื่อดูว่าใครค้างงานสะสมกี่ชิ้น

สิ่งที่ต้องสร้าง:
1. ปุ่ม "ภาพรวมห้อง" ในหน้า /teacher/assignments ลิงก์มาหน้านี้ (เมนูที่ active คือ "รายงาน" — หน้ารวมรายงานทำใน 4.4)
2. public/teacher/overview.html?room=...&subject=... + js/pages/teacher-overview.js
   - dropdown เลือกห้อง (เฉพาะห้องที่ครูมีงาน) และวิชา (ทั้งหมด หรือเลือกวิชา) — เปลี่ยนแล้วอัปเดต URL ด้วย history.replaceState
   - ตาราง: แถว = นักเรียน (คอลัมน์แรก sticky: เลขที่ + ชื่อ), คอลัมน์ = งาน (ใหม่สุดอยู่ซ้าย เลื่อนแนวนอนได้)
   - ช่องตาราง: ✓ เขียว (ตรวจแล้ว), ⏳ เหลือง (รอตรวจ), ↺ ส้ม (ให้แก้ไข), ✗ แดง (ยังไม่ส่งและเลยกำหนด), – เทา (ยังไม่ส่ง ยังไม่ถึงกำหนด)
   - คอลัมน์สุดท้าย "ค้าง" = จำนวนงานที่ยังไม่ส่งหรือให้แก้ไข
   - ปุ่มสลับเรียง: ตามเลขที่ / ค้างมากสุดก่อน
   - แตะหัวคอลัมน์งาน → /teacher/assignment?id=...
   - legend อธิบายสัญลักษณ์ใต้ตาราง
   - ปุ่ม "คัดลอกรายชื่อคนค้างงาน" → "ม.2/1 วิชาคณิตศาสตร์ ค้างงาน: เลขที่ 3 สมชาย (2 งาน), ..."
3. เพิ่ม op ใน api/teacher.js: GET ?op=overview&room=...&subject=... (เฉพาะงานของครูคนนี้)
   → { students, assignments, cells: { [studentId]: { [assignmentId]: status } }, outstanding }
   - query ไม่เกิน 3 ครั้ง: นักเรียนในห้อง, งานของครูในห้องนั้น, submissions ของงานเหล่านั้น (.in('assignment_id', ids))
4. ใช้ฟังก์ชันคำนวณสถานะจาก lib/services/board.js ซ้ำ ห้ามเขียน logic ใหม่
5. Tests (Vitest): คำนวณ matrix และจำนวนค้างถูกต้อง, ครูไม่เห็นงานของครูคนอื่นในห้องเดียวกัน

ข้อห้าม/ข้อระวัง:
*** ห้าม query ทีละนักเรียนหรือทีละงานใน loop ***
*** ตารางต้องใช้ได้บนจอ 360px — overflow-x: auto และ position: sticky สำหรับคอลัมน์ชื่อ ***
*** อ่าน room จาก URLSearchParams (decode ให้อัตโนมัติ) ***

Test criteria:
- เลือกห้อง ม.2/1 → เห็นนักเรียน 4 แถว และงานทุกชิ้นของ T001 ในห้องนั้น
- สัญลักษณ์ตรงกับสถานะในหน้ากระดาน (3.2)
- เรียง "ค้างมากสุดก่อน" ถูกต้อง
- แตะหัวคอลัมน์ → ไปหน้ากระดานของงานนั้น
- รีเฟรชหน้า → ยังเลือกห้อง/วิชาเดิม (จาก URL)
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-3.3: teacher classroom overview matrix"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] ตารางภาพรวมแสดงถูกต้อง
- [ ] เลื่อนดูบนมือถือได้ ชื่อนักเรียนติดอยู่ซ้าย
- [ ] คัดลอกรายชื่อคนค้างได้

**⚠️ Gotcha:**
- ไม่ทำปุ่มดาวน์โหลด CSV เพราะเบราว์เซอร์ใน LINE ดาวน์โหลดไฟล์ได้ไม่เสถียร ถ้าต้องการไฟล์ ให้ export จาก Supabase Table Editor (ปุ่ม Export → CSV)

---

### Prompt 3.4 — นักเรียน: งานของฉัน + แจ้งส่งงาน

> **Dependencies:** ต่อจาก Prompt 3.3
> **ไฟล์ที่สร้าง:** ~8 ไฟล์
> **Git commit:** `phase-3.4: student assignment list and submission`

```text
ต่อจาก Prompt 3.3 (ฝั่งครูครบแล้ว)

งาน: นักเรียนเห็นงานของห้องตัวเอง รู้ว่างานไหนค้าง/ใกล้ครบกำหนด และกด "แจ้งส่งงาน" ได้

สิ่งที่ต้องสร้าง:
1. public/student/tasks.html + js/pages/student-tasks.js (เมนู "งานของฉัน" — แทนที่ placeholder, หน้าตาแบบ tasksView ใน prototype)
   - หัวข้อ "งานของฉัน" + "ทั้งหมด N รายการ"
   - การ์ดสรุปเล็ก: "ค้างส่ง N งาน" และ "เลยกำหนด M งาน" (.notice สีแดงถ้า M > 0)
   - ตัวกรอง .toolbar: "ต้องทำ" (ยังไม่ส่ง + ให้แก้ไข: เลยกำหนดอยู่บนสุด แล้วเรียงวันส่งใกล้สุด), "รอตรวจ", "เสร็จแล้ว"
   - รายการแบบ .task: ไอคอนตามวิชา, ชื่องาน, "วิชา · กำหนดส่ง <วันที่> (<relativeDue>)", pill: ใกล้ถึงกำหนด ≤ 2 วัน (.todo),
     ยังไม่ส่ง (.todo), เลยกำหนด (.late), ให้แก้ไข (.revise), รอตรวจ (.review), ส่งแล้ว (.done)
   - แสดงงาน open ทั้งหมดของห้อง + งาน closed เฉพาะที่ตัวเองเคยส่ง
   - empty state "ไม่มีงานค้าง เยี่ยมมาก! 🎉"
2. public/student/assignment.html?id=... + js/pages/student-assignment.js
   - รายละเอียดงาน (CSS white-space: pre-wrap), ชื่อครู, วันส่ง + นับถอยหลัง
   - สถานะปัจจุบัน และความเห็นจากครู (ถ้าถูกสั่งแก้)
   - ฟอร์ม "แจ้งส่งงาน": หมายเหตุ (≤ 500 ตัว เช่น "ส่งสมุดที่โต๊ะครูแล้ว") + ลิงก์งาน (ไม่บังคับ ≤ 500 ตัว http/https เท่านั้น
     เช่น Google Drive / Canva) — ต้องกรอกอย่างน้อย 1 ช่อง, มีตัวนับตัวอักษร
   - ส่ง/แก้ได้เมื่อสถานะเป็น not_submitted, submitted หรือ revise
   - ล็อกฟอร์มเมื่อ approved ("ครูตรวจแล้ว") หรืองานปิดรับ ("งานนี้ปิดรับแล้ว")
   - ถ้าเลยกำหนด ยังส่งได้แต่เตือน "จะถูกบันทึกว่าส่งช้า"
   - ปุ่มส่ง disabled ระหว่างรอ แล้วแสดง "แจ้งส่งงานเรียบร้อย ✓"
3. api/student.js — 1 function หลาย op (ทุก op ใช้ requireRole(req, 'student'))
   - GET  ?op=assignments → งานของห้อง + สถานะของตัวเอง + สรุป
   - GET  ?op=assignment&id=... → ต้องเป็นงานของห้องตัวเอง ไม่งั้น 404
   - POST ?op=submit&id=... { note?, linkUrl? } → status = submitted, submitted_at = now(), is_late คำนวณที่ server,
     ล้าง teacher_comment เดิม, ใช้ submissions.upsertMany
4. lib/validators/submission.js — zod (trim, ตรวจ URL ด้วย new URL() + protocol, ข้อความไทย)
5. หน้า /student/assignment ใช้ .panel .field และปุ่ม .btn.primary แบบ prototype
6. Tests (Vitest): validator (ปฏิเสธ javascript:, ยาวเกิน, ว่างทั้ง 2 ช่อง), ส่งงานที่ approved แล้ว → 409,
   ส่งงานที่ปิดรับ → 409, ส่งงานห้องอื่น → 404

ข้อห้าม/ข้อระวัง:
*** ห้ามรับ student_id จาก body หรือ query — ใช้จาก requireRole เท่านั้น ***
*** response ต้องเลือก field เอง ห้ามส่งข้อมูลนักเรียนคนอื่น, verify_code, line_user_id ***
*** is_late คำนวณที่ server เท่านั้น ***
*** ใช้ textContent แสดงรายละเอียดงานและความเห็นครู ***

Test criteria (นักเรียน ม.2/1 ที่ผูกไว้แล้ว):
- /student/tasks → เห็นงานของห้อง ม.2/1 เท่านั้น
- แจ้งส่งพร้อมลิงก์ → ย้ายไป "รอตรวจ" → ตาราง submissions status submitted
- ฝั่งครู (3.2) เห็น "รอตรวจ" พร้อมลิงก์ → กด "ให้แก้ไข" → นักเรียนเห็นป้ายส้มและความเห็นครู
- นักเรียนส่งใหม่ → "รอตรวจ" → ครูยืนยัน → นักเรียนเห็นใน "เสร็จแล้ว" และฟอร์มถูกล็อก
- ส่งลิงก์ "javascript:alert(1)" → 400
- แก้ due_at ของงานใน Table Editor ให้เป็นเมื่อวาน แล้วส่ง → is_late = true
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-3.4: student assignment list and submission"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] นักเรียนเห็นเฉพาะงานของห้องตัวเอง
- [ ] แจ้งส่ง / ส่งใหม่หลังถูกสั่งแก้ ได้
- [ ] ทดสอบครบวงจรครู ↔ นักเรียน
- [ ] ส่งช้าถูกบันทึก

**⚠️ Gotcha:**
- ใช้ 2 แท็บเบราว์เซอร์ทดสอบครู/นักเรียนพร้อมกันไม่ได้ เพราะ cookie เดียวกัน ให้ใช้หน้าต่างปกติ 1 คน + Incognito 1 คน

---

## Phase 4 — เช็กชื่อด้วย QR Code

### Prompt 4.1 — ฐานข้อมูลเช็กชื่อ + ครูเปิดรอบเช็กชื่อ + จอ QR ที่เปลี่ยนทุก 20 วินาที

> **Dependencies:** ต่อจาก Prompt 3.4
> **ไฟล์ที่สร้าง:** ~14 ไฟล์
> **Git commit:** `phase-4.1: attendance sessions with rotating QR code`

```text
ต่อจาก Prompt 3.4 (ระบบงาน/การบ้านครบแล้วทั้งฝั่งครูและนักเรียน)
อ่าน CLAUDE.md ส่วน "เช็กชื่อ (Attendance)" ก่อนเริ่ม

งาน: เพิ่มระบบเช็กชื่อรายคาบ/รายวิชา — ครูเปิดรอบเช็กชื่อให้ห้องหนึ่ง แล้วเปิดจอแสดง QR code ที่เปลี่ยนทุก 20 วินาที
(prompt นี้ทำฝั่งครูและฐานข้อมูล ฝั่งนักเรียนสแกนอยู่ใน Prompt 4.2)

สิ่งที่ต้องสร้าง:
1. supabase/migrations/002_attendance.sql (รันซ้ำได้)
   - attendance_sessions: id uuid, teacher_id → teachers, classroom (not null), subject (1–50 ตัว), title (≤ 50 ตัว, null ได้ เช่น "คาบ 3"),
     starts_at timestamptz default now(), late_after_minutes int default 10 (check 0–120),
     status ('open','closed') default 'open', closed_at, created_at
   - attendance_records: id uuid, session_id → attendance_sessions (on delete cascade), student_id → students,
     status ('present','late','absent','leave','sick'), method ('qr','code','manual','auto'), checked_at timestamptz default now(),
     marked_by → teachers (null ได้), note (≤ 100 ตัว), updated_at (+ trigger) · unique (session_id, student_id)
   - link_attempts: เพิ่มคอลัมน์ kind text not null default 'link' check in ('link','checkin') + index (line_user_id, kind, created_at)
   - index: attendance_sessions(teacher_id, created_at desc), attendance_sessions(classroom, status), attendance_records(student_id)
   - enable RLS ไม่สร้าง policy + revoke all from anon, authenticated (เหมือน 001)
2. ติดตั้ง qrcode (ใช้ฝั่ง server เท่านั้น) — lib/qr.js: toSvg(text) → QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
3. lib/attendance-code.js — รหัส 6 หลักแบบหมุนเวียน (ไม่เก็บในฐานข้อมูล)
   - WINDOW_SECONDS = 20, ACCEPT_WINDOWS = 3 (ช่วงปัจจุบัน + 2 ช่วงก่อนหน้า = ใช้ได้ไม่เกิน 60 วินาที)
   - key = HMAC-SHA256(SESSION_SECRET, "attendance-code-v1") (แยก key ตามจุดประสงค์ ไม่ใช้ SESSION_SECRET ตรงๆ)
   - windowOf(nowMs) = Math.floor(nowMs / 1000 / WINDOW_SECONDS)
   - codeFor(sessionId, window): HMAC(key, `${sessionId}:${window}`) → 4 byte แรกเป็น uint32 → % 1_000_000 → padStart(6, '0')
   - verifyCode(sessionId, code, nowMs) → true ถ้าตรงกับช่วงใดช่วงหนึ่งใน ACCEPT_WINDOWS (เทียบด้วย timingSafeEqual)
   - windowEndsAt(nowMs) สำหรับแสดงนับถอยหลัง
4. lib/checkin-url.js — buildCheckinUrl(sessionId, code, host)
   - production: https://miniapp.line.me/<LIFF_ID>/student/checkin?s=<sessionId>&c=<code> (LIFF_ID จาก env ฝั่ง server)
   - ถ้า host เป็น localhost: http://localhost:3000/student/checkin?s=...&c=... (ไว้ทดสอบด้วย mock)
5. lib/repos/attendance.js — createSession, getSession, listSessionsByTeacher(teacherId, { days }), listOpenByClassroom(classroom),
   listRecords(sessionId), countRecords(sessionIds) — select ระบุคอลัมน์เอง, ห้าม query ใน loop
6. lib/services/attendance.js + lib/validators/attendance.js (zod, ข้อความไทย)
7. เพิ่ม op ใน api/teacher.js (requireRole teacher + ตรวจความเป็นเจ้าของทุก op ที่มี id)
   - GET  ?op=attendance-sessions → รอบของครูคนนี้ 14 วันล่าสุด (ใหม่สุดก่อน) + จำนวน มา/สาย/ขาด/ลา/ยังไม่เช็ก
   - POST ?op=create-attendance { classroom, subject, title?, lateAfterMinutes } → สร้างรอบ (starts_at = ตอนนี้)
     ถ้าครูคนนี้มีรอบที่ยัง open ในห้องเดียวกันอยู่แล้ว → 409 พร้อม id ของรอบเดิม
   - GET  ?op=attendance-live&id=... → { session, code, qrSvg, checkinUrl (เฉพาะตอน dev), windowEndsAt, serverNow,
     counts: { checked, present, late, total }, recent: 10 คนล่าสุด [{ number, name, status, checkedAt }] }
     ถ้ารอบปิดแล้ว ตอบ { session, closed: true } ไม่ส่ง code/qr
8. (เมนู "เช็กชื่อ" ของครูมีอยู่แล้วจาก 2.2 — หน้านี้แทนที่ placeholder)
9. public/teacher/attendance/index.html + js/pages/teacher-attendance.js
   - panel "สร้าง QR Code สำหรับเช็กชื่อ" แบบ teacherQrPanel ใน prototype: รายวิชา (datalist จากวิชาที่เคยใช้), ห้องเรียน (select),
     ชื่อคาบ (ไม่บังคับ), "กำหนดมาสายหลัง (นาที)" (5 / 10 / 15 / 20 / 30, ค่าเริ่มต้น 10)
     → ปุ่ม .btn.purple "สร้าง QR Code" → สร้างรอบแล้วไปหน้าจอ QR ทันที
   - ถ้าเปิดมาพร้อม ?new=1 ให้เลื่อนไปที่ฟอร์มและโฟกัสช่องแรก (ใช้จากปุ่มบนหน้าหลักใน 4.4)
   - รายการรอบ: วันที่/เวลา, ห้อง, วิชา, ป้าย "กำลังเปิด" (เขียว) หรือ "ปิดแล้ว", ตัวเลข มา/สาย/ขาด/ลา
   - รอบที่ยังเปิด มีปุ่ม "เปิดจอ QR"
10. public/teacher/attendance/live.html?id=... + js/pages/teacher-attendance-live.js (จอสำหรับฉายโปรเจกเตอร์หรือถือให้นักเรียนสแกน)
   - QR ใหญ่กลางจอ (ขนาด min(80vw, 65vh)) แสดงด้วย img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg)
   - รหัส 6 หลักตัวใหญ่ใต้ QR (เว้นช่องระหว่างตัวเลข) + ข้อความ "หรือกรอกรหัสนี้ในแอป"
   - แถบนับถอยหลัง 20 วินาที (คำนวณจาก windowEndsAt และ serverNow ให้ตรงกับเวลา server ไม่ใช้นาฬิกามือถือครูตรงๆ)
   - ตัวนับ "เช็กแล้ว 25/32 คน (สาย 3)" และรายชื่อ 10 คนล่าสุด
   - ดึงข้อมูลใหม่ทุก 4 วินาทีด้วย setTimeout ต่อกัน (ไม่ใช้ setInterval), หยุดเมื่อหน้าถูกซ่อน (visibilitychange) แล้วดึงต่อเมื่อกลับมา
   - ขอ Screen Wake Lock (navigator.wakeLock) กันจอดับ ถ้าเบราว์เซอร์ไม่รองรับให้ข้าม
   - ปุ่ม "เต็มจอ" (แสดงเฉพาะเมื่อ document.fullscreenEnabled)
   - ปุ่ม "จัดการรายชื่อ" (ไปหน้าใน Prompt 4.3 — ตอนนี้ทำเป็นลิงก์ไว้ก่อน)
   - โหมด dev: แสดงลิงก์ checkinUrl ตัวเล็กใต้รหัส เพื่อ copy ไปเปิดในหน้าต่าง Incognito ของนักเรียน mock
11. Tests (Vitest): attendance-code (รหัสคงที่เมื่อเวลาเท่ากัน, เปลี่ยนเมื่อข้ามช่วง, ใช้ได้ถึง 60 วินาทีแล้วหมดอายุ,
    คนละรอบได้รหัสต่างกัน, รหัสยาว 6 หลักเสมอแม้ขึ้นต้นด้วย 0), create-attendance ซ้ำห้องเดิม → 409, ครูคนอื่นเปิด live → 404
12. เพิ่ม LIFF_ID ใน .env.example และ .env.local (ค่าเดียวกับ public/js/config.js)

ขั้นที่ผมต้องทำเอง: รัน 002_attendance.sql ใน Supabase SQL Editor (บอกทีละขั้นแล้วรอผม)

ข้อห้าม/ข้อระวัง:
*** ห้ามสร้าง QR ด้วย library ฝั่งหน้าเว็บ — server สร้าง SVG แล้วส่งมาเป็นข้อความใน JSON ***
*** ห้ามแสดง SVG ด้วย innerHTML — ใช้ <img> กับ data URL เท่านั้น ***
*** ห้ามเก็บรหัส 6 หลักในฐานข้อมูลหรือ log ***
*** ห้ามส่ง code / qrSvg ให้ใครนอกจากครูเจ้าของรอบ ***
*** ห้ามแก้ไฟล์ 001_init.sql — เปลี่ยน schema ผ่าน 002 เท่านั้น ***

Test criteria (ครู T001):
- รัน 002_attendance.sql ซ้ำ 2 ครั้งไม่มี error, Supabase Security Advisor ไม่มีคำเตือนระดับ ERROR
- เปิดรอบเช็กชื่อห้อง ม.2/1 วิชาคณิตศาสตร์ → ไปหน้าจอ QR เห็น QR + รหัส 6 หลัก + แถบนับถอยหลัง
- รอ 20 วินาที → QR และรหัสเปลี่ยน
- ใช้แอปสแกน QR บนมือถือ (เช่น กล้องมือถือ) อ่านค่าได้เป็น URL ตามรูปแบบที่กำหนด
- เปิดรอบห้องเดิมซ้ำ → แจ้งว่ามีรอบเปิดอยู่แล้ว พร้อมปุ่มไปรอบเดิม
- ครู T002 เปิด /teacher/attendance/live?id=<รอบของ T001> → "ไม่พบรอบเช็กชื่อ"
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-4.1: attendance sessions with rotating QR code"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] ตารางเช็กชื่อสร้างใน Supabase แล้ว
- [ ] จอ QR แสดงและเปลี่ยนทุก 20 วินาที
- [ ] เปิดรอบซ้ำห้องเดิมไม่ได้
- [ ] ครูคนอื่นเห็นจอ QR ไม่ได้

**⚠️ Gotcha:**
- จอ QR ดึงข้อมูลทุก 4 วินาที ถ้าเปิดทิ้งไว้ทั้งวันจะเปลือง ให้ปิดหน้าจอหรือปิดรอบเมื่อเช็กเสร็จ (หน้าจะหยุดดึงเองเมื่อถูกซ่อน)
- ถ้าฉายขึ้นโปรเจกเตอร์ ให้ปรับความสว่างจอให้สูง QR ที่ฉายบนผนังสีอ่อนจะสแกนยาก

---

### Prompt 4.2 — นักเรียน: สแกน QR / กรอกรหัสเพื่อเช็กชื่อ + ประวัติการมาเรียน

> **Dependencies:** ต่อจาก Prompt 4.1
> **ไฟล์ที่สร้าง:** ~10 ไฟล์
> **Git commit:** `phase-4.2: student QR check-in and attendance history`

```text
ต่อจาก Prompt 4.1 (ครูเปิดรอบเช็กชื่อและแสดง QR ได้แล้ว มี lib/attendance-code.js)

งาน: นักเรียนเช็กชื่อได้ 3 ทาง แล้วระบบบันทึก "มา" หรือ "สาย" อัตโนมัติ
  ทาง 1: สแกน QR ด้วยกล้องของ LINE (ปุ่มสแกนในแชท/หน้าหลัก LINE) → เปิด Mini App ที่หน้า /student/checkin แล้วเช็กชื่อทันที
  ทาง 2: กดปุ่ม "สแกนเช็กชื่อ" ในแอป → liff.scanCodeV2()
  ทาง 3: กดปุ่ม "กรอกรหัส" แล้วพิมพ์รหัส 6 หลักจากจอครู (สำหรับคนที่กล้องมีปัญหา)

สิ่งที่ต้องสร้าง:
1. public/index.html (แก้): ถ้า URL มี query "liff.state" แปลว่า LINE กำลังพาไปหน้าย่อย (เช่น /student/checkin)
   → เรียก liff.init() แล้วปล่อยให้ LIFF redirect เอง ห้ามพาไปหน้า role ของเราทับ
   (ตรวจพฤติกรรม secondary redirect ของ liff.init จากเอกสาร LINE ก่อนเขียน)
2. public/student/checkin.html + js/pages/student-checkin.js
   - อ่าน s (sessionId) และ c (code) จาก URL
   - เรียก signIn() ในหน้านี้เลย (ห้ามใช้ requirePage ที่ redirect ไปหน้าแรก เพราะ s และ c จะหายไป)
   - ถ้ายังไม่ผูกบัญชี → "กรุณาผูกบัญชีก่อน" + ปุ่มไป /link (หลังผูกเสร็จให้สแกนใหม่)
   - ถ้าเป็นครู → "หน้านี้สำหรับนักเรียน"
   - ส่ง POST /api/student?op=checkin { sessionId, code } แล้วแสดงผลเต็มจอ:
     · ✅ "เช็กชื่อแล้ว — มาเรียน" + วิชา + เวลา (สีเขียว)
     · ⏰ "เช็กชื่อแล้ว — มาสาย" (สีเหลือง)
     · ℹ️ "คุณเช็กชื่อรอบนี้แล้ว (สถานะ: ...)"
     · ❌ "QR หมดอายุแล้ว กรุณาสแกนใหม่จากจอครู" + ปุ่ม "สแกนใหม่"
     · ❌ "รอบเช็กชื่อนี้ปิดแล้ว" / "ไม่พบรอบเช็กชื่อนี้ในห้องของคุณ"
   - หลังได้ผล ลบ c ออกจาก URL ด้วย history.replaceState (กดรีเฟรชแล้วจะไม่ส่งรหัสเก่าซ้ำ)
   - ปุ่ม "ไปหน้างานของฉัน" และ "ปิด" (closeApp)
3. public/js/checkin.js (ใช้ร่วมกันหลายหน้า)
   - scanAndCheckin(): ถ้า liff.isApiAvailable('scanCodeV2') → liff.scanCodeV2() → parseCheckinValue(value)
     รับเฉพาะ URL ที่ path ลงท้ายด้วย /student/checkin และมี s กับ c (ทั้งแบบ miniapp.line.me/<LIFF_ID>/... และ host ของแอปเอง)
     ไม่ตรง → "QR นี้ไม่ใช่ QR เช็กชื่อ"
   - checkinWithCode(code): POST { code } อย่างเดียว (ไม่มี sessionId)
   - ถ้า scanCodeV2 ใช้ไม่ได้ (เช่นเปิดบนคอม) ให้ซ่อนปุ่มสแกนและเหลือปุ่มกรอกรหัส
4. ปุ่ม "กรอกรหัส" เปิด bottom sheet ช่องตัวเลข 6 หลัก (inputmode="numeric", autocomplete="one-time-code") — อยู่ใน checkin.js ใช้ซ้ำได้
5. public/student/attendance.html + js/pages/student-attendance.js (เมนู "เช็กชื่อ" — แทนที่ placeholder, หน้าตาแบบ attendanceView ใน prototype)
   - .two-col ซ้าย: panel "สแกน QR Code เพื่อเช็กชื่อ"
     · มีรอบเปิดที่ยังไม่เช็ก → .attendance-box "📋 มีการเช็กชื่อวิชาคณิตศาสตร์ (ครูสมศรี)" + ปุ่ม .btn.primary "เปิดตัวสแกน QR" + .btn.secondary "กรอกรหัส"
     · ไม่มี → "ยังไม่มีการเช็กชื่อตอนนี้" แต่ปุ่มสแกนและกรอกรหัสยังใช้ได้
     · .notice "ระบบจะยืนยันตัวตนผ่าน LINE ก่อนบันทึกข้อมูล"
   - .two-col ขวา: panel "ประวัติการเข้าเรียน" รายการ .task 30 รอบล่าสุด ("10 พ.ย. · คณิตศาสตร์", เวลา,
     pill มาเรียน .done / มาสาย .late / ขาด .absent / ลา .leave)
   - ด้านล่าง: สรุปรายวิชา มา / สาย / ขาด / ลากิจ / ลาป่วย และ % เวลาเรียน (แดง + คำเตือนถ้าต่ำกว่า 80%)
6. เพิ่ม op ใน api/student.js (requireRole student)
   - POST ?op=checkin { sessionId?, code } → ดูขั้นตอนข้อ 7
   - GET  ?op=attendance-open → รอบที่เปิดอยู่ของห้องตัวเองที่ยังไม่ได้เช็ก [{ id, subject, title, teacherName }]
   - GET  ?op=attendance → สรุปรายวิชา + รายการรอบล่าสุด (คิดเฉพาะรอบที่ปิดแล้วในการคำนวณ %)
7. lib/services/attendance.js — checkIn(student, { sessionId, code }, now) ตามลำดับ:
   a. rate limit kind 'checkin': ผิดเกิน 10 ครั้งใน 10 นาที → 429
   b. zod: code ต้องเป็นตัวเลข 6 หลัก, sessionId ต้องเป็น uuid (ถ้ามี)
   c. มี sessionId → โหลดรอบนั้น: ไม่พบหรือ classroom ไม่ตรงกับนักเรียน → 404, ปิดแล้ว → 409
      ไม่มี sessionId → โหลดรอบ open ทั้งหมดของห้องนักเรียน แล้วหารอบที่รหัสตรง
   d. เลย starts_at + 3 ชั่วโมง → 409 "รอบเช็กชื่อนี้หมดเวลาแล้ว"
   e. verifyCode ไม่ผ่าน → บันทึก attempt ไม่สำเร็จ → 400 "QR หมดอายุหรือรหัสไม่ถูกต้อง"
   f. status = เวลาปัจจุบัน > starts_at + late_after_minutes ? 'late' : 'present', method = 'qr' หรือ 'code'
   g. insert ด้วย upsert(onConflict: 'session_id,student_id', ignoreDuplicates: true)
      ถ้าไม่มีแถวถูกเพิ่ม → อ่านแถวเดิมแล้วตอบ { alreadyChecked: true, status } (ห้ามทับสถานะที่ครูตั้งไว้ เช่น ลา)
   h. ตอบ { status, checkedAt, subject, teacherName }
8. Tests (Vitest): checkIn ทุกกรณีในข้อ 7 (สำเร็จ/สาย/รหัสหมดอายุ/ห้องไม่ตรง/รอบปิด/เช็กซ้ำ/เกิน rate limit/กรอกรหัสไม่มี sessionId),
   parseCheckinValue รับ URL ถูกและปฏิเสธ URL อื่น

ข้อห้าม/ข้อระวัง:
*** เวลาที่ใช้ตัดสิน มา/สาย และอายุรหัส ใช้เวลา server เท่านั้น ห้ามรับเวลาจากมือถือ ***
*** ห้ามรับ student_id จากหน้าเว็บ — ใช้จาก requireRole ***
*** ห้ามบอกนักเรียนว่ารหัสที่ถูกต้องคืออะไร หรือมีรอบของห้องอื่นอยู่ ***
*** liff.scanCodeV2 ต้องเปิด "Scan QR" ใน LIFF settings ของ LINE Developers Console (บอกผมวิธีเปิด) ***
*** หน้า checkin ต้องทำงานได้แม้เปิดครั้งแรกแบบยังไม่มี session cookie ***

Test criteria (ครู T001 เปิดรอบห้อง ม.2/1 ในหน้าต่างปกติ, นักเรียนใน Incognito ด้วย mockUser):
- copy ลิงก์ checkinUrl (โหมด dev) จากจอครู ไปเปิดใน Incognito ของนักเรียน ม.2/1 → "เช็กชื่อแล้ว — มาเรียน" และจอครูนับเพิ่ม 1
- เปิดลิงก์เดิมซ้ำ → "คุณเช็กชื่อรอบนี้แล้ว"
- รอ 70 วินาทีแล้วใช้ลิงก์เก่ากับนักเรียนอีกคน → "QR หมดอายุแล้ว"
- นักเรียนห้อง ม.2/2 ใช้ลิงก์ของ ม.2/1 → "ไม่พบรอบเช็กชื่อนี้ในห้องของคุณ"
- กรอกรหัส 6 หลักจากจอครูในหน้า /student/attendance → เช็กชื่อสำเร็จ
- กรณีมาสายตรวจด้วย unit test ที่กำหนดเวลาเอง (ไม่ต้องรอจริง) → ได้สถานะ late
- กรอกรหัสผิด 11 ครั้ง → 429
- หน้า /student/attendance แสดงข้อมูลถูกต้อง
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-4.2: student QR check-in and attendance history"
4. สรุปสิ่งที่ทำ และบอกว่าต้องทดสอบอะไรเพิ่มบนมือถือจริงหลัง deploy
```

**✅ Test criteria:**
- [ ] เช็กชื่อผ่านลิงก์ QR ได้ และจอครูนับเพิ่ม
- [ ] เช็กซ้ำ / QR หมดอายุ / ผิดห้อง ถูกปฏิเสธพร้อมข้อความไทย
- [ ] กรอกรหัส 6 หลักได้
- [ ] หน้าประวัติการมาเรียนถูกต้อง

**⚠️ Gotcha:**
- การสแกนด้วยกล้อง LINE จริงและปุ่ม `scanCodeV2` ทดสอบได้หลัง deploy เท่านั้น (Prompt 5.2) เพราะ QR จริงชี้ไปที่ `miniapp.line.me`
- นาฬิกามือถือของครูหรือนักเรียนตั้งผิดไม่มีผล เพราะระบบใช้เวลาของ server

---

### Prompt 4.3 — ครู: แก้สถานะรายคน + ปิดรอบ + รายงานเปอร์เซ็นต์การมาเรียน

> **Dependencies:** ต่อจาก Prompt 4.2
> **ไฟล์ที่สร้าง:** ~8 ไฟล์
> **Git commit:** `phase-4.3: attendance management, closing and reports`

```text
ต่อจาก Prompt 4.2 (นักเรียนเช็กชื่อได้แล้ว)

งาน: ครูดูรายชื่อทั้งห้องของรอบเช็กชื่อ แก้สถานะเอง (ลา/ป่วย/ขาด/สาย) ปิดรอบ และดูรายงานการมาเรียนรายห้อง/รายวิชา

สิ่งที่ต้องสร้าง:
1. public/teacher/attendance/session.html?id=... + js/pages/teacher-attendance-session.js
   - หัว: วิชา ห้อง วันที่ เวลาเริ่ม "สายหลัง X นาที" สถานะรอบ ปุ่ม "เปิดจอ QR" (เฉพาะรอบที่เปิด)
   - ชิปสรุป (กดเพื่อกรอง): มา / สาย / ขาด / ลากิจ / ลาป่วย / ยังไม่เช็ก
   - รายชื่อเรียงตามเลขที่: เลขที่ ชื่อ ป้ายสถานะ เวลาเช็ก วิธีเช็ก (QR / รหัส / ครูบันทึก / อัตโนมัติ)
   - แตะที่ชื่อ → bottom sheet ปุ่มใหญ่ 5 ปุ่ม (มา / สาย / ขาด / ลากิจ / ลาป่วย) + หมายเหตุ ≤ 100 ตัว
   - โหมดเลือกหลายคน + "ตั้งสถานะ (N คน)"
   - ปุ่ม "คัดลอกสรุป" → "ม.2/1 คณิตศาสตร์ 9 พ.ย. 69 คาบ 3 — มา 28 สาย 2 | ขาด: เลขที่ 4 สมชาย, ... | ลา: เลขที่ 9 ..."
   - ปุ่ม "ปิดรอบเช็กชื่อ" (ยืนยันก่อน: "นักเรียนที่ยังไม่เช็ก N คนจะถูกบันทึกว่าขาด")
   - หลังปิดรอบยังแก้สถานะรายคนได้ (เผื่อนักเรียนมาแจ้งลาทีหลัง)
2. หน้าจอ QR (live) — ปุ่ม "จัดการรายชื่อ" ไปหน้า session และปุ่ม "ปิดรอบ" ทำงานจริง
3. เพิ่ม op ใน api/teacher.js (requireRole teacher + ตรวจความเป็นเจ้าของรอบ)
   - GET  ?op=attendance-session&id=... → { session, rows: [{ student: {id, number, prefix, first_name, last_name}, record | null }], summary }
   - POST ?op=mark-attendance&id=... { studentIds: string[] (1–60), status, note? }
     → upsert onConflict (session_id, student_id) ทับได้, method = 'manual', marked_by = ครู
     → studentIds ทุกคนต้องเป็นนักเรียน active ในห้องของรอบ ไม่งั้น 400
   - POST ?op=close-attendance&id=... → status = closed, closed_at = now()
     แล้ว insert 'absent' (method 'auto') ให้นักเรียน active ที่ยังไม่มีแถว ด้วย upsert ignoreDuplicates ครั้งเดียว
     รอบปิดแล้ว → 409
   - GET  ?op=attendance-report&room=...&subject=...&from=YYYY-MM-DD&to=YYYY-MM-DD
     → เฉพาะรอบของครูคนนี้ที่ปิดแล้ว, query ไม่เกิน 3 ครั้ง (นักเรียน, รอบ, records ด้วย .in())
     → { students, sessions, cells: { [studentId]: { [sessionId]: status } }, totals: { [studentId]: { present, late, absent, leave, sick, percent } } }
4. lib/services/attendance.js (เพิ่ม) — คำนวณสรุปและ % เป็น pure function
   - percent = (present + late) / จำนวนรอบที่ปิดแล้ว × 100 ปัดทศนิยม 1 ตำแหน่ง
   - ประกาศค่าคงที่ ATTENDANCE_MIN_PERCENT = 80 และ COUNT_LEAVE_AS_PRESENT = false ไว้บนสุดของไฟล์
     พร้อม comment ภาษาไทยว่าแต่ละโรงเรียนนับต่างกัน แก้ค่าตรงนี้ได้
5. lib/time.js (เพิ่ม) — thaiDayRange("2026-11-09") → [เริ่มวัน, เริ่มวันถัดไป) ตามเวลาไทย สำหรับกรองช่วงวันที่
6. public/teacher/attendance/report.html?room=&subject=&from=&to= + js/pages/teacher-attendance-report.js
   - ตัวกรอง: ห้อง, วิชา, ช่วงวันที่ (ค่าเริ่มต้น 30 วันล่าสุด) — เก็บใน URL ด้วย history.replaceState
   - ตาราง: แถว = นักเรียน (คอลัมน์ชื่อ sticky), คอลัมน์ = รอบเช็กชื่อ (วันที่สั้นๆ), ช่อง: ✓ มา, ส สาย, ข ขาด, ล ลากิจ, ป ลาป่วย (มีสีตามสถานะ)
   - คอลัมน์ท้าย: มา / สาย / ขาด / ลา / % — แถวที่ต่ำกว่า 80% พื้นแดงอ่อน + ป้าย "เสี่ยง มส."
   - ปุ่มเรียง: ตามเลขที่ / % น้อยสุดก่อน
   - ปุ่ม "คัดลอกรายชื่อที่ต่ำกว่า 80%"
   - legend อธิบายสัญลักษณ์ และบอกว่า "ลาไม่นับเป็นเวลาเรียน" (ตามค่าคงที่)
   - ลิงก์ "รายงาน" จากหน้า /teacher/attendance
7. Tests (Vitest): close-attendance เพิ่ม absent เฉพาะคนที่ยังไม่เช็ก และไม่ทับ ลา ที่ครูตั้งไว้,
   mark-attendance ทับสถานะที่นักเรียนเช็กเองได้, คำนวณ % ถูก (รวมกรณีไม่มีรอบเลย → ไม่หารศูนย์),
   นักเรียนนอกห้อง → 400, ครูคนอื่น → 404, thaiDayRange ข้ามเที่ยงคืนถูก

ข้อห้าม/ข้อระวัง:
*** ห้าม insert absent ทีละคนใน loop — ใช้ upsert ครั้งเดียว ***
*** ปิดรอบต้องใช้ ignoreDuplicates เพื่อไม่ทับสถานะที่มีอยู่ ***
*** รายงานนับเฉพาะรอบที่ปิดแล้ว (รอบที่ยังเปิดยังไม่ครบ) ***
*** แสดงชื่อนักเรียนและหมายเหตุด้วย textContent ***

Test criteria:
- เปิดรอบ → นักเรียน 2 คนเช็กชื่อ → หน้า session เห็น "มา 2, ยังไม่เช็ก 2"
- ตั้งนักเรียนคนที่ 3 เป็น "ลาป่วย" → ปิดรอบ → คนที่ 4 เป็น "ขาด" (อัตโนมัติ) และคนที่ 3 ยังเป็น "ลาป่วย"
- หลังปิดรอบ แก้คนที่ 4 เป็น "ลากิจ" ได้
- คัดลอกสรุปได้ข้อความถูกต้อง
- หน้ารายงานแสดงรอบที่ปิดแล้ว, % ถูก, คนต่ำกว่า 80% เป็นสีแดง
- ครู T002 เปิด session ของ T001 → "ไม่พบรอบเช็กชื่อ"
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-4.3: attendance management, closing and reports"
4. สรุปสิ่งที่ทำ
```

**✅ Test criteria:**
- [ ] ครูแก้สถานะรายคน/หลายคนได้
- [ ] ปิดรอบแล้วคนที่ไม่เช็กเป็น "ขาด" โดยไม่ทับ "ลา"
- [ ] รายงาน % ถูกต้อง เห็นคนเสี่ยง มส.

**⚠️ Gotcha:**
- ถ้าโรงเรียนนับ "ลา" เป็นเวลาเรียน ให้บอก Claude Code แก้ `COUNT_LEAVE_AS_PRESENT = true` ใน `lib/services/attendance.js`
- รอบที่ครูลืมปิดจะไม่ถูกนับในรายงาน หน้า `/teacher/attendance` จะแสดงรอบที่ค้างเปิดให้เห็น

---

### Prompt 4.4 — หน้าหลัก (Dashboard) + รายงาน + โปรไฟล์ ตาม prototype

> **Dependencies:** ต่อจาก Prompt 4.3
> **ไฟล์ที่สร้าง/แก้:** ~12 ไฟล์
> **Git commit:** `phase-4.4: dashboards, reports and profile pages per UX prototype`

```text
ต่อจาก Prompt 4.3 (ระบบงานและเช็กชื่อครบแล้ว)
เปิด design/prototype.html ในเบราว์เซอร์ดูก่อน — กดสลับ "นักเรียน" / "ครู" และทุกเมนูด้านล่าง

งาน: ทำหน้าที่ยังเป็น placeholder ให้ครบตาม prototype: หน้าหลักครู/นักเรียน, หน้ารายงาน และหน้าโปรไฟล์

1. API (เลือก field เอง, query ไม่เกิน 4 ครั้งต่อ op, ใช้ view assignment_progress)
   - GET /api/student?op=dashboard → {
       student: { firstName, classroom, number },
       taskStats: { total, approved, pending (not_submitted + revise), submitted, overdue },
       topTasks: 3 งานที่ต้องทำ (เลยกำหนดก่อน แล้ววันส่งใกล้สุด),
       openAttendance: รอบที่เปิดอยู่และยังไม่เช็ก, checkedToday: [{ subject, status, checkedAt }] }
   - GET /api/teacher?op=dashboard → {
       teacher: { name },
       todaySession: รอบล่าสุดของวันนี้ (ถ้ามี) + counts { total, present, late, notYet } + isOpen,
       workStats: { openAssignments, toReview (จำนวน submitted), overdueAssignments, classrooms },
       recentAssignments: 3 งานล่าสุด พร้อม progress }
   - "วันนี้" ตัดตามเวลาไทยด้วย thaiDayRange
   - lib/services/dashboard.js เป็น pure function คำนวณจากข้อมูลที่ดึงมา (test ง่าย)
2. public/student/index.html + js/pages/student-home.js (แทน placeholder) — homeView ฝั่งนักเรียนใน prototype
   - .welcome: "สวัสดี <ชื่อ> 👋" + "ดูงานที่ได้รับมอบหมายและเช็กชื่อเข้าเรียนได้ที่นี่" + ป้าย .date "📅 วันนี้ · วันจันทร์ 10 พ.ย." (Intl, Asia/Bangkok)
   - .stats 4 ช่อง: งานทั้งหมด (.green) / ส่งแล้ว / รอส่ง (.purple) / รอตรวจ
   - .grid ซ้าย: panel "งานที่ต้องทำ" 3 รายการ + "ดูทั้งหมด →" (/student/tasks)
     pill: ใกล้ถึงกำหนด ≤ 2 วัน (.todo), ยังไม่ส่ง (.todo), เลยกำหนด (.late), ให้แก้ไข (.revise)
   - .grid ขวา: panel "เช็กชื่อเข้าเรียน" (.attendance-box)
     · มีรอบเปิดที่ยังไม่เช็ก → "มีการเช็กชื่อวิชา X" + ปุ่ม "สแกน QR Code" + "กรอกรหัส" (ใช้ checkin.js)
     · เช็กแล้ววันนี้ → "เช็กชื่อแล้ว ✓ X · 08:32 น." + pill สถานะ
     · ไม่มี → "พร้อมเช็กชื่อหรือยัง?" + "สแกน QR Code ที่ครูแสดงหน้าชั้นเรียน เพื่อบันทึกเวลาเข้าเรียน" + ปุ่มสแกน
     · ใต้กล่อง: "ระบบจะยืนยันตัวตนผ่าน LINE ก่อนบันทึกข้อมูล"
   - "ความคืบหน้าของฉัน": "ส่งงานแล้ว X จาก Y งาน" + % + .progress (role="progressbar" aria-valuenow)
     ข้อความใต้แถบ: ≥ 80% "ทำได้ดีมาก! อย่าลืมส่งงานที่เหลือก่อนกำหนด", 50–79% "อีกนิดเดียว ส่งงานที่ค้างให้ครบนะ",
     < 50% "มีงานค้างหลายชิ้น ลองเริ่มจากงานที่ใกล้ถึงกำหนดก่อน" · ไม่มีงานเลย → ซ่อนแถบ
3. public/teacher/index.html + js/pages/teacher-home.js (แทน placeholder) — homeView ฝั่งครูใน prototype
   - .welcome: "สวัสดีคุณครู<ชื่อ> 👋" + "จัดการงาน เช็กชื่อ และติดตามนักเรียนในห้องเรียน" + ป้ายวันที่
   - .stats:
     · วันนี้มีรอบเช็กชื่อ → นักเรียนทั้งหมด (.green) / มาเรียน / มาสาย (.purple) / ยังไม่เช็กชื่อ + ข้อความเล็ก "ม.2/1 · คณิตศาสตร์"
     · ไม่มี → งานเปิดรับ (.green) / รอตรวจ / งานเลยกำหนด (.purple) / ห้องที่สอน
   - .grid ซ้าย: panel "งานที่มอบหมายล่าสุด" 3 รายการ + "จัดการงานทั้งหมด →" (/teacher/assignments)
     + .actions: .btn.primary "＋ สร้างงานใหม่" (/teacher/new) และ .btn.secondary "ตรวจงานที่รอตรวจ" (/teacher/assignments?filter=review)
   - .grid ขวา: panel "เช็กชื่อเข้าเรียน"
     · มีรอบเปิด → "กำลังเช็กชื่อ ม.2/1 · คณิตศาสตร์" + ปุ่ม "เปิดจอ QR" + "จัดการรายชื่อ"
     · ไม่มี → "เริ่มเช็กชื่อในคาบเรียน" + "สร้าง QR Code ให้กับนักเรียนในห้องสแกน" + ปุ่ม "สร้าง QR Code" (/teacher/attendance/?new=1)
   - ความคืบหน้า: มีรอบวันนี้ → "นักเรียนเช็กชื่อแล้ว X จาก Y คน" · ไม่มี → "ตรวจงานแล้ว X จาก Y ชิ้นที่ส่งมา"
4. หน้า /teacher/assignments (แก้): รองรับ ?filter=review แสดงเฉพาะงานที่มีคนรอตรวจ (ปุ่มตัวกรอง "รอตรวจ" เพิ่มใน .toolbar)
5. public/student/reports.html + js/pages/student-reports.js — reportsView ใน prototype
   - .stats: อัตราการเข้าเรียน % (.green) / งานที่ส่งแล้ว / งานส่งช้า (.purple) / งานค้าง
     (prototype มี "คะแนนเฉลี่ย" แต่ระบบยังไม่มีคะแนน จึงใช้ "งานส่งช้า" แทน)
   - panel "สรุปการเข้าเรียน": แถบ % มาเรียน (เขียว) / มาสาย (#e3a52d) / ขาดเรียน (--red) / ลา (เทา)
   - ตารางรายวิชา (.table-wrap): วิชา | มา | สาย | ขาด | ลา | % (แดงถ้า < 80%)
   - ใช้ op dashboard + attendance ที่มีอยู่ ไม่เพิ่ม op
6. public/teacher/reports.html + js/pages/teacher-reports.js
   - panel ลิงก์ 2 อัน: "ภาพรวมการส่งงานรายห้อง" → /teacher/overview และ "รายงานการเข้าเรียน (% เวลาเรียน)" → /teacher/attendance/report
     แต่ละอันมีคำอธิบาย 1 บรรทัด
   - ส่วนล่าง: ตาราง "รายชื่อเข้าเรียน" ของรอบล่าสุดวันนี้ (แบบ teacherRoster ใน prototype: นักเรียน | เวลา | สถานะ) ถ้ามี
7. public/profile.html + js/pages/profile.js (ใช้ทั้งครูและนักเรียน) — profileView ใน prototype
   - รูปโปรไฟล์ LINE วงกลม 58px (ไม่มีรูปใช้ 👤), ชื่อ, "นักเรียน · ม.2/1 เลขที่ 5" หรือ "ครูผู้สอน · <วิชาที่สอน>"
   - .field disabled: "บัญชี LINE" = "เชื่อมต่อ LINE แล้ว (<displayName>)", "ห้องเรียน" (นักเรียน) หรือ "ห้องที่สอน" (ครู)
   - .btn.ghost "วิธีใช้งาน / ติดต่อครู" → bottom sheet: วิธีเช็กชื่อ 3 ทาง, วิธีแจ้งส่งงาน, "เปลี่ยนมือถือหรือบัญชี LINE ให้แจ้งครูประจำชั้น"
   - ปุ่ม "ปิดแอป" (closeApp) แสดงเมื่ออยู่ใน LINE
   - GET /api/auth?op=me เพิ่ม field ที่หน้านี้ใช้ (ห้ามมี verify_code, reg_code, line_user_id)
8. ลบหน้า placeholder ที่ไม่ได้ใช้แล้ว และตรวจทุกหน้าว่ามี header.js + nav.js และเมนูที่ active ถูกต้อง
9. Tests (Vitest): dashboard service (นับ stats ถูก, topTasks เรียงถูก, "ใกล้ถึงกำหนด" ≤ 2 วันตามเวลาไทย),
   teacher dashboard กรณีมี/ไม่มีรอบวันนี้, นักเรียนเรียก op dashboard ของครู → 403

ข้อห้าม/ข้อระวัง:
*** ทำหน้าตาตาม design/prototype.html แต่ห้าม copy JavaScript ของ prototype (innerHTML, ข้อมูลจำลอง, role switch) ***
*** ไม่มีปุ่มสลับบทบาท "นักเรียน/ครู" แบบใน prototype — role มาจากฐานข้อมูลเท่านั้น ***
*** prototype เป็นหน้าเดียวสลับ view แต่แอปจริงเป็นหลายหน้า (1 เมนู = 1 ไฟล์ HTML) ตามโครงใน CLAUDE.md ***
*** ห้าม query ใน loop — หน้าหลักต้องโหลดเร็ว ***

Test criteria:
- เปิด prototype กับแอปจริงคู่กันที่ความกว้าง 375px และ 1024px → layout, สี, การ์ด, เมนูล่าง ดูเป็นชุดเดียวกัน
- นักเรียน: ตัวเลขบนหน้าหลักตรงกับหน้า "งานของฉัน", กด "ดูทั้งหมด →" ไปหน้างาน, กล่องเช็กชื่อเปลี่ยนตามสถานะ (มีรอบ/เช็กแล้ว/ไม่มี)
- ครู: ไม่มีรอบวันนี้ → เห็นสถิติงาน · เปิดรอบแล้ว → เห็นสถิติเช็กชื่อและปุ่ม "เปิดจอ QR"
- ปุ่ม "ตรวจงานที่รอตรวจ" → เห็นเฉพาะงานที่มีคนรอตรวจ
- หน้ารายงานนักเรียน % ตรงกับหน้าเช็กชื่อ · หน้ารายงานครูลิงก์ไปถูกหน้า
- หน้าโปรไฟล์แสดงข้อมูลถูก และ response ของ me ไม่มีรหัสลับ
- ไม่มีหน้า placeholder "กำลังพัฒนา" เหลืออยู่
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-4.4: dashboards, reports and profile pages per UX prototype"
4. สรุปสิ่งที่ทำ และบอกจุดที่หน้าตายังต่างจาก prototype (ถ้ามี) พร้อมเหตุผล
```

**✅ Test criteria:**
- [ ] หน้าหลักครู/นักเรียนเหมือน prototype และใช้ข้อมูลจริง
- [ ] เมนูล่างทั้ง 5 เมนูไปหน้าจริงครบ ไม่มี placeholder
- [ ] หน้ารายงานและโปรไฟล์ทำงาน

**⚠️ Gotcha:**
- ถ้าอยากให้หน้าตาต่างจาก prototype ตรงไหน ให้แก้ `design/prototype.html` ก่อนแล้วบอก Claude Code ให้ทำตาม จะได้มีต้นแบบเดียว

---

## Phase 5 — Polish & Deploy

### Prompt 5.1 — ปรับ UI + ความปลอดภัย + ตรวจทั้งระบบ

> **Dependencies:** ต่อจาก Prompt 4.4
> **ไฟล์ที่สร้าง/แก้:** ~12 ไฟล์
> **Git commit:** `phase-5.1: UI polish, security hardening and full review`

```text
ต่อจาก Prompt 4.4 (ฟีเจอร์และทุกหน้าครบแล้ว)

งาน: ทำให้แอปพร้อมใช้จริง — หน้าตาสม่ำเสมอบนมือถือ, error ชัดเจน, ปลอดภัย และตรวจทุก API

1. เปิดทุกหน้าเทียบกับ design/prototype.html ที่ 375px และ 1024px — สี ระยะ มุมโค้ง ปุ่ม pill ต้องตรงกัน
   ทุกหน้าใช้ class จาก style.css ไม่มี style เขียนซ้ำในหน้า
   - ปุ่มสูง ≥ 44px, font-size ≥ 16px ในช่องกรอก (กัน iOS zoom)
   - accessibility แบบ prototype: skip link, :focus-visible outline, aria-current ที่เมนู, role="progressbar" + aria-valuenow,
     toast aria-live, prefers-reduced-motion, ปุ่มไอคอนต้องมีข้อความหรือ aria-label
   - padding-bottom: env(safe-area-inset-bottom) สำหรับ bottom navigation
   - ทดสอบที่ 360px และ 414px
2. ทุกหน้ามี skeleton ระหว่างโหลด, empty state, error state พร้อมปุ่ม "ลองใหม่"
3. ปุ่ม "รีเฟรช" ในหน้ารายการ (ครู/นักเรียน) และรีเฟรชอัตโนมัติเมื่อกลับมาที่หน้า (visibilitychange)
4. public/js/api.js: 401 → พากลับหน้าแรกเพื่อ login ใหม่, ไม่มีอินเทอร์เน็ต → toast "ไม่มีการเชื่อมต่ออินเทอร์เน็ต"
5. lib/http.js withApi:
   - ZodError → 400 พร้อมข้อความแรกที่อ่านเข้าใจ, HttpError → status ของมัน, อื่นๆ → 500 "เกิดข้อผิดพลาด กรุณาลองใหม่"
   - console.error เฉพาะข้อมูลที่จำเป็น (ห้าม log token, cookie, verify_code, reg_code)
   - POST ต้องมี header Origin ตรงกับ host ของแอป ไม่งั้น 403 (ถ้าไม่มี Origin ให้เช็ก Referer แทน)
6. vercel.json headers สำหรับทุก path: X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin,
   Permissions-Policy: camera=(self), microphone=(), geolocation=()  ← camera ต้องเปิดให้ self เพราะ liff.scanCodeV2 ใช้กล้องผ่านเบราว์เซอร์
   และ Content-Security-Policy ที่อนุญาตเฉพาะ: self, static.line-scdn.net (ฟอนต์เป็น system-ui ไม่ต้องอนุญาต Google Fonts),
   img-src ต้องมี data: (รูป QR เช็กชื่อ) และรูปโปรไฟล์จาก profile.line-scdn.net / obs.line-scdn.net,
   connect-src self + api.line.me + LINE domains ที่ LIFF ต้องใช้
   (ตรวจรายชื่อ domain ที่ LIFF SDK ต้องใช้จากเอกสาร LINE, ห้ามใส่ 'unsafe-inline' สำหรับ script)
7. ย้าย inline script/style ที่เหลือใน HTML ออกไปไฟล์ .js/.css ทั้งหมด (ให้ CSP ทำงานได้)
8. ตรวจทั้งโปรเจกต์แล้วทำตารางสรุป: api file | op | method | ต้อง login? | role | ตรวจความเป็นเจ้าของ/ห้อง? | zod?
   ตัวไหนไม่ผ่าน แก้ทันที
9. grep หา innerHTML / insertAdjacentHTML / outerHTML ทั้งโปรเจกต์ — ถ้ามีกับข้อมูลที่ไม่ใช่ค่าคงที่ ให้แก้เป็น dom.js
10. Tests เพิ่ม: เรียก op ของครูด้วยนักเรียน → 403 และกลับกัน (อย่างน้อย 1 op ต่อไฟล์), POST ไม่มี Origin/Origin ผิด → 403
11. public/404.html ภาษาไทย พร้อมปุ่มกลับหน้าหลัก

ข้อห้าม/ข้อระวัง:
*** ห้ามแก้ schema ฐานข้อมูลใน prompt นี้ ***
*** อย่าลบ test เดิมเพื่อให้ผ่าน ถ้า test เดิมพังให้แก้โค้ด ***
*** หลังใส่ CSP ต้องทดสอบหน้าแรก (LIFF init) ใหม่ทุกครั้ง ถ้า console มี error เรื่อง CSP ให้แก้รายชื่อ domain ***

Test criteria:
- ทุกหน้าใช้งานได้ดีที่ 360px (DevTools โหมดมือถือ)
- ปิด Wi-Fi แล้วกดปุ่ม → toast error ภาษาไทย ไม่ใช่หน้าค้าง
- curl -X POST "http://localhost:3000/api/link?op=student" -H "Origin: https://evil.example" → 403
- Console ของเบราว์เซอร์ไม่มี error เรื่อง CSP
- ตารางตรวจ API ครบทุก op และผ่านทั้งหมด
- npm test ผ่าน

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-5.1: UI polish, security hardening and full review"
4. สรุปสิ่งที่ทำ พร้อมตารางตรวจ API
```

**✅ Test criteria:**
- [ ] UI สม่ำเสมอทุกหน้าบนมือถือ
- [ ] error แสดงเป็นภาษาไทย
- [ ] ไม่มี innerHTML กับข้อมูลผู้ใช้
- [ ] ตารางตรวจ API ผ่านทุก op

**⚠️ Gotcha:**
- CSP ที่เข้มเกินไปทำให้ LIFF ใช้ไม่ได้ในแอป LINE จริง ต้องทดสอบซ้ำบนมือถือใน Prompt 5.2 ด้วย

---

### Prompt 5.2 — Deploy Vercel + ตั้งค่า LINE Mini App + Rich Menu

> **Dependencies:** ต่อจาก Prompt 5.1 — ต้องมีบัญชี GitHub
> **ไฟล์ที่สร้าง/แก้:** ~4 ไฟล์
> **Git commit:** `phase-5.2: production deployment on Vercel with LINE Mini App`

```text
ต่อจาก Prompt 5.1 (แอปพร้อมใช้แล้ว test ผ่านทั้งหมด)

งาน: นำแอปขึ้น Vercel และเปิดใช้จริงผ่าน LINE OA
ผมไม่เคย deploy มาก่อน ให้พาทำทีละขั้น ขั้นไหนต้องกดเองบนเว็บให้บอกชัดๆ ว่ากดตรงไหน แล้วรอผมตอบว่าเสร็จก่อนไปขั้นถัดไป

สิ่งที่ Claude Code ทำเอง:
1. scripts/check-env.js + script "check:env" — ตรวจว่าตัวแปรครบและรูปแบบถูก (SUPABASE_URL เป็น https, SESSION_SECRET ยาวพอ,
   LIFF_ID ใน config.js ไม่ว่าง และตรงกับ env LIFF_ID ฝั่ง server)
2. ตรวจซ้ำ: DEV_MOCK_LOGIN ไม่มีผลบน production, ไม่มี console.log ข้อมูลลับ, ไม่มี secret key ใน public/
   (grep หา "sb_secret" และ "service_role" ใน public/)
3. สร้าง DEPLOY.md สรุปขั้นตอน deploy และรายการ env ที่ต้องตั้งบน Vercel (ไม่ใส่ค่าจริง)

ขั้นตอนที่พาผมทำ (ทีละขั้น):
A. สร้าง GitHub repository แบบ Private แล้ว push (ถ้ามี gh CLI ให้ใช้ ถ้าไม่มีบอกวิธีทำบนเว็บ)
   *** ก่อน push ตรวจด้วย git ls-files ว่าไม่มี .env* (ยกเว้น .env.example) และไม่มี .vercel ***
B. Vercel → โปรเจกต์ที่ link ไว้ตั้งแต่ Prompt 1.1 → Settings → Git → เชื่อม repo
   → Settings → Environment Variables ใส่ SUPABASE_URL, SUPABASE_SECRET_KEY, SESSION_SECRET (ค่าใหม่ ไม่ใช้ค่าเดียวกับ dev),
     LINE_CHANNEL_ID, LIFF_ID — ห้ามใส่ DEV_MOCK_LOGIN
C. Deploy → เปิด https://<project>.vercel.app/api/health ต้องได้ ok: true
D. LINE Developers Console → LINE MINI App channel → ตั้ง Endpoint URL = https://<project>.vercel.app
   ตรวจ scope openid + profile, เปิด "Scan QR" (ให้ปุ่มสแกนเช็กชื่อใช้ได้),
   ตรวจว่า LIFF ID ใน public/js/config.js และ env LIFF_ID ตรงกับ channel (ถ้าเปลี่ยน ต้อง commit + push และ redeploy)
E. ทดสอบบนมือถือ: เปิด https://miniapp.line.me/<LIFF_ID> ใน LINE → ผูกบัญชีครู → สร้างงาน
   → ใช้บัญชี LINE อีกบัญชีผูกเป็นนักเรียน → แจ้งส่ง → ครูยืนยัน
   → ทดสอบเช็กชื่อ: ครูเปิดรอบบนคอม/แท็บเล็ต (เปิด Mini App URL ในเบราว์เซอร์แล้ว login LINE) → นักเรียนสแกน QR ด้วยกล้อง LINE
     และด้วยปุ่ม "สแกนเช็กชื่อ" ในแอป → จอครูนับเพิ่ม → ปิดรอบ
F. LINE Official Account Manager → Rich menu → ปุ่ม "ติดตามงาน" แบบ Link ไปที่ https://miniapp.line.me/<LIFF_ID>
G. ก่อนใช้จริง: รัน supabase/remove-seed.sql, นำเข้ารายชื่อครู/นักเรียนจริง (Table Editor → Insert → Import data from CSV),
   แล้วรัน supabase/generate-codes.sql เพื่อสุ่มรหัส — ให้ Claude Code เตรียมไฟล์ตัวอย่าง templates/students.csv และ templates/teachers.csv
   ที่มีหัวคอลัมน์ถูกต้อง

ข้อห้าม/ข้อระวัง:
*** ห้าม commit หรือ push .env.local ***
*** หน้าจอ LINE Developers Console และ Supabase อาจเปลี่ยนจากที่คุณรู้ ถ้าไม่แน่ใจให้บอกผมว่าควรหาเมนูชื่ออะไร
    และอ้างอิงเอกสาร https://developers.line.biz/en/docs/line-mini-app/ ***
*** ห้ามรัน vercel --prod หรือ git push โดยไม่ถามผมก่อน ***

Test criteria:
- https://<project>.vercel.app/api/health → ok: true
- เปิด Mini App จาก Rich Menu ใน LINE ได้ ผูกบัญชีได้
- ครบวงจร ครูสร้างงาน → นักเรียนแจ้งส่ง → ครูยืนยัน บนมือถือจริง
- สแกน QR เช็กชื่อด้วยกล้อง LINE และปุ่มในแอปได้ทั้ง iOS และ Android (ถ้ามีให้ทดสอบ)
- เปิด https://<project>.vercel.app/?mockUser=x ต้อง login ด้วย mock ไม่ได้
- เปิด https://<project>.vercel.app/lib/env.js และ /supabase/seed.sql ต้อง 404

เมื่อทำทุกอย่างเสร็จและ test ผ่าน:
1. git add .
2. ตรวจว่า .env.local ไม่อยู่ใน staged files
3. git commit -m "phase-5.2: production deployment on Vercel with LINE Mini App"
4. ถามผมก่อน push แล้วสรุปลิงก์ทั้งหมด (Vercel URL, Mini App URL, Supabase Dashboard)
```

**✅ Test criteria:**
- [ ] `/api/health` บน Vercel ผ่าน
- [ ] เปิดจาก Rich Menu ได้
- [ ] ทดสอบครบวงจรบนมือถือจริง
- [ ] mock ใช้ไม่ได้ และไฟล์ฝั่ง server เปิดจากเว็บไม่ได้

**⚠️ Gotcha:**
- แก้ Environment Variables บน Vercel แล้วต้องกด **Redeploy** ค่าใหม่ถึงจะมีผล
- ถ้าเปิดใน LINE แล้วหน้าขาว ให้เปิดลิงก์เดียวกันใน Chrome บนคอมแล้วดู Console มักเป็นเรื่อง CSP หรือ LIFF ID ผิด

---

## ไอเดียต่อยอด (หลังเวอร์ชันแรกใช้งานได้)

เขียน prompt ใหม่ตามรูปแบบเดิม (Prompt 6.x) เมื่อพร้อม:
- **6.1 แจ้งเตือนผ่าน LINE** — Messaging API push แจ้งงานใหม่ + Vercel Cron เตือนก่อนครบกำหนด 1 วัน (ระวังโควตาข้อความฟรีของ OA)
- **6.2 แนบไฟล์/รูปงาน** — Supabase Storage (bucket แบบ private + signed URL) เก็บ path ใน submissions
- **6.3 ให้คะแนน + Dashboard** — เพิ่มคอลัมน์ max_score / score และหน้าสถิติรายวิชา
- **6.4 ผู้ปกครอง** — ตาราง parents ผูกกับ students ดูความคืบหน้าบุตรหลาน
