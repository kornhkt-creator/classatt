# คู่มือติดตั้งและ Deploy ClassTrack (ฉบับเต็ม)

คู่มือนี้พาตั้งแต่เริ่มจนครูและนักเรียนเปิดใช้ผ่าน LINE ได้จริง ทำตามลำดับทีละขั้น

```
ขั้น 1 Supabase (ฐานข้อมูล) ─► ขั้น 2 LINE MINI App ─► ขั้น 3 Vercel (เว็บ + server)
        ─► ขั้น 4 ต่อ LINE เข้ากับ Vercel ─► ขั้น 5 ทดสอบบนมือถือ ─► ขั้น 6 Rich Menu ─► ขั้น 7 ใส่ข้อมูลจริง
```

> หน้าจอของ Supabase / LINE / Vercel เปลี่ยนบ่อย ถ้าชื่อเมนูไม่ตรงทุกตัวอักษร ให้หาเมนูที่ใกล้เคียง หรือถาม Claude Code พร้อมแนบภาพหน้าจอ

---

## ขั้น 0 · เตรียมก่อนเริ่ม

**บัญชีที่ต้องมี**
- **Supabase**: https://supabase.com (สมัครด้วย GitHub ได้)
- **LINE Developers**: https://developers.line.biz/console/ (login ด้วยบัญชี LINE)
- **Vercel**: https://vercel.com (สมัครด้วย GitHub ได้)
- **GitHub**: https://github.com (ถ้าจะ deploy แบบเชื่อม GitHub)
- **LINE Official Account** ของโรงเรียน (ใช้ทำ Rich Menu ในขั้น 6)

**ตารางจดค่า** (จดไว้ในที่ปลอดภัย ห้ามโพสต์ในกลุ่มหรือแชท)

| ค่า | ได้จาก | ความลับ? | ใส่ที่ไหน |
|---|---|---|---|
| Project URL | Supabase (ขั้น 1) | ไม่ลับ | Vercel `SUPABASE_URL` |
| Secret key (`sb_secret_...`) | Supabase (ขั้น 1) | **ลับมาก** | Vercel `SUPABASE_SECRET_KEY` |
| SESSION_SECRET | สุ่มเอง (ขั้น 3) | **ลับมาก** | Vercel `SESSION_SECRET` |
| Channel ID (ตัวเลข) | LINE (ขั้น 2) | ไม่ลับ | Vercel `LINE_CHANNEL_ID` |
| LIFF ID (`1234567890-AbCdEfGh`) | LINE (ขั้น 2) | ไม่ลับ | Vercel `LIFF_ID` **และ** `public/js/config.js` |
| URL ของเว็บ (`https://xxx.vercel.app`) | Vercel (ขั้น 3) | ไม่ลับ | LINE Endpoint URL (ขั้น 4) |

> 💡 **ทริค:** ตัวเลขหน้าขีดของ LIFF ID คือ Channel ID เช่น LIFF ID `2012537616-AuzmekgH` → Channel ID = `2012537616`
>
> ใช้เทียบได้ว่า `LINE_CHANNEL_ID` บน Vercel ถูกหรือไม่

---

## ขั้น 1 · ตั้งค่าฐานข้อมูล Supabase

### 1.1 สร้างโปรเจกต์
1. เข้า https://supabase.com/dashboard → **New project**
2. ตั้งชื่อ เช่น `classtrack`
3. ตั้ง **Database Password** (จดเก็บไว้ แต่แอปไม่ได้ใช้)
4. **Region** เลือก **Southeast Asia (Singapore)** เพื่อให้เร็วและอยู่ที่เดียวกับ Vercel
5. กด **Create new project** แล้วรอ 1–2 นาที

### 1.2 สร้างตาราง (รัน SQL)
ไฟล์ SQL อยู่ในโฟลเดอร์ `supabase/` ของโปรเจกต์ เปิดด้วย Notepad หรือ VS Code แล้ว copy ทั้งไฟล์

