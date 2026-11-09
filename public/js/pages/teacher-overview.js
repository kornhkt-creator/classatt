import { apiGet } from '/js/api.js';
import { h, param, render, setParams } from '/js/dom.js';
import { formatDateShort, studentName } from '/js/format.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { copyText, emptyState } from '/js/ui.js';

const CELL = {
  approved: ['✓', 'ตรวจแล้ว'],
  submitted: ['⏳', 'รอตรวจ'],
  revise: ['↺', 'ให้แก้ไข'],
  missing: ['✗', 'ยังไม่ส่ง (เลยกำหนด)'],
  pending: ['–', 'ยังไม่ส่ง (ยังไม่ถึงกำหนด)'],
};

function cell(status) {
  const [sym, label] = CELL[status] || CELL.pending;
  return h('span', { class: `cell ${status}`, title: label, 'aria-label': label }, sym);
}

runPage(async () => {
  const { main } = await initPage('teacher');
  let room = param('room') || '';
  let subject = param('subject') || '';
  let sortBy = 'number';

  const load = () => loadInto(main, () => apiGet('teacher', 'overview', { room, subject }), (data) => {
    room = data.room || '';
    subject = data.subject || '';
    setParams({ room, subject });

    const draw = () => {
      const students = [...data.students];
      if (sortBy === 'outstanding') students.sort((a, b) => (data.outstanding[b.id] || 0) - (data.outstanding[a.id] || 0) || (a.number || 0) - (b.number || 0));

      const roomSelect = h('select', { class: 'input', 'aria-label': 'ห้องเรียน', onchange: (e) => { room = e.target.value; subject = ''; load(); } },
        data.rooms.map((r) => h('option', { value: r, selected: r === room }, r)));
      const subjectSelect = h('select', { class: 'input', 'aria-label': 'วิชา', onchange: (e) => { subject = e.target.value; load(); } },
        h('option', { value: '' }, 'ทุกวิชา'),
        data.subjects.map((s) => h('option', { value: s, selected: s === subject }, s)));

      const copy = () => {
        const list = data.students.filter((s) => data.outstanding[s.id] > 0)
          .map((s) => `เลขที่ ${s.number ?? '-'} ${s.first_name} (${data.outstanding[s.id]} งาน)`);
        if (!list.length) return copyText(`${room} ${subject || 'ทุกวิชา'} ส่งงานครบทุกคน 🎉`);
        copyText(`${room} ${subject ? `วิชา${subject}` : 'ทุกวิชา'} ค้างงาน: ${list.join(', ')}`);
      };

      render(main,
        h('div', { class: 'section-head first' },
          h('div', {}, h('h1', { class: 'page-title' }, 'ภาพรวมการส่งงานรายห้อง'), h('p', { class: 'sub' }, 'นักเรียน × งานทุกชิ้นของคุณ')),
          h('a', { class: 'link-btn', href: '/teacher/reports' }, '← รายงาน')),
        data.rooms.length ? h('div', { class: 'toolbar' }, roomSelect, subjectSelect,
          h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { sortBy = sortBy === 'number' ? 'outstanding' : 'number'; draw(); } },
            sortBy === 'number' ? 'เรียง: เลขที่' : 'เรียง: ค้างมากสุดก่อน'),
          h('button', { class: 'btn sm ghost', type: 'button', onclick: copy }, '📋 คัดลอกรายชื่อคนค้างงาน')) : null,
        !data.rooms.length ? emptyState('ยังไม่มีงานที่มอบหมาย') : !data.assignments.length ? emptyState('ยังไม่มีงานในตัวกรองนี้')
          : h('section', { class: 'panel' },
            h('div', { class: 'table-wrap' },
              h('table', { class: 'matrix' },
                h('thead', {}, h('tr', {},
                  h('th', { class: 'name', scope: 'col' }, 'นักเรียน'),
                  data.assignments.map((a) => h('th', { scope: 'col' },
                    h('a', { href: `/teacher/assignment?id=${encodeURIComponent(a.id)}`, title: a.title }, a.title),
                    h('div', { class: 'muted' }, formatDateShort(a.due_at)))),
                  h('th', { scope: 'col' }, 'ค้าง'))),
                h('tbody', {}, students.map((s) => h('tr', { class: data.outstanding[s.id] > 0 ? '' : '' },
                  h('td', { class: 'name' }, `${s.number ?? '-'}. ${studentName(s)}`),
                  data.assignments.map((a) => h('td', {}, cell(data.cells[s.id][a.id]))),
                  h('td', {}, h('strong', { style: { color: data.outstanding[s.id] ? 'var(--red)' : 'var(--green-dark)' } }, String(data.outstanding[s.id] || 0)))))))),
            h('div', { class: 'legend' }, Object.entries(CELL).map(([k, [, label]]) => h('span', {}, cell(k), label)))));
    };
    draw();
  });
  await load();
});
