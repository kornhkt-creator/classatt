import { apiGet, apiPost } from '/js/api.js';
import { ensureLogin, getIdToken, relogin } from '/js/liff.js';

const RELOGIN_KEY = 'ct_relogin_tried';
const never = () => new Promise(() => {});

export function homeFor(role) {
  if (role === 'teacher') return '/teacher/';
  if (role === 'student') return '/student/';
  return '/link';
}

// Full sign-in: LIFF → ID token → server verifies with LINE → session cookie. Returns "me".
export async function signIn() {
  const ready = await ensureLogin();
  if (!ready) return never(); // redirecting to LINE login

  const idToken = await getIdToken();
  if (!idToken) throw new Error('ไม่ได้รับข้อมูลยืนยันตัวตนจาก LINE (ตรวจว่าเปิด scope openid ใน LIFF แล้ว)');
  try {
    const me = await apiPost('auth', 'line', { idToken }, undefined, { redirectOn401: false });
    sessionStorage.removeItem(RELOGIN_KEY);
    return me;
  } catch (err) {
    if (err.code === 'token_expired' && !sessionStorage.getItem(RELOGIN_KEY)) {
      sessionStorage.setItem(RELOGIN_KEY, '1');
      await relogin();
      return never();
    }
    throw err;
  }
}

export function getMe() {
  return apiGet('auth', 'me', undefined, { redirectOn401: false });
}

// For every page except index.html and /student/checkin.
// role: 'teacher' | 'student' | 'linked' (either) | 'unlinked'
export async function requirePage(role) {
  let me;
  try {
    me = await getMe();
  } catch (err) {
    if (err.status === 401) {
      location.replace('/');
      return never();
    }
    throw err;
  }
  const ok = role === 'linked' ? me.role === 'teacher' || me.role === 'student' : me.role === role;
  if (!ok) {
    location.replace(homeFor(me.role));
    return never();
  }
  return me;
}
