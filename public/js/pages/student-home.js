import { apiGet } from '/js/api.js';
import { checkinButtons, errorCard, resultCard } from '/js/checkin.js';
import { h, render } from '/js/dom.js';
import { formatTime, todayLabel } from '/js/format.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { attendancePill, emptyState, progressBar, stat } from '/js/ui.js';
import { taskItem } from '/js/student-ui.js';

function encouragement(pct) {
  if (pct >= 80) return 'ทำได้ดีมาก! อย่าลืมส่งงานที่เหลือก่อนกำหนด';
  if (pct >= 50) return 'อีกนิดเดียว ส่งงานที่ค้างให้ครบนะ';
  return 'มีงานค้างหลายชิ้น ลองเริ่มจากงานที่ใกล้ถึงกำหนดก่อน';
}

runPage(async () => {
  const { main } = await initPage('student');

  const load = () => loadInto(main, () => apiGet('student', 'dashboard'), (d) => {
    const s = d.taskStats;
    const pct = s.total ? Math.round((s.approved / s.total) * 100) : 0;
    const resultHolder = h('div');
    const onResult = (res) => { render(resultHolder, resultCard(res)); setTimeout(load, 2000); };
    const onError = (err) => render(resultHolder, errorCard(err));
    const [scanBtn, codeBtn] = checkinButtons({ onResult, onError });

    let attendanceBox;
    if (d.openAttendance.length) {
      const o = d.openAttendance[0];
      attendanceBox = [
        h('strong', {}, `มีการเช็กชื่อวิชา${o.subject}`),
        h('p', {}, `${o.teacherName ? `${o.teacherName} · ` : ''}สแกน QR Code ที่ครูแสดง หรือกรอกรหัส 6 หลัก`),
        h('div', { class: 'actions', style: { marginTop: 0 } }, scanBtn, codeBtn)];
    } else if (d.checkedToday.length) {
      const c = d.checkedToday[0];
      attendanceBox = [
        h('strong', {}, `เช็กชื่อแล้ว ✓ ${c.subject} · ${formatTime(c.checkedAt)} น.`),
        h('p', {}, attendancePill(c.status), d.checkedToday.length > 1 ? ` วันนี้เช็กแล้ว ${d.checkedToday.length} วิชา` : ''),
        h('div', { class: 'actions', style: { marginTop: 0 } }, scanBtn, codeBtn)];
    } else {
      attendanceBox = [
        h('strong', {}, 'พร้อมเช็กชื่อหรือยัง?'),
        h('p', {}, 'สแกน QR Code ที่ครูแสดงหน้าชั้นเรียน เพื่อบันทึกเวลาเข้าเรียน'),
        h('div', { class: 'actions', style: { marginTop: 0 } }, scanBtn, codeBtn)];
    }

    render(main,
      h('section', { class: 'welcome' },
        h('div', {},
          h('h1', {}, `สวัสดี ${d.student.firstName} 👋`),
          h('p', { class: 'sub' }, 'ดูงานที่ได้รับมอบหมายและเช็กชื่อเข้าเรียนได้ที่นี่')),
        h('div', { class: 'date' }, `📅 วันนี้ · ${todayLabel()}`)),
      h('div', { class: 'stats' },
        stat(s.total, 'งานทั้งหมด', 'green'),
        stat(s.approved, 'ส่งแล้ว'),
        stat(s.pending, 'รอส่ง', 'purple'),
        stat(s.submitted, 'รอตรวจ')),
      resultHolder,
      h('div', { class: 'grid' },
        h('section', { class: 'panel' },
          h('div', { class: 'section-head first' },
            h('h2', { class: 'lg' }, 'งานที่ต้องทำ'),
            h('a', { class: 'link-btn', href: '/student/tasks' }, 'ดูทั้งหมด →')),
          d.topTasks.length ? h('div', { class: 'task-list' }, d.topTasks.map(taskItem)) : emptyState('ไม่มีงานค้าง เยี่ยมมาก! 🎉', '🎉')),
        h('section', { class: 'panel' },
          h('h2', { class: 'lg' }, 'เช็กชื่อเข้าเรียน'),
          h('div', { class: 'attendance-box' }, h('div', { class: 'attendance-icon', 'aria-hidden': 'true' }, '▦'), attendanceBox),
          h('p', { class: 'muted small', style: { margin: '12px 0 0' } }, 'ระบบจะยืนยันตัวตนผ่าน LINE ก่อนบันทึกข้อมูล'))),
      s.total ? [
        h('div', { class: 'section-head' }, h('h2', {}, 'ความคืบหน้าของฉัน')),
        h('section', { class: 'panel' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '9px' } },
            h('strong', {}, `ส่งงานแล้ว ${s.approved} จาก ${s.total} งาน`),
            h('strong', { style: { color: 'var(--green-dark)' } }, `${pct}%`)),
          progressBar(pct, 'ความคืบหน้าการส่งงาน'),
          h('p', { class: 'muted small', style: { margin: '9px 0 0' } }, encouragement(pct)),
          s.overdue ? h('p', { class: 'notice red mt' }, `มีงานเลยกำหนด ${s.overdue} งาน`) : null),
      ] : null);
  });
  await load();
});
