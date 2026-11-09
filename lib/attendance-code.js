import { createHmac } from 'node:crypto';
import { getEnv } from './env.js';
import { safeEqual } from './codes.js';

// Rotating 6-digit check-in code. Computed from the session id + a 20-second time window — never stored.
export const WINDOW_SECONDS = 20;
export const ACCEPT_WINDOWS = 3; // current + 2 previous windows → valid for at most 60 seconds

let cachedKey = null;
let cachedSecret = null;

function attendanceKey() {
  const secret = getEnv().SESSION_SECRET;
  if (cachedSecret !== secret) {
    // Separate key for this purpose (do not use SESSION_SECRET directly)
    cachedKey = createHmac('sha256', secret).update('attendance-code-v1').digest();
    cachedSecret = secret;
  }
  return cachedKey;
}

export function windowOf(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / WINDOW_SECONDS);
}

export function windowEndsAt(nowMs = Date.now()) {
  return (windowOf(nowMs) + 1) * WINDOW_SECONDS * 1000;
}

export function codeFor(sessionId, window, key = attendanceKey()) {
  const digest = createHmac('sha256', key).update(`${sessionId}:${window}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

export function currentCode(sessionId, nowMs = Date.now()) {
  return codeFor(sessionId, windowOf(nowMs));
}

export function verifyCode(sessionId, code, nowMs = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const key = attendanceKey();
  const current = windowOf(nowMs);
  let ok = false;
  for (let i = 0; i < ACCEPT_WINDOWS; i += 1) {
    if (safeEqual(codeFor(sessionId, current - i, key), code)) ok = true;
  }
  return ok;
}
