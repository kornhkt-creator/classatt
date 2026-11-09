import { apiGet, apiPost } from '/js/api.js';
import { confirmSheet } from '/js/bottom-sheet.js';
import { h, param, render } from '/js/dom.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { field, pill, setBusy, setFieldError, toast } from '/js/ui.js';

runPage(async () => {
  const { main } = await initPage('teacher');
  const id = param('id');

  const load = () => loadInto(main, () => Promise.all([apiGet('teacher', 'assignment', { id }), apiGet('teacher', 'subjects')]), ([{ assignment: a }, { subjects }]) => {
    const title = h('input', { maxlength: '100', value: a.title, required: true });
    const description = h('textarea', { maxlength: '1000' });
    description.value = a.description || '';
    const subject = h('input', { maxlength: '50', value: a.subject, list: 'subject-list', required: true });
    const dueDate = h('input', { type: 'date', value: a.dueDate, required: true });
    const dueTime = h('input', { type: 'time', value: a.dueTime, required: true });
    const save = h('button', { class: 'btn primary', type: 'submit' }, 'บันทึกการแก้ไข');
    const isOpen = a.status === 'open';

    const toggle = h('button', { class: `btn ${isOpen ? 'danger' : 'secondary'}`, type: 'button', onclick: async () => {
      const ok = await confirmSheet(isOpen ? 'ปิดรับงานนี้?' : 'เปิดรับงานอีกครั้ง?',
        isOpen ? 'นักเรียนจะแจ้งส่งงานนี้ไม่ได้อีก (ข้อมูลการส่งเดิมยังอยู่)' : 'นักเรียนจะแจ้งส่งงานนี้ได้อีกครั้ง',
        isOpen ? 'ปิดรับงาน' : 'เปิดรับอีกครั้ง', isOpen ? 'danger' : 'primary');
      if (!ok) return;
      setBusy(toggle, true);
      try {
        await apiPost('teacher', 'update-assignment', { status: isOpen ? 'closed' : 'open' }, { id });
        toast(isOpen ? 'ปิดรับงานแล้ว' : 'เปิดรับงานอีกครั้งแล้ว');
        load();
      } catch (err) {
        toast(err.message, 'error');
        setBusy(toggle, false);
      }
    } }, isOpen ? 'ปิดรับงาน' : 'เปิดรับอีกครั้ง');

    render(main,
      h('div', { class: 'section-head first' },
        h('h1', { class: 'page-title' }, 'แก้ไขงาน'),
        h('a', { class: 'link-btn', href: `/teacher/assignment?id=${encodeURIComponent(id)}` }, 'ไปหน้าติดตามการส่ง →')),
      h('form', { class: 'panel', novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        let ok = true;
        for (const [input, msg] of [[title, 'กรุณากรอกชื่องาน'], [subject, 'กรุณากรอกวิชา'], [dueDate, 'กรุณาเลือกวันส่ง']]) {
          const bad = !input.value.trim();
          setFieldError(input, bad ? msg : '');
          if (bad) ok = false;
        }
        if (!ok) return;
        setBusy(save, true);
        try {
          await apiPost('teacher', 'update-assignment', {
            title: title.value, description: description.value, subject: subject.value, dueDate: dueDate.value, dueTime: dueTime.value,
          }, { id });
          toast('บันทึกแล้ว');
          setBusy(save, false);
        } catch (err) {
          toast(err.message, 'error');
          setBusy(save, false);
        }
      } },
        h('p', {}, 'ห้อง ', h('strong', {}, a.classroom), ' · ', isOpen ? pill('done', 'เปิดรับ') : pill('muted', 'ปิดแล้ว')),
        field('ชื่องาน', title),
        field('รายวิชา', subject),
        h('datalist', { id: 'subject-list' }, subjects.map((s) => h('option', { value: s }))),
        field('รายละเอียด', description),
        h('div', { class: 'row' }, field('วันส่ง', dueDate), field('เวลาส่ง', dueTime)),
        h('div', { class: 'actions' }, save, h('a', { class: 'btn ghost', href: '/teacher/assignments' }, 'กลับ'))),
      h('section', { class: 'panel' },
        h('h2', {}, isOpen ? 'ปิดรับงาน' : 'งานนี้ปิดรับแล้ว'),
        h('p', { class: 'muted small' }, 'ระบบไม่มีการลบงาน เพื่อไม่ให้ข้อมูลการส่งของนักเรียนหาย'),
        toggle));
  });
  await load();
});
