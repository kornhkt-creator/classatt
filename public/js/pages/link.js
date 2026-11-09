// First-time account linking (student code + verify code, or teacher code + registration code)
import { apiPost } from '/js/api.js';
import { homeFor } from '/js/auth.js';
import { h, render } from '/js/dom.js';
import { avatar } from '/js/header.js';
import { initPage, runPage } from '/js/page.js';
import { field, setBusy, setFieldError } from '/js/ui.js';

runPage(async () => {
  const { me, main } = await initPage('unlinked', { nav: false });

  function intro() {
    return h('section', { class: 'welcome' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '13px' } },
        avatar(me, 'lg'),
        h('div', {},
          h('h1', { class: 'page-title' }, `ยินดีต้อนรับ ${me.displayName || ''}`.trim()),
          h('p', { class: 'sub' }, 'ผูกบัญชี LINE กับข้อมูลของโรงเรียน (ทำครั้งเดียว)'))));
  }

  function chooseRole() {
    render(main, intro(),
      h('div', { class: 'two-col' },
        h('button', { class: 'task', type: 'button', onclick: () => showForm('student') },
          h('div', { class: 'task-icon green', 'aria-hidden': 'true' }, '🎒'),
          h('div', { class: 'task-main' }, h('strong', {}, 'ฉันเป็นนักเรียน'), h('small', {}, 'ใช้รหัสนักเรียน + รหัสยืนยันจากครู'))),
        h('button', { class: 'task', type: 'button', onclick: () => showForm('teacher') },
          h('div', { class: 'task-icon', 'aria-hidden': 'true' }, '🧑‍🏫'),
          h('div', { class: 'task-main' }, h('strong', {}, 'ฉันเป็นครู'), h('small', {}, 'ใช้รหัสครู + รหัสลงทะเบียน')))),
      h('p', { class: 'notice mt' }, 'ระบบจะจำบัญชี LINE นี้ไว้ ครั้งต่อไปเปิดแอปแล้วเข้าใช้งานได้ทันที'));
  }

  function showForm(role) {
    const isStudent = role === 'student';
    const codeInput = h('input', { name: 'code', autocomplete: 'off', required: true, maxlength: '30',
      inputmode: isStudent ? 'numeric' : 'text', placeholder: isStudent ? 'เช่น 65001' : 'เช่น T001' });
    const secretInput = h('input', { name: 'secret', autocomplete: 'off', required: true, maxlength: '6',
      inputmode: isStudent ? 'numeric' : 'text', placeholder: isStudent ? 'ตัวเลข 6 หลัก' : '6 ตัวอักษร',
      style: isStudent ? null : { textTransform: 'uppercase' } });
    const message = h('p', { class: 'notice red', hidden: true, role: 'alert' });
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, 'ถัดไป');

    const form = h('form', { class: 'panel', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      message.hidden = true;
      setFieldError(codeInput, '');
      setFieldError(secretInput, '');
      const code = codeInput.value.replace(/\s+/g, '');
      const secret = secretInput.value.replace(/\s+/g, '');
      if (!code) return setFieldError(codeInput, isStudent ? 'กรุณากรอกรหัสนักเรียน' : 'กรุณากรอกรหัสครู');
      if (isStudent && !/^\d{6}$/.test(secret)) return setFieldError(secretInput, 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก');
      if (!isStudent && !/^[A-Za-z0-9]{6}$/.test(secret)) return setFieldError(secretInput, 'รหัสลงทะเบียนต้องมี 6 ตัวอักษร');
      const body = isStudent ? { studentCode: code, verifyCode: secret } : { teacherCode: code, regCode: secret.toUpperCase() };
      setBusy(submit, true, 'กำลังตรวจสอบ...');
      try {
        const res = await apiPost('link', role, { ...body, confirm: false });
        showConfirm(role, body, res.preview);
      } catch (err) {
        message.textContent = err.message;
        message.hidden = false;
      } finally {
        setBusy(submit, false);
      }
    } },
      h('h2', { class: 'lg' }, isStudent ? 'ผูกบัญชีนักเรียน' : 'ผูกบัญชีครู'),
      field(isStudent ? 'รหัสนักเรียน' : 'รหัสครู', codeInput),
      field(isStudent ? 'รหัสยืนยัน 6 หลัก' : 'รหัสลงทะเบียน', secretInput,
        { hint: isStudent ? 'ขอรหัสยืนยันได้จากครูประจำชั้น' : 'ขอรหัสลงทะเบียนได้จากผู้ดูแลระบบ' }),
      message,
      h('div', { class: 'actions' }, submit,
        h('button', { class: 'btn ghost block', type: 'button', onclick: chooseRole }, 'ย้อนกลับ')));
    render(main, intro(), form);
    codeInput.focus();
  }

  function showConfirm(role, body, preview) {
    const who = role === 'student'
      ? `${preview.prefix}${preview.first_name} ${preview.last_name} ${preview.classroom}${preview.number ? ` เลขที่ ${preview.number}` : ''}`
      : `${preview.name} (รหัสครู ${preview.teacher_code})`;
    const message = h('p', { class: 'notice red', hidden: true, role: 'alert' });
    const yes = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      setBusy(yes, true, 'กำลังผูกบัญชี...');
      message.hidden = true;
      try {
        await apiPost('link', role, { ...body, confirm: true });
        location.replace(homeFor(role));
      } catch (err) {
        message.textContent = err.message;
        message.hidden = false;
        setBusy(yes, false);
      }
    } }, 'ใช่ ยืนยัน');
    render(main, intro(), h('section', { class: 'panel center' },
      h('div', { class: 'attendance-icon', 'aria-hidden': 'true' }, role === 'student' ? '🎒' : '🧑‍🏫'),
      h('p', { class: 'muted' }, 'กรุณาตรวจสอบว่าเป็นข้อมูลของคุณ'),
      h('h2', { class: 'lg' }, `คุณคือ ${who} ใช่หรือไม่?`),
      message,
      h('div', { class: 'actions', style: { justifyContent: 'center' } },
        yes, h('button', { class: 'btn ghost', type: 'button', onclick: () => showForm(role) }, 'ไม่ใช่'))));
    yes.focus();
  }

  chooseRole();
});
