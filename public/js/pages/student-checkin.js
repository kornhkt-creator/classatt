// Landing page for the QR code: /student/checkin?s=<session>&c=<code>
// Must sign in here (not requirePage) so the s/c parameters are not lost.
import { signIn } from '/js/auth.js';
import { checkin, checkinButtons, errorCard, resultCard } from '/js/checkin.js';
import { h, qs, render } from '/js/dom.js';
import { closeApp } from '/js/liff.js';
import { mountShell } from '/js/page.js';
import { loadingState } from '/js/ui.js';

const main = qs('#main');

function footer() {
  return h('div', { class: 'actions', style: { justifyContent: 'center' } },
    h('a', { class: 'btn ghost', href: '/student/' }, 'ไปหน้าหลัก'),
    h('button', { class: 'btn ghost', type: 'button', onclick: closeApp }, 'ปิด'));
}

async function run() {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('s');
  const code = params.get('c');
  render(main, loadingState('กำลังเข้าสู่ระบบ...'));
  const me = await signIn();
  mountShell(me);

  if (me.role === 'unlinked') {
    return render(main, h('div', { class: 'result info' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, '🔗'),
      h('h1', {}, 'กรุณาผูกบัญชีก่อน'),
      h('p', {}, 'ผูกบัญชี LINE กับรหัสนักเรียนให้เสร็จ แล้วสแกน QR บนจอครูอีกครั้ง'),
      h('a', { class: 'btn primary', href: '/link' }, 'ไปผูกบัญชี')));
  }
  if (me.role !== 'student') {
    return render(main, h('div', { class: 'result info' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, 'ℹ️'),
      h('h1', {}, 'หน้านี้สำหรับนักเรียน'), h('a', { class: 'btn primary', href: '/teacher/' }, 'ไปหน้าหลักครู')));
  }

  const showResult = (res) => render(main, resultCard(res), footer());
  const showError = (err) => {
    const [scanBtn, codeBtn] = checkinButtons({ onResult: showResult, onError: showError, scanLabel: 'สแกนใหม่' });
    render(main, errorCard(err), h('div', { class: 'actions', style: { justifyContent: 'center' } }, scanBtn, codeBtn), footer());
  };

  if (!sessionId || !/^\d{6}$/.test(code || '')) {
    return showError(new Error('ลิงก์เช็กชื่อไม่ครบ กรุณาสแกน QR บนจอครูอีกครั้ง'));
  }
  render(main, loadingState('กำลังเช็กชื่อ...'));
  try {
    const res = await checkin({ sessionId, code });
    // Remove the code from the URL so a refresh does not resend an old code
    history.replaceState(null, '', '/student/checkin');
    showResult(res);
  } catch (err) {
    history.replaceState(null, '', '/student/checkin');
    showError(err);
  }
}

run().catch((err) => render(main, errorCard(err), footer()));
