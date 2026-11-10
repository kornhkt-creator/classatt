import { isMockLoginEnabled, requireEnv } from './env.js';
import { HttpError, isLocalhost } from './http.js';

const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const invalid = () => new HttpError(401, 'invalid_token', 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาเปิดแอปจาก LINE อีกครั้ง');

// Mock login needs ALL three: DEV_MOCK_LOGIN=true, not a production/preview deployment, and a localhost request.
export function isMockAllowed(req) {
  return isMockLoginEnabled() && isLocalhost(req);
}

// Verify a LIFF ID token with LINE. Never trust user ids sent by the page.
export async function verifyIdToken(idToken, req, fetchImpl = fetch) {
  if (typeof idToken !== 'string' || !idToken) throw invalid();

  if (idToken.startsWith('mock:')) {
    const id = idToken.slice(5);
    if (!isMockAllowed(req) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw invalid();
    return { lineUserId: id, displayName: `ผู้ทดสอบ ${id}`, pictureUrl: '' };
  }

  const channelId = requireEnv('LINE_CHANNEL_ID');
  let resp;
  try {
    resp = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }).toString(),
    });
  } catch {
    throw new HttpError(502, 'line_unreachable', 'เชื่อมต่อ LINE ไม่ได้ กรุณาลองใหม่');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // LINE's reason only (never the token) — shows up in Vercel → Logs
    console.warn('LINE verify failed:', resp.status, String(data.error || ''), String(data.error_description || ''));
    if (/expired/i.test(data.error_description || '')) {
      throw new HttpError(401, 'token_expired', 'การเข้าสู่ระบบหมดอายุ กำลังเข้าสู่ระบบใหม่');
    }
    throw invalid();
  }
  if (!data.sub) throw invalid();
  return { lineUserId: data.sub, displayName: data.name || '', pictureUrl: data.picture || '' };
}
