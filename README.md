# ClassTrack — ระบบติดตามงานนักเรียนบน LINE Mini App

ชุด prompt สำหรับใช้กับ Claude Code เพื่อสร้าง LINE Mini App ติดตามงานนักเรียน ครูใช้สร้างงาน กำหนดวันส่ง ดูว่าใครส่งแล้ว ใครค้าง และยืนยันหรือสั่งแก้ได้ นักเรียนใช้ดูงานของห้องตัวเองและกดแจ้งส่งงาน และมี **ระบบเช็กชื่อรายคาบด้วยการสแกน QR code** ผูกตัวตนครั้งแรกด้วยรหัสนักเรียนหรือรหัสครู หน้าเว็บเขียนด้วย **HTML + CSS + JavaScript ล้วน** ข้อมูลเก็บใน **Supabase** ตัวแอปอยู่บน **Vercel** และเปิดจาก Rich Menu ของ LINE OA

## ไฟล์ในชุดนี้

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `prompts.md` | prompt 14 ชิ้น copy ไปวางใน Claude Code ทีละชิ้นตามลำดับ |
| `CLAUDE.md` | กฎของโปรเจกต์ Claude Code อ่านเองอัตโนมัติทุกครั้ง **ห้ามลบ** |
| `README.md` | คู่มือนี้ |
| `design/prototype.html` | ต้นแบบหน้าตา (UX/UI) ทุก prompt ทำหน้าจอตามไฟล์นี้ — ดับเบิลคลิกเปิดในเบราว์เซอร์ได้ |

## ภาพรวมระบบ

```
มือถือ (แอป LINE)               Vercel                          Supabase
public/  HTML CSS JS  ──fetch──► api/  JavaScript ฝั่ง server ──► ฐานข้อมูล PostgreSQL
  - แสดงหน้าจอ                    - ตรวจกับ LINE ว่าเป็นใครจริง      - ปิดไม่ให้หน้าเว็บเข้าตรง
  - เรียก /api/...                - ตรวจสิทธิ์ครู/นักเรียน            - ครูดูข้อมูลผ่าน Table Editor
                                   - ถือกุญแจลับของ Supabase
```

**ทำไมต้องมี `api/` ด้วย?** ถ้าหน้าเว็บคุยกับ Supabase ตรงๆ นักเรียนที่เปิด DevTools เป็นจะแก้สถานะงานของตัวเองหรือของเพื่อนได้ เพราะ Supabase ไม่รู้จักบัญชี LINE จึงต้องมีโค้ด JavaScript ฝั่ง server ไว้ตรวจก่อนทุกครั้ง โค้ดส่วนนี้ยังเป็น JavaScript ธรรมดา ไม่ต้องใช้ framework

---

## สถานะตอนนี้: สร้าง Phase 1–4 และ 5.1 แล้ว ✅

โค้ดของ Prompt 1.1–5.1 อยู่ในโฟลเดอร์นี้แล้ว (เหลือ Prompt 5.2: deploy ขึ้น Vercel + ตั้งค่า LINE)

📘 **วิธีตั้งค่าฐานข้อมูล, LINE MINI App และ deploy ทีละขั้น: ดู [DEPLOY.md](DEPLOY.md)**

**ลองเล่นได้ทันทีโดยไม่ต้องมี Supabase / LINE** (ฐานข้อมูลจำลอง ข้อมูลหายเมื่อปิด):
```bash
npm install
```
```bash
npm run dev:demo
```
แล้วเปิด http://localhost:3000/?mockUser=U_mock_t1 → ผูกเป็นครูด้วยรหัส `T001` / `TEST01` (รหัสทดสอบทั้งหมดอยู่ใน `supabase/seed.sql`)

**ใช้กับ Supabase จริง:**
1. รัน `supabase/migrations/001_init.sql` → `002_attendance.sql` → `seed.sql` ใน Supabase SQL Editor ตามลำดับ
2. กรอก `.env.local` (ดูคำอธิบายใน `.env.example`) และใส่ `LIFF_ID` ใน `public/js/config.js`
3. รัน `npm run dev:local` (ไม่ต้อง login Vercel) หรือ `npm run dev` (ใช้ vercel dev) แล้วเปิด http://localhost:3000/api/health ต้องได้ `ok: true`

