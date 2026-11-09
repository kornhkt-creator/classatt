import { apiGet } from '/js/api.js';
import { h, render } from '/js/dom.js';
import { formatTime, studentName } from '/js/format.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { attendancePill } from '/js/ui.js';

function linkCard(href, icon, title, text) {
  return h('a', { class: 'task', href },
    h('div', { class: 'task-icon', 'aria-hidden': 'true' }, icon),
    h('div', { class: 'task-main' }, h('strong', {}, title), h('small', {}, text)),
    h('span', { class: 'link-btn', 'aria-hidden': 'true' }, '→'));
}

runPage(async () => {
  const { main } = await initPage('teacher');
  await loadInto(main, async () => {
    const dash = await apiGet('teacher', 'dashboard');
    const roster = dash.todaySession ? await apiGet('teacher', 'attendance-session', { id: dash.todaySession.id }) : null;
    return { dash, roster };
  }, ({ roster }) => {
    render(main,
      h('div', { class: 'section-head first' }, h('h1', { class: 'page-title' }, 'รายงาน')),
      h('div', { class: 'task-list' },
        linkCard('/teacher/overview', '▤', 'ภาพรวมการส่งงานรายห้อง', 'ตารางนักเรียน × งาน ดูว่าใครค้างงานกี่ชิ้น'),
        linkCard('/teacher/attendance/report', '▦', 'รายงานการเข้าเรียน (% เวลาเรียน)', 'สรุปมา/สาย/ขาด/ลา และนักเรียนที่เสี่ยง มส.')),
      roster ? h('section', { class: 'panel mt' },
        h('h2', {}, `รายชื่อเข้าเรียนวันนี้ · ${roster.session.classroom} · ${roster.session.subject}`),
        h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['นักเรียน', 'เวลา', 'สถานะ'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, roster.rows.map((r) => h('tr', {},
            h('td', {}, `${r.student.number ?? '-'}. ${studentName(r.student)}`),
            h('td', {}, r.record ? formatTime(r.record.checked_at) : '—'),
            h('td', {}, attendancePill(r.record?.status || 'none'))))))),
        h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: `/teacher/attendance/session?id=${encodeURIComponent(roster.session.id)}` }, 'จัดการรายชื่อ')))
        : h('p', { class: 'muted mt' }, 'วันนี้ยังไม่มีการเช็กชื่อ'));
  });
});
