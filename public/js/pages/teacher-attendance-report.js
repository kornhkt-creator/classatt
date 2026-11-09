import { apiGet } from '/js/api.js';
import { h, param, render, setParams } from '/js/dom.js';
import { formatDateShort, studentName } from '/js/format.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { copyText, emptyState, pill } from '/js/ui.js';

const CELL = {
  present: ['✓', 'มาเรียน'],
  late: ['ส', 'มาสาย'],
  absent: ['ข', 'ขาด'],
  leave: ['ล', 'ลากิจ'],
  sick: ['ป', 'ลาป่วย'],
};

function cell(status) {
  if (!status) return h('span', { class: 'cell pending', title: 'ไม่มีข้อมูล' }, '·');
  const [sym, label] = CELL[status];
  return h('span', { class: `cell ${status}`, title: label, 'aria-label': label }, sym);
}

runPage(async () => {
  const { main } = await initPage('teacher');
  const q = { room: param('room') || '', subject: param('subject') || '', from: param('from') || '', to: param('to') || '' };
  let sortBy = 'number';

  const load = () => loadInto(main, () => apiGet('teacher', 'attendance-report', q), (d) => {
    Object.assign(q, { room: d.room || '', subject: d.subject || '', from: d.from, to: d.to });
    setParams(q);

    const draw = () => {
      const students = [...d.students];
      if (sortBy === 'percent') students.sort((a, b) => (d.totals[a.id].percent ?? 101) - (d.totals[b.id].percent ?? 101));
      const risky = d.students.filter((s) => d.totals[s.id]?.risk);

      const roomSel = h('select', { class: 'input', 'aria-label': 'ห้องเรียน', onchange: (e) => { q.room = e.target.value; q.subject = ''; load(); } },
        d.rooms.map((r) => h('option', { value: r, selected: r === d.room }, r)));
      const subjectSel = h('select', { class: 'input', 'aria-label': 'วิชา', onchange: (e) => { q.subject = e.target.value; load(); } },
        h('option', { value: '' }, 'ทุกวิชา'), d.subjects.map((s) => h('option', { value: s, selected: s === d.subject }, s)));
      const from = h('input', { class: 'input', type: 'date', value: d.from, 'aria-label': 'ตั้งแต่วันที่', onchange: (e) => { q.from = e.target.value; load(); } });
      const to = h('input', { class: 'input', type: 'date', value: d.to, 'aria-label': 'ถึงวันที่', onchange: (e) => { q.to = e.target.value; load(); } });

      render(main,
        h('div', { class: 'section-head first' },
          h('div', {}, h('h1', { class: 'page-title' }, 'รายงานการเข้าเรียน'), h('p', { class: 'sub' }, `นับเฉพาะรอบที่ปิดแล้ว · ต้องมีเวลาเรียนอย่างน้อย ${d.minPercent}%`)),
          h('a', { class: 'link-btn', href: '/teacher/attendance/' }, '← เช็กชื่อ')),
        !d.rooms.length ? emptyState('ยังไม่มีรอบเช็กชื่อ', '▦') : [
          h('div', { class: 'toolbar' }, roomSel, subjectSel, from, to),
          h('div', { class: 'toolbar' },
            h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { sortBy = sortBy === 'number' ? 'percent' : 'number'; draw(); } },
              sortBy === 'number' ? 'เรียง: เลขที่' : 'เรียง: % น้อยสุดก่อน'),
            h('button', { class: 'btn sm ghost', type: 'button', onclick: () => {
              if (!risky.length) return copyText(`${d.room} ${d.subject || 'ทุกวิชา'}: ทุกคนมีเวลาเรียนตั้งแต่ ${d.minPercent}% ขึ้นไป`);
              copyText(`${d.room} ${d.subject || 'ทุกวิชา'} เวลาเรียนต่ำกว่า ${d.minPercent}%: `
                + risky.map((s) => `เลขที่ ${s.number ?? '-'} ${s.first_name} (${d.totals[s.id].percent}%)`).join(', '));
            } }, `📋 คัดลอกรายชื่อที่ต่ำกว่า ${d.minPercent}%`)),
          risky.length ? h('p', { class: 'notice red' }, `เสี่ยง มส. ${risky.length} คน`) : null,
          !d.sessions.length ? emptyState('ไม่มีรอบที่ปิดแล้วในช่วงวันที่นี้', '📋') : h('section', { class: 'panel' },
            h('div', { class: 'table-wrap' }, h('table', { class: 'matrix' },
              h('thead', {}, h('tr', {},
                h('th', { class: 'name', scope: 'col' }, 'นักเรียน'),
                d.sessions.map((s) => h('th', { scope: 'col', title: `${s.subject}${s.title ? ` · ${s.title}` : ''}` },
                  h('a', { href: `/teacher/attendance/session?id=${encodeURIComponent(s.id)}` }, formatDateShort(s.starts_at)))),
                ['มา', 'สาย', 'ขาด', 'ลา', '%'].map((t) => h('th', { scope: 'col' }, t)))),
              h('tbody', {}, students.map((s) => {
                const t = d.totals[s.id];
                return h('tr', { class: t.risk ? 'risk' : '' },
                  h('td', { class: 'name' }, `${s.number ?? '-'}. ${studentName(s)}`, t.risk ? [' ', pill('late', 'เสี่ยง มส.')] : null),
                  d.sessions.map((sess) => h('td', {}, cell(d.cells[s.id][sess.id]))),
                  h('td', {}, String(t.present)), h('td', {}, String(t.late)), h('td', {}, String(t.absent)),
                  h('td', {}, String(t.leave + t.sick)),
                  h('td', {}, h('strong', { style: { color: t.risk ? 'var(--red)' : 'var(--green-dark)' } }, t.percent === null ? '-' : `${t.percent}%`)));
              })))),
            h('div', { class: 'legend' },
              Object.keys(CELL).map((k) => h('span', {}, cell(k), CELL[k][1])),
              h('span', {}, d.countLeaveAsPresent ? 'การลานับเป็นเวลาเรียน' : 'การลาไม่นับเป็นเวลาเรียน'))),
        ]);
    };
    draw();
  });
  await load();
});
