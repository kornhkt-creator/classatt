import { requireEnv } from './env.js';
import { getHost, isLocalhost } from './http.js';

// The URL inside the QR code.
// Production: opens the LINE MINI App directly at /student/checkin.
// Localhost: a local URL so it can be tested with ?mockUser in another browser window.
export function buildCheckinUrl(sessionId, code, req) {
  const qs = new URLSearchParams({ s: sessionId, c: code }).toString();
  if (isLocalhost(req)) return `http://${getHost(req)}/student/checkin?${qs}`;
  return `https://miniapp.line.me/${requireEnv('LIFF_ID')}/student/checkin?${qs}`;
}
