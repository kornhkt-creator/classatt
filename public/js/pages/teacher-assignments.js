import { apiGet } from '/js/api.js';
import { h, param, render, setParams } from '/js/dom.js';
import { formatThai, relativeDue } from '/js/format.js';
import { autoRefresh, initPage, loadInto, refreshButton, runPage } from '/js/page.js';
import { emptyState, pill, progressBar, subjectIcon } from '/js/ui.js';

const FILTERS = [['open', 'เปิดรับ'], ['closed', 'ปิดแล้ว'], ['review', 'รอตรวจ']];

function item(a) {
  const pct = a.total ? (a.done / a.total) * 100 : 0;
  return h('a', { class: 'task', href: `/teacher/assignment?id=${encodeURIComponent(a.id)}` },
    h('div', { class: 'task-icon', 'aria-hidden': 'true' }, subjectIcon(a.subject)),
    h('div', { class: 'task-main' },
      h('strong', {}, a.title),
      h('small', {}, `${a.subject} · ${a.classroom} · กำหนดส่ง ${formatThai(a.due_at)}`),
      progressBar(pct, `ส่งแล้ว ${a.done} จาก ${a.total} คน`),
      h('small', {}, `ส่งแล้ว ${a.done}/${a.total} คน${a.status === 'open' ? ` · ${relativeDue(a.due_at)}` : ''}`)),
    h('div', { class: 'task-side' },
      a.status === 'closed' ? pill('muted', 'ปิดแล้ว') : null,
      a.overdue && a.status === 'open' ? pill('late', 'เลยกำหนด') : null,
      a.submitted > 0 ? pill('review', `รอตรวจ ${a.submitted}`) : null));
}

runPage(async () => {
  const { main } = await initPage('teacher');
  let filter = FILTERS.some(([k]) => k === param('filter')) ? param('filter') : 'open';

  const load = () => loadInto(main, () => apiGet('teacher', 'assignments', { status: filter }), ({ items }) => {
    render(main,
      h('div', { class: 'section-head first' },
        h('div', {}, h('h1', { class: 'page-title' }, 'งานที่มอบหมาย'), h('span', { class: 'muted' }, `ทั้งหมด ${items.length} รายการ`)),
        h('a', { class: 'link-btn', href: '/teacher/overview' }, 'ภาพรวมห้อง →')),
      h('div', { class: 'toolbar' },
        FILTERS.map(([key, label]) => h('button', {
          class: `btn ${key === filter ? 'secondary' : 'ghost'}`, type: 'button', 'aria-pressed': String(key === filter),
          onclick: () => { filter = key; setParams({ filter: key === 'open' ? null : key }); load(); },
        }, label)),
        refreshButton(load),
        h('a', { class: 'btn primary', href: '/teacher/new', style: { marginLeft: 'auto' } }, '＋ สร้างงานใหม่')),
      items.length
        ? h('div', { class: 'task-list' }, items.map(item))
        : emptyState(filter === 'open' ? 'ยังไม่มีงาน กดปุ่ม ＋ เพื่อสร้างงานแรก' : filter === 'review' ? 'ไม่มีงานที่รอตรวจ 🎉' : 'ยังไม่มีงานที่ปิดแล้ว'));
  });
  autoRefresh(load);
  await load();
});