1. Supabase เมนูซ้าย → **SQL Editor** → **New query**
2. วางเนื้อหาของ `supabase/migrations/001_init.sql` → กด **Run** → ต้องขึ้น `Success`
3. **New query** อีกครั้ง → วาง `supabase/migrations/002_attendance.sql` → **Run**
4. (ถ้าต้องการข้อมูลทดสอบ) **New query** → วาง `supabase/seed.sql` → **Run**
   จะได้ครูทดสอบ `T001` / `TEST01` และนักเรียน `65001` / `111111` เป็นต้น (ดูทั้งหมดที่หัวไฟล์ `seed.sql`)

ตรวจผล: เมนู **Table Editor** ต้องเห็นตาราง `teachers`, `students`, `assignments`, `submissions`, `attendance_sessions`, `attendance_records`, `link_attempts`, `audit_log`

> ⚠️ ห้ามรัน SQL ไฟล์อื่นที่ไม่ได้อยู่ในรายการนี้ ห้ามเพิ่ม RLS policy เอง ระบบตั้งใจปิดไม่ให้เข้าถึงฐานข้อมูลตรงๆ
>
> ⚠️ ไม่ต้องใช้เมนู **Authentication → Users** ของ Supabase เลย (ปล่อยว่างได้) แอปนี้ login ด้วย LINE และเก็บผู้ใช้ในตาราง `teachers` / `students` เอง

### 1.3 คัดลอกกุญแจ
1. **Project Settings** (รูปเฟือง) → **Data API** → คัดลอก **Project URL** (รูปแบบ `https://xxxx.supabase.co`)
2. **Project Settings** → **API Keys** → คัดลอก **Secret key** (ขึ้นต้น `sb_secret_...`)
   - ถ้าโปรเจกต์ยังเป็นระบบเดิม ให้ใช้ `service_role` key แทน
   - **ห้ามใช้** publishable key หรือ `anon` key

> ⚠️ Secret key เปิดฐานข้อมูลได้ทั้งหมด ห้ามวางในแชท ห้ามใส่ในไฟล์ใน `public/` ห้าม commit ขึ้น GitHub

### 1.4 (ไม่บังคับ) ทดสอบบนเครื่องก่อน
1. copy `.env.example` เป็น `.env.local` แล้วกรอก `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`
2. รันใน PowerShell:
```bash
npm run check:env
```
```bash
npm run dev:local
```
3. เปิด http://localhost:3000/api/health → ต้องเห็น `"ok":true`
4. เปิด http://localhost:3000/?mockUser=U_mock_t1 → ผูกครูด้วย `T001` / `TEST01` (ต้องรัน `seed.sql` แล้ว)

---

## ขั้น 2 · ตั้งค่า LINE MINI App

### 2.1 สร้าง Provider และ Channel
1. เข้า https://developers.line.biz/console/
2. **Create a new provider** ตั้งชื่อเป็นชื่อโรงเรียน (หรือเลือก provider เดียวกับ LINE OA ของโรงเรียน)
3. ใน provider → **Create a new channel** → เลือก **LINE MINI App**
4. กรอกข้อมูล:
   - **Region**: Thailand
   - **Channel name**: เช่น `ClassTrack` (ชื่อที่ผู้ใช้เห็นตอนเปิดแอป)
   - **Channel icon / description / email**: กรอกตามจริง
5. ยอมรับเงื่อนไข → **Create**

### 2.2 คัดลอก Channel ID
แท็บ **Basic settings** → คัดลอก **Channel ID** (ตัวเลขล้วน เช่น `2012537616`) → นี่คือ `LINE_CHANNEL_ID`

MINI App มี Channel ID แยก 3 ชุดตามสถานะ (Developing / Review / Published) และ LIFF ID ก็แยก 3 ชุดเช่นกัน
**ต้องใช้คู่ที่ตรงกันเสมอ** เช่น Developing `2012537616` คู่กับ LIFF ID `2012537616-...` · Published `2012537618` คู่กับ `2012537618-...`

> ⚠️ ต้องเป็น Channel ID ของ **channel LINE MINI App ตัวนี้** ห้ามใช้ Channel ID ของ Messaging API (LINE OA) หรือ LINE Login channel อื่น
>
> ถ้าใช้ผิดจะ login ไม่ได้ และ Vercel Logs จะขึ้น `Invalid IdToken Audience`

