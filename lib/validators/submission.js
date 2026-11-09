import { z } from 'zod';

export function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const submitSchema = z.object({
  note: z.string().optional().default('')
    .transform((v) => v.trim())
    .pipe(z.string().max(500, 'หมายเหตุยาวเกิน 500 ตัวอักษร')),
  linkUrl: z.string().optional().default('')
    .transform((v) => v.trim())
    .pipe(z.string().max(500, 'ลิงก์ยาวเกิน 500 ตัวอักษร'))
    .refine((v) => v === '' || isSafeHttpUrl(v), 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://'),
}).refine((v) => v.note.length > 0 || v.linkUrl.length > 0, {
  message: 'กรุณากรอกหมายเหตุหรือลิงก์งานอย่างน้อย 1 ช่อง', path: ['note'],
});
