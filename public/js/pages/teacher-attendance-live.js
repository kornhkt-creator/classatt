// Big QR screen for the projector / tablet. Polls every 4 s; the code changes every 20 s.
import { apiGet, apiPost } from '/js/api.js';
import { confirmSheet } from '/js/bottom-sheet.js';
import { h, param, render } from '/js/dom.js';
import { formatTime } from '/js/format.js';
import { initPage, runPage } from '/js/page.js';
import { attendancePill, errorState, toast } from '/js/ui.js';

const POLL_MS = 4000;

runPage(async () => {
  const { main } = await initPage('teacher');
  const id = param('id');
  let timer = null;
  let tick = null;
  let wakeLock = null;
  let offset = 0; // server time - device time
  let windowEndsAt = 0;
  let lastCode = '';

  const qrImg = h('img', { alt: 'QR Code สำหรับเช็กชื่อ' });
  const codeEl = h('p', { class: 'code-big', 'aria-live': 'polite' }, '------');
  const bar = h('span', { style: { width: '100%' } });
  const counter = h('p', { class: 'counter-big' }, '');
  const recentList = h('div', { class: 'task-list' });
  const devLink = h('p', { class: 'dev-link', hidden: true });
  const expiredNote = h('p', { class: 'notice', hidden: true }, 'เปิดรอบนี้มาเกิน 3 ชั่วโมงแล้ว นักเรียนจะเช็กชื่อไม่ได้ กรุณาปิดรอบ');
  const title = h('h1', { class: 'page-title' }, '');
  const subtitle = h('p', { class: 'sub' }, '');
  const live = h('section', { class: 'panel live' });

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not supported */ }
  }

  function updateCountdown() {
    const remain = Math.max(0, windowEndsAt - (Date.now() + offset));
    bar.style.width = `${(remain / 20000) * 100}%`;
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
  }

  async function poll() {
    stop();
    try {
      const d = await apiGet('teacher', 'attendance-live', { id });
      if (d.closed) {
        stop();
        clearInterval(tick);
        render(main, h('div', { class: 'state' }, h('div', {},
          h('span', { class: 'icon', 'aria-hidden': 'true' }, '✅'),
          h('h1', {}, 'ปิดรอบเช็กชื่อแล้ว'),
          h('a', { class: 'btn primary', href: `/teacher/attendance/session?id=${encodeURIComponent(id)}` }, 'ดูรายชื่อ'))));
        return;
      }
      offset = d.serverNow - Date.now();
      windowEndsAt = d.windowEndsAt;
      if (d.code !== lastCode) {
        lastCode = d.code;
        qrImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.qrSvg)}`;
        codeEl.textContent = d.code;
      }
      title.textContent = `${d.session.classroom} · ${d.session.subject}${d.session.title ? ` · ${d.session.title}` : ''}`;
      subtitle.textContent = `เริ่ม ${formatTime(d.session.starts_at)} น. · มาสายหลัง ${d.session.late_after_minutes} นาที`;
      counter.textContent = `เช็กแล้ว ${d.counts.checked}/${d.counts.total} คน (สาย ${d.counts.late})`;
      expiredNote.hidden = !d.expired;
      devLink.hidden = !d.checkinUrl;
      if (d.checkinUrl) {
        render(devLink, 'โหมดทดสอบ: ', h('a', { href: d.checkinUrl, target: '_blank', rel: 'noopener' }, d.checkinUrl));
      }
      render(recentList, d.recent.length
        ? d.recent.map((r) => h('div', { class: 'task' },
          h('div', { class: 'task-icon green', 'aria-hidden': 'true' }, String(r.number ?? '–')),
          h('div', { class: 'task-main' }, h('strong', {}, r.name), h('small', {}, `${formatTime(r.checkedAt)} น.`)),
          attendancePill(r.status)))
        : h('p', { class: 'muted center' }, 'ยังไม่มีใครเช็กชื่อ'));
      // Wait until the next code if it is sooner than the normal poll
      const untilNext = windowEndsAt - (Date.now() + offset) + 300;
      timer = setTimeout(poll, Math.max(500, Math.min(POLL_MS, untilNext)));
    } catch (err) {
      if (err.status === 404) {
        stop();
        clearInterval(tick);
        render(main, errorState(err.message));
        return;
      }
      toast(err.message, 'error');
      timer = setTimeout(poll, POLL_MS);
    }
  }

  async function closeRound(btn) {
    const ok = await confirmSheet('ปิดรอบเช็กชื่อ?', 'นักเรียนที่ยังไม่เช็กชื่อจะถูกบันทึกว่าขาด (แก้ไขภายหลังได้)', 'ปิดรอบ', 'danger');
    if (!ok) return;
    btn.disabled = true;
    try {
      await apiPost('teacher', 'close-attendance', {}, { id });
      location.assign(`/teacher/attendance/session?id=${encodeURIComponent(id)}`);
    } catch (err) {
      btn.disabled = false;
      toast(err.message, 'error');
    }
  }

  const fullBtn = h('button', { class: 'btn ghost sm', type: 'button', hidden: !document.fullscreenEnabled,
    onclick: () => (document.fullscreenElement ? document.exitFullscreen() : live.requestFullscreen()) }, '⛶ เต็มจอ');
  const closeBtn = h('button', { class: 'btn danger sm', type: 'button', onclick: () => closeRound(closeBtn) }, 'ปิดรอบ');

  render(live,
    title, subtitle, expiredNote,
    h('div', { class: 'qr-frame' }, qrImg),
    codeEl,
    h('p', { class: 'muted' }, 'สแกน QR ด้วย LINE หรือกรอกรหัสนี้ในแอป'),
    h('div', { class: 'countdown', 'aria-hidden': 'true' }, bar),
    counter,
    devLink,
    h('div', { class: 'actions', style: { justifyContent: 'center' } },
      fullBtn,
      h('a', { class: 'btn ghost sm', href: `/teacher/attendance/session?id=${encodeURIComponent(id)}` }, 'จัดการรายชื่อ'),
      closeBtn));

  render(main, live, h('section', { class: 'panel' }, h('h2', {}, 'เช็กชื่อล่าสุด'), recentList));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      requestWakeLock();
      poll();
    }
  });
  tick = setInterval(updateCountdown, 250);
  requestWakeLock();
  await poll();
});