### 2.3 ตั้งค่า Web app (LIFF)
แท็บ **Web app settings** (บางเวอร์ชันชื่อ **LIFF**):

1. ดูส่วน **Developing** (ช่วงพัฒนา) → คัดลอก **LIFF ID** → นี่คือ `LIFF_ID`
   - MINI App มี LIFF ID แยก 3 ชุด (Developing / Review / Published) ช่วงนี้ใช้ชุด **Developing**
2. **Endpoint URL**: ยังไม่ต้องกรอก จะกลับมากรอกในขั้น 4 หลังได้ URL จาก Vercel
3. **Scopes**: ติ๊ก `openid` และ `profile` (ต้องมีทั้งสองตัว ไม่งั้นได้ ID token เป็น null)
4. **Scan QR**: เปิด (**On**) ใช้กับปุ่ม "สแกนเช็กชื่อ" ในแอป
5. กด **Update** / **Save**

### 2.4 ใส่ LIFF ID ในโค้ด
เปิดไฟล์ `public/js/config.js` แก้บรรทัดนี้ให้เป็น LIFF ID ของคุณ:
```js
export const LIFF_ID = '2012537616-AuzmekgH';
```
แล้ว commit (หรือสั่ง Claude Code: "เปลี่ยน LIFF_ID ใน config.js เป็น ... แล้ว commit")

### 2.5 ใครเปิดแอปได้บ้าง
- ช่วง **Developing** เปิดได้เฉพาะคนที่มีสิทธิ์ใน channel → แท็บ **Roles** → **Invite** แล้วเพิ่มเป็น **Tester** (ผู้ถูกเชิญต้องมีบัญชี LINE Developers)
- ถ้าจะให้นักเรียนทั้งโรงเรียนใช้ ต้อง **เผยแพร่ (publish)** MINI App ตามขั้นตอนในแท็บ **Review request** ของ LINE
  ดูเงื่อนไขล่าสุดที่ https://developers.line.biz/en/docs/line-mini-app/ เพราะ LINE ปรับกติกาบ่อย
  เผยแพร่แบบ **Unverified** ได้เองโดยไม่ต้องรอ LINE ตรวจ (แบบ Verified ต้องส่งตรวจ)
  หลังเผยแพร่ ให้เปลี่ยนไปใช้ชุด **Published** ทั้งหมด: Endpoint URL ของ Published, `LIFF_ID` ใน `config.js` และ env, `LINE_CHANNEL_ID` บน Vercel, ลิงก์ใน Rich Menu → แล้ว deploy ใหม่

---

## ขั้น 3 · Deploy ขึ้น Vercel

เลือก **วิธี A** หรือ **วิธี B** อย่างใดอย่างหนึ่ง (แนะนำ A ถ้ามี GitHub อยู่แล้ว)

### 3.1 สร้าง SESSION_SECRET (ใช้ทั้งสองวิธี)
รันใน PowerShell แล้ว copy ผลลัพธ์ (ข้อความยาวๆ 1 บรรทัด):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
> ใช้ค่าใหม่สำหรับ Vercel ห้ามใช้ค่าเดียวกับใน `.env.local` บนเครื่อง

### วิธี A · เชื่อมกับ GitHub (push แล้ว deploy อัตโนมัติ)
1. ตรวจว่าโค้ดขึ้น GitHub แล้ว และ repository ตั้งเป็น **Private**
2. https://vercel.com → **Add New…** → **Project** → **Import** repository `classatt`
3. หน้า Configure Project:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: เว้นว่าง · **Output Directory**: เว้นว่าง (`vercel.json` กำหนดเป็น `public` ให้แล้ว)
4. เปิด **Environment Variables** แล้วเพิ่มตาม **ตาราง 3.2** ด้านล่าง
5. กด **Deploy** → รอจนขึ้น **Ready** → จด URL เช่น `https://classatt.vercel.app`

