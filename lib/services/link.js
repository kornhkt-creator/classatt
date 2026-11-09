import { z } from 'zod';
import * as studentsRepo from '../repos/students.js';
import * as teachersRepo from '../repos/teachers.js';
import * as audit from '../repos/audit.js';
import { assertNotLimited, recordAttempt } from '../rate-limit.js';
import { normalizeCode, safeEqual } from '../codes.js';
import { badRequest, conflict } from '../http.js';

const WRONG_CODE = 'รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
const TAKEN = 'รหัสนี้ถูกผูกกับบัญชี LINE อื่นแล้ว กรุณาติดต่อครู';

export const studentLinkSchema = z.object({
  studentCode: z.string({ error: 'กรุณากรอกรหัสนักเรียน' }).transform(normalizeCode)
    .pipe(z.string().min(1, 'กรุณากรอกรหัสนักเรียน').max(30, 'รหัสนักเรียนยาวเกินไป')),
  verifyCode: z.string({ error: 'กรุณากรอกรหัสยืนยัน' }).transform(normalizeCode)
    .pipe(z.string().regex(/^\d{6}$/, 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก')),
  confirm: z.boolean().optional().default(false),
});

export const teacherLinkSchema = z.object({
  teacherCode: z.string({ error: 'กรุณากรอกรหัสครู' }).transform(normalizeCode)
    .pipe(z.string().min(1, 'กรุณากรอกรหัสครู').max(30, 'รหัสครูยาวเกินไป')),
  regCode: z.string({ error: 'กรุณากรอกรหัสลงทะเบียน' }).transform((v) => normalizeCode(v).toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, 'รหัสลงทะเบียนต้องมี 6 ตัวอักษร')),
  confirm: z.boolean().optional().default(false),
});

function assertUnlinked(ctx) {
  if (ctx.role !== 'unlinked') throw conflict('บัญชี LINE นี้ผูกไว้แล้ว', 'already_linked');
}

async function fail(lineUserId) {
  await recordAttempt(lineUserId, 'link', false);
  throw badRequest(WRONG_CODE, 'invalid_code');
}

export async function linkStudent(ctx, input) {
  assertUnlinked(ctx);
  const { studentCode, verifyCode, confirm } = studentLinkSchema.parse(input);
  const lineUserId = ctx.session.lineUserId;
  await assertNotLimited(lineUserId, 'link');

  const student = await studentsRepo.getForLink(studentCode);
  const valid = Boolean(student && student.active && student.verify_code && safeEqual(student.verify_code, verifyCode));
  if (!valid) await fail(lineUserId);
  if (student.line_user_id) throw conflict(TAKEN, 'already_taken');

  const preview = {
    prefix: student.prefix, first_name: student.first_name, last_name: student.last_name,
    classroom: student.classroom, number: student.number,
  };
  if (!confirm) return { role: 'student', preview };

  const linked = await studentsRepo.linkLineUser(student.id, lineUserId);
  if (!linked) throw conflict(TAKEN, 'already_taken');
  await recordAttempt(lineUserId, 'link', true);
  await audit.log(`student:${student.id}`, 'link_line', { student_code: student.student_code });
  return { role: 'student', linked: true, preview };
}

export async function linkTeacher(ctx, input) {
  assertUnlinked(ctx);
  const { teacherCode, regCode, confirm } = teacherLinkSchema.parse(input);
  const lineUserId = ctx.session.lineUserId;
  await assertNotLimited(lineUserId, 'link');

  const teacher = await teachersRepo.getForLink(teacherCode);
  const valid = Boolean(teacher && teacher.active && teacher.reg_code && safeEqual(teacher.reg_code.toUpperCase(), regCode));
  if (!valid) await fail(lineUserId);
  if (teacher.line_user_id) throw conflict(TAKEN, 'already_taken');

  const preview = { name: teacher.name, teacher_code: teacher.teacher_code };
  if (!confirm) return { role: 'teacher', preview };

  const linked = await teachersRepo.linkLineUser(teacher.id, lineUserId);
  if (!linked) throw conflict(TAKEN, 'already_taken');
  await recordAttempt(lineUserId, 'link', true);
  await audit.log(`teacher:${teacher.id}`, 'link_line', { teacher_code: teacher.teacher_code });
  return { role: 'teacher', linked: true, preview };
}
