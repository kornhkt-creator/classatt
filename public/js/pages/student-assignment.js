import { apiGet, apiPost } from '/js/api.js';
import { h, param, render } from '/js/dom.js';
import { formatThai, relativeDue } from '/js/format.js';
import { openExternal } from '/js/liff.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { field, pill, setBusy, setFieldError, taskBadge, toast } from '/js/ui.js';

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function counter(input, max) {
  const el = h('div', { class: 'counter' });
  const update = () => { el.textContent = `${input.value.length}/${max}`; };
  input.addEventListener('input', update);
  update();
  return el;
}

runPage(async () => {
  const { main } = await initPage('student');
  const id = param('id');

  const draw = (data, justSent = false) => {
    const { assignment: a, item, submission: s } = data;
    const overdue = new Date(a.due_at).getTime() < Date.now();
    const note = h('textarea', { maxlength: '500', placeholder: 'เช่น ส่งสมุดที่โต๊ะครูแล้ว' });
    note.value = s?.note || '';
    const link = h('input', { type: 'url', maxlength: '500', placeholder: 'https://drive.google.com/...', inputmode: 'url' });
    link.value = s?.link_url || '';
    const send = h('button', { class: 'btn primary block', type: 'submit' }, s && s.status !== 'not_submitted' ? 'แจ้งส่งงานอีกครั้ง' : 'แจ้งส่งงาน');

    const form = data.canSubmit ? h('form', { class: 'panel', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      setFieldError(note, '');
      setFieldError(link, '');
      const noteV = note.value.trim();
      const linkV = link.value.trim();
      if (!noteV && !linkV) return setFieldError(note, 'กรุณากรอกหมายเหตุหรือลิงก์งานอย่างน้อย 1 ช่อง');
      if (linkV && !isHttpUrl(linkV)) return setFieldError(link, 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
      setBusy(send, true, 'กำลังส่ง...');
      try {
        const next = await apiPost('student', 'submit', { note: noteV, linkUrl: linkV }, { id });
        draw(next, true);
      } catch (err) {
        toast(err.message, 'error');
        setBusy(send, false);
      }
    } },
      h('h2', { class: 'lg' }, 'แจ้งส่งงาน'),
      overdue ? h('p', { class: 'notice red' }, 'เลยกำหนดส่งแล้ว ยังส่งได้แต่จะถูกบันทึกว่าส่งช้า') : null,
      field('หมายเหตุ', note), counter(note, 500),
      field('ลิงก์งาน (ไม่บังคับ)', link, { hint: 'เช่น ลิงก์ Google Drive หรือ Canva' }),
      send) : h('p', { class: 'notice green' }, data.lockReason === 'ครูตรวจแล้ว' ? '✓ ครูตรวจแล้ว' : data.lockReason);

    render(main,
      justSent ? h('div', { class: 'result ok', role: 'status' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, '✅'),
        h('h1', {}, 'แจ้งส่งงานเรียบร้อย'), h('p', { class: 'muted' }, 'รอครูตรวจ')) : null,
      h('section', { class: 'panel' + (justSent ? ' mt' : '') },
        h('div', { class: 'section-head first' }, h('h1', { class: 'page-title' }, a.title), taskBadge(item)),
        h('p', { class: 'sub' }, `${a.subject} · ${a.teacherName}`),
        h('p', {}, `กำหนดส่ง ${formatThai(a.due_at)} · `, h('strong', {}, relativeDue(a.due_at))),
        a.description ? h('p', { class: 'pre' }, a.description) : null,
        s?.status === 'revise' && s.teacher_comment ? h('p', { class: 'notice' }, `↺ ครูให้แก้ไข: ${s.teacher_comment}`) : null,
        s && s.status !== 'not_submitted' ? h('div', { class: 'muted small' },
          `ส่งล่าสุด ${formatThai(s.submitted_at)}`, s.is_late ? [' ', pill('late', 'ส่งช้า')] : null,
          s.link_url && isHttpUrl(s.link_url) ? [' · ', h('button', { class: 'link-btn', type: 'button', onclick: () => openExternal(s.link_url) }, 'เปิดลิงก์ที่ส่ง')] : null) : null),
      h('div', { class: 'mt' }, form),
      h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: '/student/tasks' }, '← งานของฉัน')));
  };

  await loadInto(main, () => apiGet('student', 'assignment', { id }), (data) => draw(data));
});
