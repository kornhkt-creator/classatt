import { apiGet } from '/js/api.js';
import { h, param, render, setParams } from '/js/dom.js';
import { autoRefresh, initPage, loadInto, refreshButton, runPage } from '/js/page.js';
import { emptyState } from '/js/ui.js';
import { taskItem } from '/js/student-ui.js';

const FILTERS = [
  ['todo', 'ต้องทำ', (i) => i.status === 'not_submitted' || i.status === 'revise'],
  ['review', 'รอตรวจ', (i) => i.status === 'submitted'],
  ['done', 'เสร็จแล้ว', (i) => i.status === 'approved'],
];

runPage(async () => {
  const { main } = await initPage('student');
  let filter = FILTERS.some(([k]) => k === param('filter')) ? param('filter') : 'todo';

  const load = () => loadInto(main, () => apiGet('student', 'assignments'), ({ items, summary }) => {
    const draw = () => {
      const test = FILTERS.find(([k]) => k === filter)[2];
      const shown = items.filter(test);
      render(main,
        h('div', { class: 'section-head first' },
          h('div', {}, h('h1', { class: 'page-title' }, 'งานของฉัน'), h('span', { class: 'muted' }, `ทั้งหมด ${items.length} รายการ`)),
          refreshButton(load)),
        summary.overdue > 0
          ? h('p', { class: 'notice red' }, `ค้างส่ง ${summary.pending} งาน · เลยกำหนด ${summary.overdue} งาน — รีบส่งนะ!`)
          : summary.pending > 0 ? h('p', { class: 'notice' }, `ค้างส่ง ${summary.pending} งาน`) : null,
        h('div', { class: 'toolbar' }, FILTERS.map(([key, label, fn]) => h('button', {
          class: `btn ${key === filter ? 'secondary' : 'ghost'}`, type: 'button', 'aria-pressed': String(key === filter),
          onclick: () => { filter = key; setParams({ filter: key === 'todo' ? null : key }); draw(); },
        }, `${label} ${items.filter(fn).length}`))),
        shown.length ? h('div', { class: 'task-list' }, shown.map(taskItem))
          : emptyState(filter === 'todo' ? 'ไม่มีงานค้าง เยี่ยมมาก! 🎉' : 'ยังไม่มีงานในหมวดนี้', filter === 'todo' ? '🎉' : '📭'));
    };
    draw();
  });
  autoRefresh(load);
  await load();
});
