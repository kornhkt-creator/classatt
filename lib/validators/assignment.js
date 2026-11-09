import { z } from 'zod';

const trimmed = (max, requiredMsg, maxMsg) => z.string({ error: requiredMsg })
  .transform((v) => v.trim())
  .pipe(z.string().min(1, requiredMsg).max(max, maxMsg));

const dateStr = z.string({ error: 'กรุณาเลือกวันส่ง' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'กรุณาเลือกวันส่ง');
const timeStr = z.string({ error: 'กรุณาเลือกเวลาส่ง' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาส่งไม่ถูกต้อง');
const description = z.string().transform((v) => v.trim()).pipe(z.string().max(1000, 'รายละเอียดยาวเกิน 1000 ตัวอักษร'));

export const createAssignmentSchema = z.object({
  title: trimmed(100, 'กรุณากรอกชื่องาน', 'ชื่องานยาวเกิน 100 ตัวอักษร'),
  description: description.optional().default(''),
  subject: trimmed(50, 'กรุณากรอกวิชา', 'ชื่อวิชายาวเกิน 50 ตัวอักษร'),
  classrooms: z.array(z.string().min(1).max(30), { error: 'กรุณาเลือกห้องเรียน' })
    .min(1, 'กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง').max(30, 'เลือกห้องได้ไม่เกิน 30 ห้อง'),
  dueDate: dateStr,
  dueTime: timeStr.optional().default('23:59'),
});

export const updateAssignmentSchema = z.object({
  title: trimmed(100, 'กรุณากรอกชื่องาน', 'ชื่องานยาวเกิน 100 ตัวอักษร').optional(),
  description: description.optional(),
  subject: trimmed(50, 'กรุณากรอกวิชา', 'ชื่อวิชายาวเกิน 50 ตัวอักษร').optional(),
  dueDate: dateStr.optional(),
  dueTime: timeStr.optional(),
  status: z.enum(['open', 'closed'], { error: 'สถานะงานไม่ถูกต้อง' }).optional(),
}).refine((v) => !v.dueTime || v.dueDate, { message: 'กรุณาเลือกวันส่ง', path: ['dueDate'] });

export const reviewSchema = z.object({
  studentIds: z.array(z.uuid('รหัสนักเรียนไม่ถูกต้อง'), { error: 'กรุณาเลือกนักเรียน' })
    .min(1, 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน').max(60, 'เลือกได้ไม่เกิน 60 คนต่อครั้ง'),
  action: z.enum(['approve', 'revise', 'reset'], { error: 'คำสั่งไม่ถูกต้อง' }),
  comment: z.string().transform((v) => v.trim()).pipe(z.string().max(300, 'ความเห็นยาวเกิน 300 ตัวอักษร')).optional(),
}).refine((v) => v.action !== 'revise' || (v.comment && v.comment.length > 0), {
  message: 'กรุณาพิมพ์ความเห็นถึงนักเรียนว่าต้องแก้ไขอะไร', path: ['comment'],
});

export const idSchema = z.uuid('ไม่พบข้อมูลที่ต้องการ');
