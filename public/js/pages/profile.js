import { apiGet } from '/js/api.js';
import { openSheet } from '/js/bottom-sheet.js';
import { h, render } from '/js/dom.js';
import { avatar } from '/js/header.js';
import { closeApp, isInLineApp } from '/js/liff.js';
import { initPage, runPage } from '/js/page.js';

function readonlyField(label, value) {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('input', { value, disabled: true, 'aria-label': label }));
}

function helpContent(isStudent) {
  const items = isStudent
    ? [
      ['เช็กชื่อเข้าเรียน', 'สแกน QR บนจอครูด้วยกล้อง LINE, กดปุ่ม "สแกน QR Code" ในแอป หรือกด "กรอกรหัส" แล้วพิมพ์ตัวเลข 6 หลักใต้ QR'],
      ['แจ้งส่งงาน', 'เมนู "งานของฉัน" → เลือกงาน → พิมพ์หมายเหตุหรือวางลิงก์งาน → กด "แจ้งส่งงาน"'],
      ['เปลี่ยนมือถือหรือบัญชี LINE', 'แจ้งครูประจำชั้นให้ยกเลิกการผูกบัญชีเดิม แล้วเปิดแอปเพื่อผูกใหม่'],
    ]
    : [
      ['สร้างงาน', 'เมนู "งาน" → "＋ สร้างงานใหม่" เลือกได้หลายห้องพร้อมกัน'],
      ['เช็กชื่อ', 'เมนู "เช็กชื่อ" → เลือกวิชาและห้อง → "สร้าง QR Code" แล้วเปิดจอให้นักเรียนสแกน'],
      ['นักเรียนเปลี่ยนบัญชี LINE', 'ใน Supabase Table Editor ล้างช่อง line_user_id ของนักเรียนคนนั้น แล้วให้ผูกใหม่'],
    ];
  return h('div', { class: 'stack' }, items.map(([title, text]) => h('div', {}, h('strong', {}, title), h('p', { class: 'muted small', style: { margin: '2px 0 0' } }, text))));
}

runPage(async () => {
  const { me, main } = await initPage('linked');
  const isStudent = me.role === 'student';
  let roleLine;
  let extra;
  if (isStudent) {
    const s = me.student;
    roleLine = `นักเรียน · ${s.classroom}${s.number ? ` เลขที่ ${s.number}` : ''}`;
    extra = [readonlyField('ห้องเรียน', s.classroom), readonlyField('รหัสนักเรียน', s.student_code)];
  } else {
    let subjects = [];
    let rooms = [];
    try {
      ({ subjects, rooms } = await apiGet('teacher', 'subjects'));
    } catch { /* optional */ }
    roleLine = `ครูผู้สอน${subjects.length ? ` · ${subjects.slice(0, 3).join(', ')}` : ''}`;
    extra = [readonlyField('ห้องที่สอน', rooms.length ? rooms.join(', ') : '-'), readonlyField('รหัสครู', me.teacher.teacher_code)];
  }

  const inLine = await isInLineApp();
  render(main,
    h('div', { class: 'section-head first' }, h('h1', { class: 'page-title' }, 'โปรไฟล์')),
    h('section', { class: 'panel' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '13px' } },
        avatar(me, 'lg'),
        h('div', {}, h('strong', {}, me.name), h('div', { class: 'muted' }, roleLine))),
      readonlyField('บัญชี LINE', `เชื่อมต่อ LINE แล้ว${me.displayName ? ` (${me.displayName})` : ''}`),
      extra,
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => openSheet('วิธีใช้งาน / ติดต่อครู', helpContent(isStudent)) }, 'วิธีใช้งาน / ติดต่อครู'),
        inLine ? h('button', { class: 'btn secondary', type: 'button', onclick: closeApp }, 'ปิดแอป') : null)));
});
