-- ClassTrack — 002_attendance.sql (ระบบเช็กชื่อด้วย QR Code)
-- รันหลัง 001_init.sql · รันซ้ำได้

create table if not exists public.attendance_sessions (
  id                  uuid primary key default gen_random_uuid(),
  teacher_id          uuid not null references public.teachers(id),
  classroom           text not null check (char_length(classroom) between 1 and 30),
  subject             text not null check (char_length(subject) between 1 and 50),
  title               text check (title is null or char_length(title) <= 50),
  starts_at           timestamptz not null default now(),
  late_after_minutes  int not null default 10 check (late_after_minutes between 0 and 120),
  status              text not null default 'open' check (status in ('open', 'closed')),
  closed_at           timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id  uuid not null references public.students(id),
  status      text not null check (status in ('present', 'late', 'absent', 'leave', 'sick')),
  method      text not null check (method in ('qr', 'code', 'manual', 'auto')),
  checked_at  timestamptz not null default now(),
  marked_by   uuid references public.teachers(id),
  note        text check (note is null or char_length(note) <= 100),
  updated_at  timestamptz not null default now(),
  unique (session_id, student_id)
);

drop trigger if exists trg_attendance_records_updated on public.attendance_records;
create trigger trg_attendance_records_updated before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- แยกประเภทการนับครั้งที่กรอกผิด: ผูกบัญชี (link) / เช็กชื่อ (checkin)
-- (001 รุ่นปัจจุบันมีคอลัมน์นี้แล้ว บรรทัดนี้มีไว้สำหรับฐานข้อมูลที่สร้างจาก 001 รุ่นเก่า)
alter table public.link_attempts
  add column if not exists kind text not null default 'link' check (kind in ('link', 'checkin'));

create index if not exists idx_link_attempts_user_kind_time on public.link_attempts (line_user_id, kind, created_at);
create index if not exists idx_att_sessions_teacher_created on public.attendance_sessions (teacher_id, created_at desc);
create index if not exists idx_att_sessions_classroom_status on public.attendance_sessions (classroom, status);
create index if not exists idx_att_records_student on public.attendance_records (student_id);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;

revoke all on public.attendance_sessions, public.attendance_records from anon, authenticated;
grant all on public.attendance_sessions, public.attendance_records to service_role;
grant usage, select on all sequences in schema public to service_role;