**รันชุดทดสอบ:**
```bash
npm test
```

---

## Quick Start (5 ขั้นตอน)

1. ทำส่วน **"เตรียมก่อนเริ่ม"** ด้านล่างให้ครบ (ประมาณ 30 นาที)
2. เปิด Claude Code ในโฟลเดอร์นี้ (`C:\ClaudeCode\ClassAtt`)
3. เปิด `prompts.md` แล้ว copy **Prompt 1.1** ไปวางใน Claude Code
4. ทำตามที่ Claude Code บอก รอจนเสร็จ ทดสอบตาม Test criteria แล้ว Claude Code จะ commit ให้
5. พิมพ์ `/clear` แล้วทำ prompt ถัดไปตามลำดับจนถึง **Prompt 5.2** (deploy)

---

## เตรียมก่อนเริ่ม

### 1. โปรแกรมและบัญชี
- **Node.js 22 LTS** ขึ้นไป: https://nodejs.org (ตรวจด้วย `node -v`)
- **Git**: https://git-scm.com (ตรวจด้วย `git --version`)
- บัญชี **GitHub**, **Vercel** (สมัครด้วย GitHub ได้) และ **Supabase** (สมัครด้วย GitHub ได้)
- ตั้งแต่ Prompt 1.1 ต้องใช้บัญชี Vercel แล้ว เพราะคำสั่ง `vercel dev` ที่ใช้รันบนเครื่องต้อง login

### 2. Supabase (ใช้ตั้งแต่ Prompt 1.1)
1. ไปที่ https://supabase.com/dashboard → **New project**
2. ตั้งชื่อ `classtrack`, ตั้ง Database Password (จดเก็บไว้), Region เลือก **Southeast Asia (Singapore)**
3. รอสร้างเสร็จ (1–2 นาที)
4. เก็บค่า 2 ค่าไว้ใส่ `.env.local`:
   - **Project URL** (รูปแบบ `https://xxxx.supabase.co`) → `SUPABASE_URL`
   - **Secret key** (ขึ้นต้น `sb_secret_...`) → `SUPABASE_SECRET_KEY`
     (ถ้าโปรเจกต์ยังเป็นระบบ key แบบเดิม ใช้ `service_role` key แทน)
   - ทั้งสองค่าอยู่ในเมนู **Project Settings** → หัวข้อ **API Keys** / **Data API**
5. ⚠️ **Secret key เป็นกุญแจที่เปิดได้ทุกอย่าง** ห้ามส่งให้ใคร ห้ามวางในแชท ห้ามใส่ในไฟล์ใน `public/`
6. ไม่ต้องใช้ publishable/anon key ในโปรเจกต์นี้

ใน Prompt 1.2 Claude Code จะเขียนไฟล์ SQL ให้ คุณนำไปวางใน **SQL Editor** ของ Supabase แล้วกด **Run** เอง

### 3. LINE MINI App (ใช้ตั้งแต่ Prompt 2.1)
1. ไปที่ https://developers.line.biz/console/ → Login ด้วยบัญชี LINE
2. สร้าง **Provider** (เช่นชื่อโรงเรียน) หรือใช้ provider เดียวกับ LINE OA ของโรงเรียน
3. สร้าง channel ประเภท **LINE MINI App** → ภูมิภาค **Thailand**
4. ในหน้า channel:
   - copy **Channel ID** (ตัวเลข) → `LINE_CHANNEL_ID` ใน `.env.local`
   - ตั้ง **Scope** ให้มี `openid` และ `profile`
   - เปิด **Scan QR** (ใช้กับปุ่มสแกนเช็กชื่อในแอป)
   - copy **LIFF ID** (รูปแบบ `1234567890-AbCdEfGh`) → ใส่ใน `public/js/config.js` (Prompt 2.1) และ `LIFF_ID` ใน `.env.local` (Prompt 4.1)
   - **Endpoint URL** ยังไม่ต้องใส่ จะใส่ตอน Prompt 5.2 หลัง deploy
