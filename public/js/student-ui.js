// Small UI pieces shared by several student pages
import { h } from '/js/dom.js';
import { formatThai, relativeDue } from '/js/format.js';
import { emptyState, subjectIcon, taskBadge } from '/js/ui.js';

export function taskItem(i) {
  const due = i.status === 'approved' || i.status === 'submitted' ? formatThai(i.due_at) : `${formatThai(i.due_at)} (${relativeDue(i.due_at)})`;
  return h('a', { class: 'task', href: `/student/assignment?id=${encodeURIComponent(i.id)}` },
    h('div', { class: 'task-icon', 'aria-hidden': 'true' }, subjectIcon(i.subject)),
    h('div', { class: 'task-main' },
      h('strong', {}, i.title),
      h('small', {}, `${i.subject} · กำหนดส่ง ${due}`),
      i.teacher_comment ? h('small', { style: { color: '#a2510c' } }, `ครู: ${i.teacher_comment}`) : null),
    taskBadge(i));
}

export function subjectTable(subjects, minPercent) {
  if (!subjects.length) return emptyState('ยังไม่มีรอบเช็กชื่อที่ปิดแล้ว', '📋');
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, ['วิชา', 'มา', 'สาย', 'ขาด', 'ลา', '%'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, subjects.map((s) => h('tr', {},
      h('td', {}, s.subject), h('td', {}, String(s.present)), h('td', {}, String(s.late)), h('td', {}, String(s.absent)),
      h('td', {}, String(s.leave + s.sick)),
      h('td', {}, h('strong', { style: { color: s.risk ? 'var(--red)' : 'var(--green-dark)' } },
        s.percent === null ? '-' : `${s.percent}%`), s.risk ? ` (ต่ำกว่า ${minPercent}%)` : ''))))));
}
