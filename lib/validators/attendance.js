import { z } from 'zod';

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'leave', 'sick'];

export const createAttendanceSchema = z.object({
  classroom: z.string({ error: 'กรุณาเลือกห้องเรียน' }).min(1, 'กรุณาเลือกห้องเรียน').max(30),
  subject: z.string({ error: 'กรุณากรอกรายวิชา' }).transform((v) => v.trim())
    .pipe(z.string().min(1, 'กรุณากรอกรายวิชา').max(50, 'ชื่อวิชายาวเกิน 50 ตัวอักษร')),
  title: z.string().optional().default('').transform((v) => v.trim())
    .pipe(z.string().max(50, 'ชื่อคาบยาวเกิน 50 ตัวอักษร')),
  lateAfterMinutes: z.coerce.number({ error: 'กรุณาเลือกเวลามาสาย' }).int().min(0, 'เวลามาสายไม่ถูกต้อง').max(120, 'เวลามาสายไม่ถูกต้อง')
    .optional().default(10),
});

export const checkinSchema = z.object({
  sessionId: z.uuid('QR นี้ไม่ใช่ QR เช็กชื่อ').optional(),
  code: z.string({ error: 'กรุณากรอกรหัส 6 หลัก' }).transform((v) => v.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'รหัสต้องเป็นตัวเลข 6 หลัก')),
});

export const markAttendanceSchema = z.object({
  studentIds: z.array(z.uuid('รหัสนักเรียนไม่ถูกต้อง'), { error: 'กรุณาเลือกนักเรียน' })
    .min(1, 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน').max(60, 'เลือกได้ไม่เกิน 60 คนต่อครั้ง'),
  status: z.enum(ATTENDANCE_STATUSES, { error: 'สถานะไม่ถูกต้อง' }),
  note: z.string().optional().default('').transform((v) => v.trim())
    .pipe(z.string().max(100, 'หมายเหตุยาวเกิน 100 ตัวอักษร')),
});

export const reportSchema = z.object({
  room: z.string().max(30).optional(),
  subject: z.string().max(50).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่เริ่มไม่ถูกต้อง').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่สิ้นสุดไม่ถูกต้อง').optional(),
});
