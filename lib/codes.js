import { timingSafeEqual } from 'node:crypto';

// Constant-time string comparison (works for different lengths without leaking timing)
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function normalizeCode(value) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}
