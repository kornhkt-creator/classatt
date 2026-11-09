// LINE LIFF wrapper. Uses the global `liff` from the LIFF SDK <script> tag.
// Mock mode (localhost only): add ?mockUser=<id> to simulate a LINE user without opening LINE.
import { LIFF_ID } from '/js/config.js';

const MOCK_KEY = 'ct_mock_user';
let initPromise = null;

function isLocalHost() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

export function getMockUser() {
  if (!isLocalHost()) return null;
  const fromUrl = new URLSearchParams(location.search).get('mockUser');
  if (fromUrl && /^[A-Za-z0-9_-]{1,64}$/.test(fromUrl)) {
    sessionStorage.setItem(MOCK_KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(MOCK_KEY);
}

export function isMock() {
  return Boolean(getMockUser());
}

// liff.init() once per page. Resolves to the liff object, or null in mock mode.
export function initLiff() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (isMock()) return null;
    if (typeof window.liff === 'undefined') throw new Error('โหลด LINE SDK ไม่สำเร็จ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต');
    if (!LIFF_ID) {
      throw new Error(isLocalHost()
        ? 'ยังไม่ได้ตั้งค่า LIFF_ID ใน public/js/config.js — ทดสอบบนเครื่องให้เปิด /?mockUser=U_mock_t1'
        : 'ยังไม่ได้ตั้งค่า LIFF_ID ใน public/js/config.js');
    }
    await window.liff.init({ liffId: LIFF_ID });
    return window.liff;
  })();
  initPromise.catch(() => { initPromise = null; });
  return initPromise;
}

// Returns false when a LINE login redirect has started
export async function ensureLogin() {
  const l = await initLiff();
  if (!l) return true;
  if (!l.isLoggedIn()) {
    l.login({ redirectUri: location.href });
    return false;
  }
  return true;
}

export async function getIdToken() {
  const mock = getMockUser();
  if (mock) return `mock:${mock}`;
  const l = await initLiff();
  return l.getIDToken();
}

export async function relogin() {
  const l = await initLiff();
  if (!l) return;
  l.logout();
  l.login({ redirectUri: location.href });
}

export async function isInLineApp() {
  if (isMock()) return false;
  try {
    const l = await initLiff();
    return Boolean(l && l.isInClient());
  } catch {
    return false;
  }
}

export async function closeApp() {
  try {
    const l = await initLiff();
    if (l && l.isInClient()) {
      l.closeWindow();
      return;
    }
  } catch { /* ignore */ }
  window.close();
}

export async function openExternal(url) {
  if (!/^https?:\/\//i.test(url || '')) return;
  try {
    const l = await initLiff();
    if (l && l.isInClient()) {
      l.openWindow({ url, external: true });
      return;
    }
  } catch { /* fall back */ }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function canScan() {
  if (isMock()) return false;
  try {
    const l = await initLiff();
    return Boolean(l && l.isApiAvailable('scanCodeV2'));
  } catch {
    return false;
  }
}

export async function scanCode() {
  const l = await initLiff();
  const result = await l.scanCodeV2();
  return result?.value || '';
}