ครั้งต่อไปที่แก้โค้ด: `git push` ขึ้น GitHub แล้ว Vercel จะ deploy ให้เอง

### วิธี B · อัปโหลดจากเครื่องด้วย Vercel CLI (ไม่ต้องใช้ GitHub)
1. PowerShell ในโฟลเดอร์โปรเจกต์ (ครั้งแรกครั้งเดียว):
```bash
npx vercel login
```
2. อัปโหลดครั้งแรก (ตอบคำถาม: Set up and deploy → Yes, scope → บัญชีของคุณ, link to existing → No, ชื่อโปรเจกต์ → `classatt`, directory → `./`):
```bash
npx vercel
```
3. ตั้ง Environment Variables บนเว็บ Vercel ตาม **ตาราง 3.2**
4. อัปโหลดขึ้นเว็บจริง (ทุกครั้งที่แก้โค้ด ให้รันคำสั่งนี้):
```bash
npx vercel --prod
```

`.vercelignore` กันไม่ให้ `.env*` และไฟล์ที่ไม่จำเป็นถูกอัปโหลด **ห้ามลบไฟล์นี้**

### 3.2 Environment Variables
Vercel → Project → **Settings** → **Environment Variables** → **Add** ทีละตัว

| Key | Value | Environments |
|---|---|---|
| `SUPABASE_URL` | Project URL (ขั้น 1.3) | Production (+ Preview ถ้าต้องการ) |
| `SUPABASE_SECRET_KEY` | Secret key (ขั้น 1.3) · Type = **Secret** | Production |
| `SESSION_SECRET` | ค่าจากขั้น 3.1 · Type = **Secret** | Production |
| `LINE_CHANNEL_ID` | Channel ID (ขั้น 2.2) | Production |
| `LIFF_ID` | LIFF ID (ขั้น 2.3) ต้องตรงกับ `public/js/config.js` | Production |

ข้อควรระวัง (เคยเจอจริง):
- **ห้ามตั้ง `DEV_MOCK_LOGIN`** บน Vercel
- กรอกค่าเปล่าๆ **ไม่มีเครื่องหมายคำพูด ไม่มีช่องว่าง**
- **ชื่อเดียวกันต้องมีแค่ 1 แถว** ถ้าเคยเพิ่มซ้ำ (เช่น แถวเก่าเฉพาะ Production + แถวใหม่ Production and Preview) แถวเก่าอาจถูกใช้แทน → ค้นชื่อตัวแปรในช่องค้นหาแล้วลบแถวที่ผิดทิ้ง
- **แก้ env แล้วต้อง Redeploy เสมอ**: แท็บ **Deployments** → รายการบนสุดที่มีป้าย **Production** → **⋯** → **Redeploy** → รอจน **Ready**

### 3.3 ตรวจว่า server ทำงาน
เปิดในเบราว์เซอร์: `https://<ชื่อโปรเจกต์>.vercel.app/api/health`
- ✅ ต้องเห็น `"ok":true` และ `"supabase":"connected"`
- ❌ ถ้าขึ้น error อ่านข้อความภาษาไทยที่บอก แล้วดูหัวข้อ **"แก้ปัญหา"** ท้ายคู่มือ

---

## ขั้น 4 · ต่อ LINE เข้ากับ Vercel

1. LINE Developers Console → channel MINI App → **Web app settings** → ส่วน **Developing**
2. **Endpoint URL** → **Edit** → ใส่ URL ของ Vercel เช่น `https://classatt.vercel.app` (ขึ้นต้น `https://` ไม่ต้องมี `/` ท้าย)
3. **Update**
4. ถ้า LIFF ID ใน `public/js/config.js` ยังไม่ใช่ค่าจริง ให้แก้แล้ว deploy ใหม่ (วิธี A: `git push` · วิธี B: `npx vercel --prod`)

ลิงก์เปิดแอป = `https://miniapp.line.me/<LIFF_ID>` เช่น `https://miniapp.line.me/2012537616-AuzmekgH`

---

## ขั้น 5 · ทดสอบบนมือถือจริง

