import { apiGet, apiPost } from '/js/api.js';
import { h, render } from '/js/dom.js';
import { addDays, dayKey } from '/js/format.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { field, setBusy, setFieldError, toast } from '/js/ui.js';

function counter(input, max) {
  const el = h('div', { class: 'counter' }, `0/${max}`);
  const update = () => { el.textContent = `${input.value.length}/${max}`; };
  input.addEventListener('input', update);
  update();
  return el;
}

runPage(async () => {
  const { main } = await initPage('teacher');

  await loadInto(main, () => Promise.all([apiGet('teacher', 'classrooms'), apiGet('teacher', 'subjects')]), ([{ classrooms }, { subjects }]) => {
    const title = h('input', { name: 'title', maxlength: '100', required: true, placeholder: 'เช่น แบบฝึกหัดบทที่ 1' });
    const description = h('textarea', { name: 'description', maxlength: '1000', placeholder: 'รายละเอียด / วิธีส่ง (ไม่บังคับ)' });
    const subject = h('input', { name: 'subject', maxlength: '50', required: true, list: 'subject-list', placeholder: 'เช่น คณิตศาสตร์' });
    const dueDate = h('input', { type: 'date', name: 'dueDate', required: true, value: addDays(dayKey(), 7) });
    const dueTime = h('input', { type: 'time', name: 'dueTime', required: true, value: '23:59' });
    const pastWarn = h('p', { class: 'notice', hidden: true }, 'วันส่งอยู่ในอดีต — บันทึกได้ แต่นักเรียนที่ส่งหลังจากนี้จะถูกนับว่าส่งช้า');
    const roomBoxes = classrooms.map((room) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: room }), room));
    const roomsWrap = h('div', { class: 'field' },
      h('span', { class: 'label', id: 'rooms-label' }, 'ห้องเรียน (เลือกได้หลายห้อง)'),
      classrooms.length ? h('div', { class: 'checks', role: 'group', 'aria-labelledby': 'rooms-label' }, roomBoxes)
        : h('p', { class: 'notice red' }, 'ยังไม่มีข้อมูลนักเรียนในระบบ กรุณาเพิ่มนักเรียนใน Supabase ก่อน'),
      h('span', { class: 'error', 'aria-live': 'polite' }));
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'บันทึกงาน');

    const checkPast = () => {
      const due = new Date(`${dueDate.value}T${dueTime.value || '23:59'}:00+07:00`);
      pastWarn.hidden = !(dueDate.value && due.getTime() < Date.now());
    };
    dueDate.addEventListener('change', checkPast);
    dueTime.addEventListener('change', checkPast);

    const form = h('form', { class: 'panel', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const rooms = roomBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      let ok = true;
      for (const [input, msg] of [[title, 'กรุณากรอกชื่องาน'], [subject, 'กรุณากรอกวิชา'], [dueDate, 'กรุณาเลือกวันส่ง']]) {
        const bad = !input.value.trim();
        setFieldError(input, bad ? msg : '');
        if (bad) ok = false;
      }
      roomsWrap.classList.toggle('invalid', !rooms.length);
      roomsWrap.querySelector('.error').textContent = rooms.length ? '' : 'กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง';
      if (!rooms.length) ok = false;
      if (!ok) return;
      setBusy(submit, true);
      try {
        const res = await apiPost('teacher', 'create-assignment', {
          title: title.value, description: description.value, subject: subject.value,
          classrooms: rooms, dueDate: dueDate.value, dueTime: dueTime.value || '23:59',
        });
        toast(`สร้างงานแล้ว ${res.created} ห้อง`);
        setTimeout(() => location.assign('/teacher/assignments'), 600);
      } catch (err) {
        toast(err.message, 'error');
        setBusy(submit, false);
      }
    } },
      h('h1', { class: 'page-title' }, 'สร้างงานใหม่'),
      field('ชื่องาน', title), counter(title, 100),
      field('รายวิชา', subject),
      h('datalist', { id: 'subject-list' }, subjects.map((s) => h('option', { value: s }))),
      field('รายละเอียด', description), counter(description, 1000),
      roomsWrap,
      h('div', { class: 'row' }, field('วันส่ง', dueDate), field('เวลาส่ง', dueTime)),
      pastWarn,
      h('div', { class: 'actions' }, submit, h('a', { class: 'btn ghost', href: '/teacher/assignments' }, 'ยกเลิก')));
    render(main, form);
    title.focus();
  });
});