5. ช่วง dev ใช้โหมด mock ทดสอบบนคอมได้ ยังไม่ต้องเปิดใน LINE จริง

> หน้าจอของ LINE Developers Console และ Supabase เปลี่ยนบ่อย ถ้าหาเมนูไม่เจอ ดูเอกสาร https://developers.line.biz/en/docs/line-mini-app/ และ https://supabase.com/docs หรือถาม Claude Code
> Channel แบบ MINI App มี LIFF ID แยกสำหรับช่วงพัฒนาและช่วงเผยแพร่ ถ้าเปลี่ยน LIFF ID ต้องแก้ `config.js` แล้ว deploy ใหม่

### 4. SESSION_SECRET
ให้ Claude Code สร้างให้ หรือรันคำสั่งนี้ใน PowerShell แล้ว copy ผลลัพธ์:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

บน Vercel (Prompt 5.2) ให้สร้างค่าใหม่อีกชุด ไม่ใช้ค่าเดียวกับบนเครื่อง

---

## Workflow

```
 copy Prompt X.X ──► วางใน Claude Code ──► Claude Code สร้างโค้ด
        ▲                                         │
        │                                         ▼
 /clear แล้วไปต่อ ◄── Claude Code commit ◄── ทดสอบตาม Test criteria
                                                  │ ไม่ผ่าน
                                                  ▼
                                    บอก Claude Code ว่าเห็นอะไร ให้แก้
```

| Phase | Prompt | ได้อะไร | ทดสอบที่ไหน |
|---|---|---|---|
| 1 Foundation | 1.1 | โปรเจกต์รันได้ เชื่อม Supabase ได้ | `localhost:3000/api/health` |
| | 1.2 | ตารางในฐานข้อมูล + ข้อมูลตัวอย่าง | Supabase Table Editor |
| 2 LINE Login | 2.1 | login ผ่าน LIFF (mock บนคอม) | `localhost:3000/?mockUser=U_mock_new` |
| | 2.2 | ผูกบัญชีครู/นักเรียน | หน้า `/link` |
| 3 Core | 3.1 | ครูสร้าง/แก้/ปิดงาน | `/teacher/assignments` |
| | 3.2 | กระดานติดตามการส่ง | `/teacher/assignment?id=...` |
| | 3.3 | ภาพรวมรายห้อง | `/teacher/overview` |
| | 3.4 | นักเรียนดูงาน + แจ้งส่ง | `/student/tasks` |
| 4 เช็กชื่อ | 4.1 | ครูเปิดรอบ + จอ QR เปลี่ยนทุก 20 วินาที | `/teacher/attendance` |
| | 4.2 | นักเรียนสแกน/กรอกรหัสเช็กชื่อ + ประวัติ | ลิงก์จากจอ QR (โหมด dev) |
| | 4.3 | ครูแก้สถานะ ปิดรอบ รายงาน % | `/teacher/attendance/report` |
| | 4.4 | หน้าหลัก รายงาน โปรไฟล์ ตาม prototype | `/teacher/`, `/student/`, `/profile` |
| 5 Deploy | 5.1 | UI เรียบร้อย ปลอดภัย ตรวจทั้งระบบ | DevTools โหมดมือถือ |
| | 5.2 | ใช้จริงผ่าน LINE OA | มือถือจริง |

---

## วิธีใช้แต่ละ prompt

1. **copy เฉพาะข้อความในกล่อง** ของ prompt นั้น (ไม่ต้อง copy ส่วน Test criteria / Gotcha ที่อยู่นอกกล่อง)
2. วางใน Claude Code แล้วกด Enter
3. ถ้า Claude Code ขอให้กรอก `.env.local` หรือรัน SQL ใน Supabase ให้ทำตาม แล้วตอบกลับว่า "เสร็จแล้ว"
4. เมื่อ Claude Code บอกว่าเสร็จ ทดสอบตาม **✅ Test criteria** ใต้ prompt นั้นด้วยตัวเอง
5. ไม่ผ่าน → บอก Claude Code ตรงๆ ว่าเห็นอะไร เช่น "เปิด /teacher/ แล้วหน้าขาว" หรือ copy ข้อความ error จาก Console มาวาง
6. ผ่าน → ตรวจว่า commit แล้ว (`git log --oneline`) → พิมพ์ `/clear` → เริ่ม prompt ถัดไป

