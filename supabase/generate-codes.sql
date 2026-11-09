-- ClassTrack — generate-codes.sql
-- สุ่มรหัสให้คนที่ช่องรหัสยังว่าง (ไม่เปลี่ยนรหัสที่มีอยู่แล้ว) ใช้ตัวสุ่มของ gen_random_uuid() ซึ่งปลอดภัยกว่า random()
-- หลังรัน: เปิด Table Editor → students / teachers เพื่อดูรหัสและแจกให้เป็นรายคน

update public.students
set verify_code = lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
where verify_code is null;

update public.teachers
set reg_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where reg_code is null;

select 'students' as table_name, count(*) filter (where verify_code is not null) as with_code, count(*) as total from public.students
union all
select 'teachers', count(*) filter (where reg_code is not null), count(*) from public.teachers;