ส่งลิงก์ `https://miniapp.line.me/<LIFF_ID>` เข้าแชทตัวเองใน LINE แล้วแตะเปิด

**ครู**
1. เปิดแอปครั้งแรก → หน้า **ผูกบัญชี** → **ฉันเป็นครู** → กรอกรหัสครู + รหัสลงทะเบียน (ทดสอบ: `T001` / `TEST01`)
2. เมนู **งาน** → สร้างงาน 1 ชิ้นให้ห้อง `ม.2/1`
3. เมนู **เช็กชื่อ** → เปิดรอบ → ต้องเห็น QR ที่เปลี่ยนทุก 20 วินาที

**นักเรียน** (ใช้ LINE อีกบัญชี/อีกเครื่อง ที่เป็น Tester ด้วย)
1. เปิดแอป → **ฉันเป็นนักเรียน** → `65001` / `111111`
2. เห็นงานที่ครูสร้าง → กดแจ้งส่ง
3. สแกน QR บนจอครูด้วยกล้อง LINE หรือปุ่ม **สแกนเช็กชื่อ** → ต้องขึ้น "มาเรียน"

**ครู** ยืนยันงาน → ปิดรอบเช็กชื่อ → ดูรายงาน

**ตรวจความปลอดภัย** (เปิดบนคอม)
- `https://<project>.vercel.app/?mockUser=x` ต้อง **login จำลองไม่ได้**
- `https://<project>.vercel.app/lib/env.js` และ `/supabase/seed.sql` ต้องขึ้น **404**

---

## ขั้น 6 · ใส่ปุ่มใน Rich Menu ของ LINE OA

1. https://manager.line.biz → เลือก LINE OA ของโรงเรียน
2. **Rich menus** (เมนูริชเมนู) → **Create**
3. เลือก template → ตั้งปุ่ม เช่น "ติดตามงาน / เช็กชื่อ"
4. **Action** = **Link** → URL = `https://miniapp.line.me/<LIFF_ID>`
5. ตั้งช่วงเวลาแสดง → **Save** → เปิด LINE OA บนมือถือดูว่าปุ่มขึ้น

---

## ขั้น 7 · ใส่ข้อมูลจริงก่อนเปิดใช้

1. **ลบข้อมูลทดสอบ**: SQL Editor → รัน `supabase/remove-seed.sql`
   ⚠️ ลบครู T001/T002 นักเรียน 65001–65008 และงาน/การเช็กชื่อที่เกี่ยวข้องทั้งหมด กู้คืนไม่ได้
2. **เตรียมไฟล์ CSV** ด้วย Excel/Google Sheets ใช้หัวคอลัมน์ตามตัวอย่าง แล้ว Save as **CSV UTF-8**
   - `templates/teachers.csv` → `teacher_code,name`
   - `templates/students.csv` → `student_code,prefix,first_name,last_name,classroom,number`
   - ชื่อห้องต้องเขียนแบบเดียวกันทุกแถว เช่น `ม.2/1` (ไม่ใช่ `ม2/1` หรือ `ม.2 /1`)
3. **นำเข้า**: Table Editor → ตาราง `teachers` → **Insert** → **Import data from CSV** → เลือกไฟล์ → **Import**
   ทำซ้ำกับตาราง `students`
4. **สุ่มรหัส**: SQL Editor → รัน `supabase/generate-codes.sql` (เติมรหัสให้คนที่ยังไม่มี ไม่เปลี่ยนรหัสเดิม)
5. **ดูรหัสเพื่อแจก**: SQL Editor → รัน

```sql
select teacher_code, name, reg_code, line_user_id is not null as linked
from public.teachers where active = true order by teacher_code;
```

```sql
select classroom, number, student_code, prefix || first_name || ' ' || last_name as name, verify_code,
       line_user_id is not null as linked
from public.students where active = true order by classroom, number;
```

   กด **Export → CSV** เพื่อพิมพ์แจก · แจกเป็น **รายคน** อย่าโพสต์รวมในกลุ่ม

---

## การดูแลหลังเปิดใช้

