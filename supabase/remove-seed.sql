-- ClassTrack — remove-seed.sql
-- ลบเฉพาะข้อมูลทดสอบจาก seed.sql (ครู T001, T002 และนักเรียน 65001–65008) พร้อมงาน/การส่ง/การเช็กชื่อที่เกี่ยวข้อง
-- ⚠️ ลบแล้วกู้คืนไม่ได้ ใช้ก่อนเริ่มใช้งานจริงเท่านั้น

begin;

create temporary table seed_teachers on commit drop as
  select id from public.teachers where teacher_code in ('T001', 'T002');
create temporary table seed_students on commit drop as
  select id from public.students where student_code in ('65001','65002','65003','65004','65005','65006','65007','65008');

delete from public.attendance_records
 where student_id in (select id from seed_students)
    or session_id in (select id from public.attendance_sessions where teacher_id in (select id from seed_teachers));
delete from public.attendance_sessions where teacher_id in (select id from seed_teachers);

delete from public.submissions
 where student_id in (select id from seed_students)
    or assignment_id in (select id from public.assignments where teacher_id in (select id from seed_teachers));
update public.submissions set reviewed_by = null where reviewed_by in (select id from seed_teachers);
delete from public.assignments where teacher_id in (select id from seed_teachers);

delete from public.students where id in (select id from seed_students);
delete from public.teachers where id in (select id from seed_teachers);

commit;
