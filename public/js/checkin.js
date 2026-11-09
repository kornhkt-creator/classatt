// Shared check-in helpers: scan QR in LINE, enter the 6-digit code, show the result.
import { apiPost } from '/js/api.js';
import { openSheet } from '/js/bottom-sheet.js';
import { h } from '/js/dom.js';
import { formatTime } from '/js/format.js';
import { canScan, scanCode } from '/js/liff.js';
import { setBusy } from '/js/ui.js';

// Accepts https://miniapp.line.me/<LIFF_ID>/student/checkin?s=..&c=.. or this app's own /student/checkin URL
export function parseCheckinValue(value, appHost = location.host) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    return null;
  }
  const okHost = url.host === 'miniapp.line.me' || url.host === 'liff.line.me' || url.host === appHost;
  if (!okHost || !/\/student\/checkin\/?$/.test(url.pathname)) return null;
  const s = url.searchParams.get('s');
  const c = url.searchParams.get('c');
  if (!s || !/^\d{6}$/.test(c || '')) return null;
  return { sessionId: s, code: c };
}

export function checkin(body) {
  return apiPost('student', 'checkin', body);
}

const STATUS_TEXT = { present: 'มาเรียน', late: 'มาสาย', absent: 'ขาด', leave: 'ลากิจ', sick: 'ลาป่วย' };

// Result card: kind ok | warn | info | bad
export function resultCard(res) {
  const subject = [res.subject, res.title].filter(Boolean).join(' · ');
  if (res.alreadyChecked) {
    return h('div', { class: 'result info', role: 'status' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, 'ℹ️'),
      h('h1', {}, 'คุณเช็กชื่อรอบนี้แล้ว'),
      h('p', {}, `สถานะ: ${STATUS_TEXT[res.status] || res.status}${res.checkedAt ? ` · ${formatTime(res.checkedAt)} น.` : ''}`),
      h('p', { class: 'muted' }, subject));
  }
  const late = res.status === 'late';
  return h('div', { class: `result ${late ? 'warn' : 'ok'}`, role: 'status' },
    h('span', { class: 'icon', 'aria-hidden': 'true' }, late ? '⏰' : '✅'),
    h('h1', {}, late ? 'เช็กชื่อแล้ว — มาสาย' : 'เช็กชื่อแล้ว — มาเรียน'),
    h('p', {}, `${subject}${res.teacherName ? ` (${res.teacherName})` : ''}`),
    h('p', { class: 'muted' }, `เวลา ${formatTime(res.checkedAt)} น.`));
}

export function errorCard(err, onRetry) {
  return h('div', { class: 'result bad', role: 'alert' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, '❌'),
    h('h1', {}, 'เช็กชื่อไม่สำเร็จ'),
    h('p', {}, err?.message || 'กรุณาลองใหม่'),
    onRetry ? h('button', { class: 'btn primary', type: 'button', onclick: onRetry }, 'สแกนใหม่') : null);
}

// Opens the LINE scanner. Resolves { sessionId, code } or throws a friendly error.
export async function scanForCheckin() {
  const value = await scanCode();
  if (!value) throw new Error('ไม่ได้สแกน QR');
  const parsed = parseCheckinValue(value);
  if (!parsed) throw new Error('QR นี้ไม่ใช่ QR เช็กชื่อ');
  return parsed;
}

export { canScan };

// Bottom sheet with a 6-digit input. onDone(result) is called after a successful check-in.
export function openCodeSheet(onDone) {
  openSheet('กรอกรหัสเช็กชื่อ', (close) => {
    const input = h('input', {
      inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', pattern: '[0-9]*',
      placeholder: '••••••', 'aria-label': 'รหัส 6 หลัก',
      style: { fontSize: '28px', letterSpacing: '.3em', textAlign: 'center', fontWeight: '800' },
    });
    const msg = h('p', { class: 'notice red', hidden: true, role: 'alert' });
    const go = h('button', { class: 'btn primary block', type: 'submit' }, 'เช็กชื่อ');
    return h('form', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const code = input.value.replace(/\D/g, '');
      msg.hidden = true;
      if (code.length !== 6) {
        msg.textContent = 'กรุณากรอกตัวเลข 6 หลักที่อยู่ใต้ QR บนจอครู';
        msg.hidden = false;
        return;
      }
      setBusy(go, true, 'กำลังเช็กชื่อ...');
      try {
        const res = await checkin({ code });
        close();
        onDone(res);
      } catch (err) {
        msg.textContent = err.message;
        msg.hidden = false;
        setBusy(go, false);
      }
    } },
      h('p', { class: 'muted small' }, 'พิมพ์ตัวเลข 6 หลักใต้ QR บนจอครู (รหัสเปลี่ยนทุก 20 วินาที)'),
      h('div', { class: 'field' }, input), msg, go);
  });
}

// Wire "scan" + "enter code" buttons. onResult(res) / onError(err)
export function checkinButtons({ onResult, onError, scanLabel = 'สแกน QR Code' }) {
  const scanBtn = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: async () => {
    try {
      const parsed = await scanForCheckin();
      setBusy(scanBtn, true, 'กำลังเช็กชื่อ...');
      const res = await checkin(parsed);
      onResult(res);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(scanBtn, false);
    }
  } }, scanLabel);
  const codeBtn = h('button', { class: 'btn secondary', type: 'button', onclick: () => openCodeSheet(onResult) }, 'กรอกรหัส');
  canScan().then((ok) => { scanBtn.hidden = !ok; });
  return [scanBtn, codeBtn];
}
