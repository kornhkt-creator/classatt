import { apiGet } from '/js/api.js';
import { checkinButtons, errorCard, resultCard } from '/js/checkin.js';
import { h, render } from '/js/dom.js';
import { formatDateShort, formatTime } from '/js/format.js';
import { autoRefresh, initPage, loadInto, runPage } from '/js/page.js';
import { attendancePill, emptyState, progressBar, toast } from '/js/ui.js';
import { subjectTable } from '/js/student-ui.js';

runPage(async () => {
  const { main } = await initPage('student');
  const resultHolder = h('div');

  const load = () => loadInto(main, () => Promise.all([apiGet('student', 'attendance-open'), apiGet('student', 'attendance')]),
    ([open, history]) => {
      const onResult = (res) => {
        render(resultHolder, resultCard(res));
        toast(res.alreadyChecked ? 'เช็กชื่อรอบนี้ไปแล้ว' : 'เช็กชื่อสำเร็จ');
        setTimeout(load, 1500);
      };
      const onError = (err) => render(resultHolder, errorCard(err));
      const [scanBtn, codeBtn] = checkinButtons({ onResult, onError, scanLabel: 'เปิดตัวสแกน QR' });
      const first = open.items[0];
      const risky = history.subjects.filter((s) => s.risk);

      render(main,
        h('div', { class: 'section-head first' }, h('h1', { class: 'page-title' }, 'เช็กชื่อเข้าเรียน')),
        resultHolder,
        h('div', { class: 'two-col mt' },
          h('section', { class: 'panel' },
            h('h2', {}, 'สแกน QR Code เพื่อเช็กชื่อ'),
            h('div', { class: 'attendance-box' },
              h('div', { class: 'attendance-icon', 'aria-hidden': 'true' }, first ? '📋' : '▦'),
              first
                ? [h('strong', {}, `มีการเช็กชื่อวิชา${first.subject}${first.teacherName ? ` (${first.teacherName})` : ''}`),
                  h('p', {}, open.items.length > 1 ? `และอีก ${open.items.length - 1} วิชา` : 'สแกน QR บนจอครู หรือกรอกรหัส 6 หลัก')]
                : [h('strong', {}, 'ยังไม่มีการเช็กชื่อตอนนี้'), h('p', {}, 'เมื่อครูเปิดรอบเช็กชื่อ ให้สแกน QR Code ที่ครูแสดงหน้าชั้นเรียน')],
              h('div', { class: 'actions', style: { marginTop: 0 } }, scanBtn, codeBtn)),
            h('p', { class: 'notice mt' }, 'ระบบจะยืนยันตัวตนผ่าน LINE ก่อนบันทึกข้อมูล')),
          h('section', { class: 'panel' },
            h('h2', {}, 'ประวัติการเข้าเรียน'),
            history.recent.length
              ? h('div', { class: 'task-list' }, history.recent.map((r) => h('div', { class: 'task' },
                h('div', { class: 'task-icon green', 'aria-hidden': 'true' }, '✓'),
                h('div', { class: 'task-main' },
                  h('strong', {}, `${formatDateShort(r.starts_at)} · ${r.subject}`),
                  h('small', {}, `${r.title ? `${r.title} · ` : ''}${formatTime(r.checked_at)} น.`)),
                attendancePill(r.status))))
              : emptyState('ยังไม่มีประวัติการเข้าเรียน', '📋'))),
        h('section', { class: 'panel' },
          h('h2', {}, 'สรุปเวลาเรียนรายวิชา'),
          history.overall.total ? [
            h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
              h('strong', {}, 'เวลาเรียนรวม'), h('strong', {}, `${history.overall.percent ?? 0}%`)),
            progressBar(history.overall.percent || 0, 'เปอร์เซ็นต์เวลาเรียนรวม', (history.overall.percent ?? 100) < history.minPercent ? 'red' : ''),
          ] : null,
          risky.length ? h('p', { class: 'notice red mt' }, `เวลาเรียนต่ำกว่า ${history.minPercent}% ในวิชา ${risky.map((s) => s.subject).join(', ')} — ระวังไม่มีสิทธิ์สอบ`) : null,
          h('div', { class: 'mt' }, subjectTable(history.subjects, history.minPercent)),
          h('p', { class: 'muted small' }, history.countLeaveAsPresent ? 'การลานับเป็นเวลาเรียน' : 'การลาไม่นับเป็นเวลาเรียน')));
    });
  autoRefresh(load);
  await load();
});