### รันบนเครื่อง
```bash
npm run dev
```
แล้วเปิด http://localhost:3000 (แก้ไฟล์ใน `public/` แล้วกดรีเฟรชเบราว์เซอร์ได้เลย ไม่ต้อง build)

### ทดสอบด้วยโหมด mock (ไม่ต้องเปิด LINE)
เปิด `http://localhost:3000/?mockUser=<ชื่ออะไรก็ได้>` เพื่อจำลองผู้ใช้ LINE แต่ละคน เช่น
- `?mockUser=U_mock_t1` → ใช้ผูกเป็นครู
- `?mockUser=U_mock_s1`, `?mockUser=U_mock_s2` → ใช้ผูกเป็นนักเรียน

ทดสอบครูกับนักเรียนพร้อมกัน: ใช้หน้าต่างปกติ 1 คน และหน้าต่าง Incognito อีก 1 คน
(หรือใช้หน้าต่างเดียว สลับคนโดยเปิด `/?mockUser=...` ใหม่ — ระบบจะเปลี่ยนบัญชีให้)

### ทดสอบเช็กชื่อบนเครื่อง
QR จริงชี้ไปที่ `miniapp.line.me` จึงสแกนด้วยมือถือได้หลัง deploy เท่านั้น ระหว่าง dev ให้ทำแบบนี้:
1. หน้าต่างปกติ: `?mockUser=U_mock_t1` (ครู) → เมนู "เช็กชื่อ" → เปิดรอบ → จอ QR จะมีลิงก์ทดสอบตัวเล็กใต้รหัส
2. หน้าต่าง Incognito: เปิด `/?mockUser=U_mock_s1` (นักเรียน) ก่อน แล้ววางลิงก์นั้นในแท็บเดียวกัน หรือกด "กรอกรหัส" แล้วพิมพ์รหัส 6 หลักจากจอครู
3. ลิงก์/รหัสใช้ได้ไม่เกิน 1 นาที ถ้าหมดอายุให้ copy ใหม่

---

## การเช็กชื่อในห้องเรียนจริง

1. ครูเปิดแอป → เมนู **เช็กชื่อ** → กรอกรายวิชา เลือกห้อง และ "กำหนดมาสายหลัง (นาที)" → กด **สร้าง QR Code**
2. เปิด **จอ QR** บนโปรเจกเตอร์ แท็บเล็ต หรือมือถือครู (กด "เต็มจอ" ได้)
3. นักเรียนสแกนได้ 3 ทาง:
   - กล้องสแกน QR ของ LINE (แตะไอคอนสแกนในแอป LINE)
   - ปุ่ม **สแกนเช็กชื่อ** ในหน้าแรกของแอป
   - ปุ่ม **กรอกรหัส** แล้วพิมพ์ตัวเลข 6 หลักใต้ QR (สำหรับคนที่กล้องมีปัญหา)
4. เกินเวลา "สายหลัง X นาที" ระบบบันทึกเป็น **สาย** อัตโนมัติ
5. ครูกด **จัดการรายชื่อ** เพื่อตั้ง ลากิจ / ลาป่วย / ขาด เองได้
6. เสร็จแล้วกด **ปิดรอบ** → คนที่ไม่ได้เช็กถูกบันทึกเป็น **ขาด** (แก้ทีหลังได้)
7. ดู **รายงาน** % เวลาเรียนรายห้อง/รายวิชา คนที่ต่ำกว่า 80% จะเป็นสีแดง

> **กันโกง:** QR และรหัสเปลี่ยนทุก 20 วินาที และใช้ได้ไม่เกิน 1 นาที ถ้านักเรียนถ่ายรูปส่งให้เพื่อนที่อยู่บ้าน รหัสจะหมดอายุก่อนใช้ได้ในเกือบทุกกรณี แต่ถ้าเพื่อนส่งให้ทันทีก็ยังเช็กแทนกันได้ ครูควรนับจำนวนคนในห้องเทียบกับตัวเลขบนจอทุกครั้ง

