import * as attemptsRepo from './repos/attempts.js';
import { HttpError } from './http.js';

export const LIMITS = {
  link: { max: 5, minutes: 15 },     // wrong student/teacher codes
  checkin: { max: 10, minutes: 10 }, // wrong attendance codes
};

// Throws 429 when there are too many failed attempts in the window
export async function assertNotLimited(lineUserId, kind, now = new Date()) {
  const { max, minutes } = LIMITS[kind];
  const since = new Date(now.getTime() - minutes * 60 * 1000);
  const failures = await attemptsRepo.listFailures(lineUserId, kind, since.toISOString());
  if (failures.length >= max) {
    const oldest = new Date(failures[failures.length - max].created_at);
    const waitMs = oldest.getTime() + minutes * 60 * 1000 - now.getTime();
    const waitMin = Math.max(1, Math.ceil(waitMs / 60000));
    throw new HttpError(429, 'rate_limited', `กรอกรหัสผิดหลายครั้งเกินไป ลองใหม่อีกครั้งใน ${waitMin} นาที`);
  }
}

export function recordAttempt(lineUserId, kind, success) {
  return attemptsRepo.record(lineUserId, kind, success);
}
