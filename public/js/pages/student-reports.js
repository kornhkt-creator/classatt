import { apiGet } from '/js/api.js';
import { h, render } from '/js/dom.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { stat } from '/js/ui.js';
import { subjectTable } from '/js/student-ui.js';

function bar(label, value, total, variant) {
  const pct = total ? Math.round((value / total) * 1000) / 10 : 0;
  return h('div', {},
    h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('strong', {}, label), h('strong', {}, `${pct}%`)),
    h('div', { class: `progress ${variant}`.trim(), role: 'progressbar', 'aria-label': label, 'aria-valuenow': String(Math.round(pct)), 'aria-valuemin': '0', 'aria-valuemax': '100' },
      h('span', { style: { width: `${pct}%` } })));
}

runPage(async () => {
  const { main } = await initPage('student');
  await loadInto(main, () => Promise.all([apiGet('student', 'dashboard'), apiGet('student', 'attendance'), apiGet('student', 'assignments')]),
    ([dash, att, tasks]) => {
      const o = att.overall;
      render(main,
        h('div', { class: 'section-head first' }, h('h1', { class: 'page-title' }, 'รายงานของฉัน')),
        h('div', { class: 'stats' },
          stat(o.percent === null ? '-' : `${o.percent}%`, 'อัตราการเข้าเรียน', 'green'),
          stat(dash.taskStats.approved, 'งานที่ส่งแล้ว'),
          stat(tasks.summary.late, 'งานส่งช้า', 'purple'),
          stat(dash.taskStats.pending, 'งานค้าง')),
        h('section', { class: 'panel' },
          h('h2', {}, 'สรุปการเข้าเรียน'),
          o.total ? h('div', { class: 'task-list' },
            bar('มาเรียน', o.present, o.total, ''),
            bar('มาสาย', o.late, o.total, 'amber'),
            bar('ขาดเรียน', o.absent, o.total, 'red'),
            bar('ลา', o.leave + o.sick, o.total, 'grey'))
            : h('p', { class: 'muted' }, 'ยังไม่มีข้อมูลการเข้าเรียน')),
        h('section', { class: 'panel' },
          h('h2', {}, 'เวลาเรียนรายวิชา'),
          subjectTable(att.subjects, att.minPercent),
          h('p', { class: 'muted small' }, `ต้องมีเวลาเรียนอย่างน้อย ${att.minPercent}% · ${att.countLeaveAsPresent ? 'การลานับเป็นเวลาเรียน' : 'การลาไม่นับเป็นเวลาเรียน'}`)));
    });
});