---

## การจัดการข้อมูลใน Supabase (สำหรับครู/แอดมิน)

ใช้ **Table Editor** ใน Supabase Dashboard ซึ่งหน้าตาคล้ายตาราง Excel

- **เพิ่มนักเรียนทีละมาก**: เตรียมไฟล์ CSV ตามตัวอย่าง `templates/students.csv` (สร้างใน Prompt 5.2) → ตาราง `students` → **Insert → Import data from CSV**
- **สุ่มรหัสยืนยัน**: SQL Editor → รัน `supabase/generate-codes.sql` (เติมรหัสให้คนที่ยังไม่มี)
- **แจกรหัสให้นักเรียน**: ให้รหัสนักเรียน + `verify_code` เป็นรายคน (อย่าโพสต์รวมในกลุ่ม)
- **นักเรียนเปลี่ยนมือถือ/บัญชี LINE**: ล้างค่าช่อง `line_user_id` และ `linked_at` ของคนนั้น (ตั้งเป็น NULL) แล้วให้ผูกใหม่
- **นักเรียนย้ายออก**: เปลี่ยน `active` เป็น `false` (ไม่ต้องลบแถว)
- **ต้องการไฟล์ Excel**: เปิดตารางที่ต้องการ → **Export → CSV**
- ⚠️ อย่าเพิ่ม/ลบ/เปลี่ยนชื่อคอลัมน์เองใน Table Editor ถ้าต้องการเปลี่ยนให้สั่ง Claude Code ทำเป็นไฟล์ migration
- ⚠️ ช่อง `due_at` ใน Table Editor แสดงเป็นเวลา UTC (ช้ากว่าเวลาไทย 7 ชั่วโมง) เป็นเรื่องปกติ ในแอปจะแสดงเป็นเวลาไทย

---

## FAQ

**ต้องเสียเงินไหม?**
Supabase แผน Free และ LINE MINI App ใช้ฟรีในระดับโรงเรียนทั่วไป ส่วน Vercel แผน Hobby ฟรีแต่กำหนดไว้สำหรับการใช้ส่วนตัวที่ไม่ใช่เชิงพาณิชย์ ถ้าโรงเรียนจะใช้เป็นระบบทางการ ควรอ่านเงื่อนไขของ Vercel หรือพิจารณาแผน Pro

**Supabase แผนฟรีมีข้อจำกัดอะไรที่ต้องรู้?**
ถ้าไม่มีใครใช้ 7 วันติด (เช่นปิดเทอม) โปรเจกต์จะถูกหยุดชั่วคราว ต้องเข้า Dashboard กด **Restore** ก่อนใช้งาน และพื้นที่ฐานข้อมูล 500 MB ซึ่งเพียงพอสำหรับโรงเรียนหลายปี

**รองรับนักเรียนได้กี่คน?**
หลายพันคนสบายๆ เพราะเป็นฐานข้อมูลจริงที่มี index

**ทำไมไม่ใช้ React หรือ Next.js?**
ตามที่ต้องการให้เป็น HTML/CSS/JS ล้วน ข้อดีคืออ่านง่าย ไม่ต้อง build แก้ไฟล์แล้วรีเฟรชเห็นผลทันที ข้อเสียคือถ้าแอปโตมากๆ จะจัดการโค้ดยากขึ้น ซึ่งขนาดของแอปนี้ยังไม่ถึงจุดนั้น

**อยากเพิ่มแจ้งเตือน LINE / แนบไฟล์ / ให้คะแนน?**
ดูหัวข้อ "ไอเดียต่อยอด" ท้าย `prompts.md` ทำหลังเวอร์ชันแรกใช้งานได้แล้ว

---

## ถ้าเจอปัญหา

### Claude Code ทำพัง อยากย้อนกลับไป commit ก่อนหน้า
ดูรายการ commit:
```bash
git log --oneline
```
ย้อนกลับ 1 commit (โค้ดที่ยังไม่ commit จะหายทั้งหมด):
```bash
git reset --hard HEAD~1
```
ทิ้งเฉพาะที่แก้แต่ยังไม่ commit:
```bash
git restore .
```
> การย้อนโค้ดไม่ได้ย้อนข้อมูลใน Supabase ถ้ารัน SQL ไปแล้ว ต้องแก้ในฐานข้อมูลแยกต่างหาก (ถาม Claude Code ได้)

