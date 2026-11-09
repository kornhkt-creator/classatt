// Entry page: LIFF login → server session → go to the page for this role.
import { qs, render } from '/js/dom.js';
import { initLiff } from '/js/liff.js';
import { homeFor, signIn } from '/js/auth.js';
import { errorState, loadingState } from '/js/ui.js';

const main = qs('#main');

async function start() {
  render(main, loadingState('กำลังเข้าสู่ระบบ...'));
  // Opened via https://miniapp.line.me/<LIFF_ID>/<path>: LINE adds liff.state and
  // liff.init() redirects to that sub page by itself — do not redirect on top of it.
  if (new URLSearchParams(location.search).has('liff.state')) {
    await initLiff();
    return;
  }
  const me = await signIn();
  location.replace(homeFor(me.role));
}

start().catch((err) => render(main, errorState(err?.message, () => start())));
