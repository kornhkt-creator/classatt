-- ClassTrack — 001_init.sql
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ (ใช้ if not exists / create or replace)
-- การเข้าถึงข้อมูลทั้งหมดผ่าน server (api/) ด้วย secret key เท่านั้น — เปิด RLS ทุกตารางและไม่สร้าง policy

-- ---------- Tables ----------
create table if not exists public.teachers (
  id            uuid primary key default gen_random_uuid(),
  teacher_code  text not null unique check (char_length(teacher_code) between 1 and 30),
  name          text not null check (char_length(name) between 1 and 100),
  reg_code      text check (reg_code is null or reg_code ~ '^[A-Z0-9]{6}$'),
  line_user_id  text unique,
  linked_at     timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  student_code  text not null unique check (char_length(student_code) between 1 and 30),
  prefix        text not null default '' check (char_length(prefix) <= 20),
  first_name    text not null check (char_length(first_name) between 1 and 100),
  last_name     text not null default '' check (char_length(last_name) <= 100),
  classroom     text not null check (char_length(classroom) between 1 and 30),
  number        int check (number is null or number between 1 and 999),
  verify_code   text check (verify_code is null or verify_code ~ '^[0-9]{6}$'),
  line_user_id  text unique,
  linked_at     timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 100),
  description  text not null default '' check (char_length(description) <= 1000),
  subject      text not null check (char_length(subject) between 1 and 50),
  classroom    text not null check (char_length(classroom) between 1 and 30),
  teacher_id   uuid not null references public.teachers(id),
  due_at       timestamptz not null,
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.submissions (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null references public.assignments(id) on delete cascade,
  student_id       uuid not null references public.students(id),
  status           text not null default 'not_submitted'
                   check (status in ('not_submitted', 'submitted', 'approved', 'revise')),
  note             text check (note is null or char_length(note) <= 500),
  link_url         text check (link_url is null or (link_url ~* '^https?://' and char_length(link_url) <= 500)),
  submitted_at     timestamptz,
  is_late          boolean not null default false,
  reviewed_by      uuid references public.teachers(id),
  reviewed_at      timestamptz,
  teacher_comment  text check (teacher_comment is null or char_length(teacher_comment) <= 300),
  updated_at       timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.link_attempts (
  id            bigint generated always as identity primary key,
  line_user_id  text not null,
  kind          text not null default 'link' check (kind in ('link', 'checkin')),
  success       boolean not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor       text not null,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb
);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_assignments_updated on public.assignments;
create trigger trg_assignments_updated before update on public.assignments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_submissions_updated on public.submissions;
create trigger trg_submissions_updated before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------- Indexes ----------
create index if not exists idx_assignments_teacher_status on public.assignments (teacher_id, status);
create index if not exists idx_assignments_classroom_status on public.assignments (classroom, status);
create index if not exists idx_submissions_student on public.submissions (student_id);
create index if not exists idx_students_classroom on public.students (classroom);
create index if not exists idx_link_attempts_user_time on public.link_attempts (line_user_id, kind, created_at);

-- ---------- Views (security_invoker = ไม่ข้าม RLS) ----------
create or replace view public.assignment_progress with (security_invoker = true) as
select
  a.id as assignment_id,
  (select count(*) from public.students s where s.classroom = a.classroom and s.active)::int as total_students,
  count(sub.id) filter (where sub.status = 'submitted')::int as submitted_count,
  count(sub.id) filter (where sub.status = 'approved')::int as approved_count,
  count(sub.id) filter (where sub.status = 'revise')::int as revise_count,
  count(sub.id) filter (where sub.is_late and sub.status in ('submitted', 'approved'))::int as late_count
from public.assignments a
left join public.submissions sub
  on sub.assignment_id = a.id
 and sub.student_id in (select s.id from public.students s where s.active and s.classroom = a.classroom)
group by a.id;

create or replace view public.classroom_list with (security_invoker = true) as
select distinct classroom from public.students where active order by classroom;

-- ---------- Security: RLS on, no policies, no access for anon/authenticated ----------
alter table public.teachers      enable row level security;
alter table public.students      enable row level security;
alter table public.assignments   enable row level security;
alter table public.submissions   enable row level security;
alter table public.link_attempts enable row level security;
alter table public.audit_log     enable row level security;

revoke all on public.teachers, public.students, public.assignments, public.submissions,
              public.link_attempts, public.audit_log from anon, authenticated;
revoke all on public.assignment_progress, public.classroom_list from anon, authenticated;

grant all on public.teachers, public.students, public.assignments, public.submissions,
             public.link_attempts, public.audit_log to service_role;
grant select on public.assignment_progress, public.classroom_list to service_role;
grant usage, select on all sequences in schema public to service_role;