| ต้องการ | ทำอย่างไร |
|---|---|
| แก้โค้ดแล้วขึ้นเว็บ | วิธี A: commit + `git push` · วิธี B: `npx vercel --prod` |
| แก้ env บน Vercel | แก้ → **Redeploy** ทุกครั้ง |
| นักเรียนเปลี่ยนมือถือ/บัญชี LINE | Table Editor → `students` → ล้าง `line_user_id` และ `linked_at` เป็น NULL → ให้ผูกใหม่ |
| นักเรียนย้ายออก | เปลี่ยน `active` เป็น `false` (ไม่ต้องลบแถว) |
| เพิ่มนักเรียนกลางเทอม | Insert แถวใหม่ใน `students` → รัน `generate-codes.sql` |
| ปิดเทอมนานเกิน 7 วัน | Supabase แผนฟรีจะหยุดโปรเจกต์ → Dashboard → **Restore** ก่อนเปิดเทอม |
| ดู error ของ server | Vercel → **Logs** → ค้นคำใน error |

---

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `/api/health` บอกว่า key ไม่ถูกต้อง | ใช้ key ผิดประเภท ต้องเป็น Secret key (`sb_secret_...`) หรือ `service_role` |
| `/api/health` บอกว่า table `missing` | ยังไม่ได้รัน `001_init.sql` / `002_attendance.sql` |
| `/api/health` ช้ามาก/เชื่อมไม่ได้ | Supabase ถูกหยุดชั่วคราว → Dashboard → **Restore** |
| ขึ้น "ยืนยันตัวตนกับ LINE ไม่สำเร็จ" | ดู Vercel **Logs** ค้น `LINE verify failed` → ถ้าเป็น `Invalid IdToken Audience` แปลว่า `LINE_CHANNEL_ID` ผิด: เทียบกับตัวเลขหน้าขีดของ LIFF ID, ตรวจว่าไม่มีตัวแปรชื่อซ้ำ 2 แถว แล้ว **Redeploy** |
| หมุนค้าง "กำลังเข้าสู่ระบบ..." | รอสักครู่ ถ้าไม่หายให้รีเฟรช ถ้าขึ้น error ให้ดูแถวด้านบน · ตรวจว่า Endpoint URL ใน LINE ตรงกับ URL ของ Vercel |
| วนกลับไปหน้า login LINE ซ้ำๆ | Endpoint URL ใน LINE ไม่ตรงกับ URL ที่เปิด หรือ LIFF ID ใน `config.js` ผิด |
| เปิดลิงก์แล้ว LINE บอกว่าไม่มีสิทธิ์ | MINI App ยังอยู่ช่วง Developing → เพิ่มคนนั้นเป็น **Tester** ในแท็บ Roles หรือเผยแพร่แอป |
| `getIDToken` ได้ null | ยังไม่ติ๊ก scope `openid` |
| ปุ่ม "สแกนเช็กชื่อ" ไม่ขึ้น | เปิดบนคอม (ใช้ได้เฉพาะในแอป LINE) หรือยังไม่เปิด **Scan QR** |
| สแกนด้วยกล้อง LINE แล้วไปหน้าแรกแทนหน้าเช็กชื่อ | `LIFF_ID` บน Vercel ไม่ตรงกับ `config.js` → แก้แล้ว Redeploy |
| ผูกบัญชีขึ้น "รหัสไม่ถูกต้อง" | พิมพ์ผิด/สลับรหัส, หรือแถวนั้นตั้ง `active = false` อยู่ |
| ผูกบัญชีขึ้น "รหัสนี้ถูกผูกกับบัญชี LINE อื่นแล้ว" | ล้าง `line_user_id` และ `linked_at` ของแถวนั้นเป็น NULL แล้วให้ผูกใหม่ |
| ขึ้นว่ากรอกผิดหลายครั้ง รอสักครู่ | ระบบกันเดารหัส รอ 15 นาทีแล้วลองใหม่ |
| หน้าขาวใน LINE แต่บนคอมปกติ | ส่งภาพหน้าจอ + ข้อความ error ให้ Claude Code (มักเป็นเรื่อง Content-Security-Policy) |