### Port 3000 ถูกใช้งานอยู่
หาโปรแกรมที่ใช้ port (Windows):
```bash
netstat -ano | findstr :3000
```
ปิดโปรแกรมนั้น (แทน `<PID>` ด้วยเลขท้ายบรรทัด):
```bash
taskkill /PID <PID> /F
```

### อาการที่พบบ่อย
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `vercel dev` ถามให้ login / link | ทำตามครั้งแรกครั้งเดียว (`npx vercel login` แล้ว `npx vercel link`) |
| `/api/health` บอกว่า key ไม่ถูกต้อง | ใช้ key ผิดประเภท ต้องเป็น Secret key (`sb_secret_...`) หรือ `service_role` |
| `permission denied for table ...` | server ใช้ publishable/anon key แทน secret key |
| `relation "teachers" does not exist` | ยังไม่ได้รัน `001_init.sql` ใน SQL Editor |
| Supabase ตอบช้ามาก/เชื่อมไม่ได้ | โปรเจกต์ถูก pause → Dashboard → Restore |
| เปิดใน LINE แล้วหมุนค้าง/วนกลับหน้า login | Endpoint URL ใน LINE Console ไม่ตรงกับ URL ของ Vercel หรือ LIFF ID ใน `config.js` ผิด |
| `liff is not defined` | ลืมใส่ `<script>` ของ LIFF SDK ในหน้านั้น |
| `getIDToken` ได้ null | ยังไม่เปิด scope `openid` |
| Login ได้ 401 ตลอดบน Vercel | `LINE_CHANNEL_ID` ผิด หรือแก้ env แล้วยังไม่กด Redeploy |
| หน้าขาวใน LINE แต่บนคอมปกติ | เปิด Console ดู error มักเป็นเรื่อง Content-Security-Policy ให้ copy error ไปให้ Claude Code |
| ปุ่ม "สแกนเช็กชื่อ" ไม่ขึ้น | เปิดบนคอม (ใช้ได้เฉพาะในแอป LINE) หรือยังไม่เปิด **Scan QR** ใน LIFF settings |
| สแกนแล้วขึ้น "QR หมดอายุ" ตลอด | เน็ตมือถือนักเรียนช้ามาก ให้ใช้ "กรอกรหัส" แทน หรือ QR บนจอไม่อัปเดต (ตรวจว่าจอครูยังต่อเน็ตอยู่) |
| สแกนด้วยกล้อง LINE แล้วไปหน้าแรกแทนหน้าเช็กชื่อ | `LIFF_ID` บน Vercel ไม่ตรงกับ channel หรือ Endpoint URL ผิด |
| รูป QR ไม่แสดง | Content-Security-Policy ไม่ได้อนุญาต `img-src data:` |
| หน้าตาไม่เหมือนต้นแบบ | พิมพ์บอก "เทียบกับ design/prototype.html แล้วแก้หน้า ... ให้เหมือน" พร้อมแนบภาพหน้าจอ |
| Claude Code เผลอใช้ React/framework | พิมพ์บอก "อ่าน CLAUDE.md อีกครั้ง โปรเจกต์นี้ใช้ HTML/CSS/JS ล้วน แก้ให้ตรงกฎ" |

### ข้อควรระวังด้านความปลอดภัย
- ห้าม commit `.env.local` ขึ้น GitHub ถ้าเผลอ push ไปแล้ว ให้สร้าง Secret key ใหม่ใน Supabase และลบ key เก่าทันที
- ตั้ง GitHub repository เป็น **Private**
- อย่าเพิ่ม RLS policy ใน Supabase เอง ระบบตั้งใจปิดการเข้าถึงตรงทั้งหมด
- ให้สิทธิ์เข้า Supabase Dashboard เฉพาะครูที่ดูแลระบบ เพราะเห็นรหัสยืนยันของนักเรียนทุกคน
