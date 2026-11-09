import { apiGet, apiPost } from '/js/api.js';
import { h, param, render } from '/js/dom.js';
import { formatDateShort, formatTime } from '/js/format.js';
import { autoRefresh, initPage, loadInto, runPage } from '/js/page.js';
import { emptyState, field, pill, setBusy, setFieldError, toast } from '/js/ui.js';

const LATE_OPTIONS = [5, 10, 15, 20, 30];

function sessionItem(s) {
  const c = s.counts;
  const label = [s.subject, s.title].filter(Boolean).join(' · ');
  return h('div', { class: 'task' },
    h('div', { class: `task-icon ${s.status === 'open' ? 'green' : ''}`.trim(), 'aria-hidden': 'true' }, '▦'),
    h('div', { class: 'task-main' },
      h('strong', {}, `${s.classroom} · ${label}`),
      h('small', {}, `${formatDateShort(s.starts_at)} ${formatTime(s.starts_at)} น. · มา ${c.present} สาย ${c.late} ขาด ${c.absent} ลา ${c.leave + c.sick}${s.status === 'open' ? ` · ยังไม่เช็ก ${c.notYet}` : ''}`),
      h('div', { class: 'actions', style: { marginTop: '8px' } },
        s.status === 'open' ? h('a', { class: 'btn primary sm', href: `/teacher/attendance/live?id=${encodeURIComponent(s.id)}` }, 'เปิดจอ QR') : null,
        h('a', { class: 'btn ghost sm', href: `/teacher/attendance/session?id=${encodeURIComponent(s.id)}` }, 'จัดการรายชื่อ'))),
    s.status === 'open' ? pill(s.expired ? 'todo' : 'done', s.expired ? 'ค้างเปิด' : 'กำลังเปิด') : pill('muted', 'ปิดแล้ว'));
}

runPage(async () => {
  const { main } = await initPage('teacher');

  const load = () => loadInto(main, () => Promise.all([
    apiGet('teacher', 'classrooms'), apiGet('teacher', 'subjects'), apiGet('teacher', 'attendance-sessions'),
  ]), ([{ classrooms }, { subjects }, { items }]) => {
    const subject = h('input', { maxlength: '50', list: 'att-subjects', placeholder: 'เช่น คณิตศาสตร์', required: true });
    const room = h('select', { required: true },
      h('option', { value: '' }, '— เลือกห้อง —'), classrooms.map((r) => h('option', { value: r }, r)));
    const title = h('input', { maxlength: '50', placeholder: 'เช่น คาบ 3 (ไม่บังคับ)' });
    const late = h('select', {}, LATE_OPTIONS.map((m) => h('option', { value: String(m), selected: m === 10 }, `${m} นาที`)));
    const create = h('button', { class: 'btn purple', type: 'submit' }, 'สร้าง QR Code');
    const msg = h('div');

    const form = h('form', { class: 'panel', id: 'new-session', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      render(msg);
      setFieldError(subject, subject.value.trim() ? '' : 'กรุณากรอกรายวิชา');
      setFieldError(room, room.value ? '' : 'กรุณาเลือกห้องเรียน');
      if (!subject.value.trim() || !room.value) return;
      setBusy(create, true, 'กำลังสร้าง...');
      try {
        const { session } = await apiPost('teacher', 'create-attendance', {
          classroom: room.value, subject: subject.value, title: title.value, lateAfterMinutes: Number(late.value),
        });
        location.assign(`/teacher/attendance/live?id=${encodeURIComponent(session.id)}`);
      } catch (err) {
        setBusy(create, false);
        if (err.code === 'session_open' && err.details?.sessionId) {
          render(msg, h('p', { class: 'notice' }, err.message, ' ',
            h('a', { href: `/teacher/attendance/live?id=${encodeURIComponent(err.details.sessionId)}` }, 'ไปที่รอบเดิม →')));
        } else {
          toast(err.message, 'error');
        }
      }
    } },
      h('h2', { class: 'lg' }, 'สร้าง QR Code สำหรับเช็กชื่อ'),
      field('รายวิชา', subject),
      h('datalist', { id: 'att-subjects' }, subjects.map((s) => h('option', { value: s }))),
      field('ห้องเรียน', room),
      field('ชื่อคาบ', title),
      field('กำหนดมาสายหลัง (นาที)', late, { hint: 'นักเรียนที่เช็กหลังเวลานี้จะถูกบันทึกว่ามาสาย' }),
      msg,
      create);

    render(main,
      h('div', { class: 'section-head first' },
        h('div', {}, h('h1', { class: 'page-title' }, 'เช็กชื่อเข้าเรียน'), h('p', { class: 'sub' }, 'เปิดรอบเช็กชื่อแล้วให้นักเรียนสแกน QR')),
        h('a', { class: 'link-btn', href: '/teacher/attendance/report' }, 'รายงาน →')),
      h('div', { class: 'two-col' },
        form,
        h('section', { class: 'panel' },
          h('h2', { class: 'lg' }, 'รอบเช็กชื่อล่าสุด'),
          items.length ? h('div', { class: 'task-list' }, items.map(sessionItem)) : emptyState('ยังไม่มีรอบเช็กชื่อใน 14 วันที่ผ่านมา', '▦'))));

    if (param('new') === '1') {
      form.scrollIntoView({ behavior: 'smooth' });
      subject.focus();
    }
  });
  autoRefresh(load);
  await load();
});
