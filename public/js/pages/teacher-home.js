import { apiGet } from '/js/api.js';
import { h, render } from '/js/dom.js';
import { formatThai, todayLabel } from '/js/format.js';
import { autoRefresh, initPage, loadInto, runPage } from '/js/page.js';
import { emptyState, pill, progressBar, stat, subjectIcon } from '/js/ui.js';

function assignmentItem(a) {
  return h('a', { class: 'task', href: `/teacher/assignment?id=${encodeURIComponent(a.id)}` },
    h('div', { class: 'task-icon', 'aria-hidden': 'true' }, subjectIcon(a.subject)),
    h('div', { class: 'task-main' },
      h('strong', {}, a.title),
      h('small', {}, `${a.subject} · ${a.classroom} · กำหนดส่ง ${formatThai(a.due_at)}`)),
    a.submitted > 0 ? pill('review', `รอตรวจ ${a.submitted}`)
      : a.overdue ? pill('late', 'เลยกำหนด')
        : pill(a.done >= a.total && a.total ? 'done' : 'todo', `ส่ง ${a.done}/${a.total}`));
}

runPage(async () => {
  const { main } = await initPage('teacher');

  const load = () => loadInto(main, () => apiGet('teacher', 'dashboard'), (d) => {
    const ts = d.todaySession;
    const w = d.workStats;
    const stats = ts
      ? [stat(ts.counts.total, 'นักเรียนทั้งหมด', 'green'), stat(ts.counts.present, 'มาเรียน'), stat(ts.counts.late, 'มาสาย', 'purple'), stat(ts.counts.notYet, 'ยังไม่เช็กชื่อ')]
      : [stat(w.openAssignments, 'งานเปิดรับ', 'green'), stat(w.toReview, 'รอตรวจ'), stat(w.overdueAssignments, 'งานเลยกำหนด', 'purple'), stat(w.classrooms, 'ห้องที่สอน')];

    const attendanceBox = ts && ts.isOpen
      ? [h('strong', {}, `กำลังเช็กชื่อ ${ts.classroom} · ${ts.subject}`),
        h('p', {}, `เช็กแล้ว ${ts.counts.checked}/${ts.counts.total} คน`),
        h('div', { class: 'actions', style: { marginTop: 0 } },
          h('a', { class: 'btn primary', href: `/teacher/attendance/live?id=${encodeURIComponent(ts.id)}` }, 'เปิดจอ QR'),
          h('a', { class: 'btn secondary', href: `/teacher/attendance/session?id=${encodeURIComponent(ts.id)}` }, 'จัดการรายชื่อ'))]
      : [h('strong', {}, 'เริ่มเช็กชื่อในคาบเรียน'),
        h('p', {}, 'สร้าง QR Code ให้กับนักเรียนในห้องสแกน'),
        h('a', { class: 'btn primary', href: '/teacher/attendance/?new=1' }, 'สร้าง QR Code')];

    const progress = ts
      ? { label: `นักเรียนเช็กชื่อแล้ว ${ts.counts.checked} จาก ${ts.counts.total} คน`, value: ts.counts.total ? (ts.counts.checked / ts.counts.total) * 100 : 0,
        hint: 'ติดตามนักเรียนที่ยังไม่เช็กชื่อได้จากหน้า "จัดการรายชื่อ"' }
      : { label: `ตรวจงานแล้ว ${w.reviewed} จาก ${w.sent} ชิ้นที่ส่งมา`, value: w.sent ? (w.reviewed / w.sent) * 100 : 0,
        hint: w.toReview ? `มีงานรอตรวจ ${w.toReview} ชิ้น` : 'ไม่มีงานค้างตรวจ 🎉' };

    render(main,
      h('section', { class: 'welcome' },
        h('div', {}, h('h1', {}, `สวัสดีคุณครู${d.teacher.name.replace(/^ครู/, '')} 👋`),
          h('p', { class: 'sub' }, 'จัดการงาน เช็กชื่อ และติดตามนักเรียนในห้องเรียน')),
        h('div', { class: 'date' }, `📅 วันนี้ · ${todayLabel()}`)),
      h('div', { class: 'stats' }, stats),
      ts ? h('p', { class: 'stats-caption' }, `เช็กชื่อวันนี้: ${ts.classroom} · ${ts.subject}${ts.isOpen ? '' : ' (ปิดรอบแล้ว)'}`) : null,
      h('div', { class: 'grid' },
        h('section', { class: 'panel' },
          h('div', { class: 'section-head first' },
            h('h2', { class: 'lg' }, 'งานที่มอบหมายล่าสุด'),
            h('a', { class: 'link-btn', href: '/teacher/assignments' }, 'จัดการงานทั้งหมด →')),
          d.recentAssignments.length ? h('div', { class: 'task-list' }, d.recentAssignments.map(assignmentItem)) : emptyState('ยังไม่มีงาน'),
          h('div', { class: 'actions' },
            h('a', { class: 'btn primary', href: '/teacher/new' }, '＋ สร้างงานใหม่'),
            h('a', { class: 'btn secondary', href: '/teacher/assignments?filter=review' }, 'ตรวจงานที่รอตรวจ'))),
        h('section', { class: 'panel' },
          h('h2', { class: 'lg' }, 'เช็กชื่อเข้าเรียน'),
          h('div', { class: 'attendance-box' }, h('div', { class: 'attendance-icon', 'aria-hidden': 'true' }, '▦'), attendanceBox),
          h('p', { class: 'muted small', style: { margin: '12px 0 0' } }, 'เลือกวิชาและห้องเรียนก่อนเริ่มเช็กชื่อ'))),
      h('div', { class: 'section-head' }, h('h2', {}, 'ความคืบหน้า')),
      h('section', { class: 'panel' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '9px' } },
          h('strong', {}, progress.label), h('strong', { style: { color: 'var(--green-dark)' } }, `${Math.round(progress.value)}%`)),
        progressBar(progress.value, progress.label),
        h('p', { class: 'muted small', style: { margin: '9px 0 0' } }, progress.hint)));
  });
  autoRefresh(load);
  await load();
});
