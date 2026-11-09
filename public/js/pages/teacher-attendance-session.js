import { apiGet, apiPost } from '/js/api.js';
import { confirmSheet, openSheet } from '/js/bottom-sheet.js';
import { h, param, render } from '/js/dom.js';
import { formatDate, formatTime, studentName } from '/js/format.js';
import { initPage, loadInto, runPage } from '/js/page.js';
import { attendancePill, copyText, emptyState, pill, setBusy, toast } from '/js/ui.js';

const STATUSES = [['present', 'มาเรียน'], ['late', 'มาสาย'], ['absent', 'ขาด'], ['leave', 'ลากิจ'], ['sick', 'ลาป่วย']];
const METHOD = { qr: 'สแกน QR', code: 'กรอกรหัส', manual: 'ครูบันทึก', auto: 'อัตโนมัติ (ปิดรอบ)' };
const CHIPS = [['all', 'ทั้งหมด'], ...STATUSES, ['none', 'ยังไม่เช็ก']];

runPage(async () => {
  const { main } = await initPage('teacher');
  const id = param('id');
  let data = null;
  let filter = 'all';
  let selecting = false;
  const selected = new Set();

  const statusOf = (row) => row.record?.status || 'none';

  async function mark(studentIds, status, note = '') {
    try {
      data = await apiPost('teacher', 'mark-attendance', { studentIds, status, note }, { id });
      selected.clear();
      selecting = false;
      draw();
      toast(`บันทึก${STATUSES.find(([k]) => k === status)[1]} ${studentIds.length} คนแล้ว`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function statusSheet(studentIds, title) {
    openSheet(title, (close) => {
      let chosen = null;
      const note = h('input', { maxlength: '100', placeholder: 'หมายเหตุ เช่น ลาไปแข่งกีฬา (ไม่บังคับ)', 'aria-label': 'หมายเหตุ' });
      const save = h('button', { class: 'btn primary block', type: 'button', disabled: true, onclick: async () => {
        setBusy(save, true);
        close();
        await mark(studentIds, chosen, note.value.trim());
      } }, 'บันทึก');
      const buttons = STATUSES.map(([key, label]) => h('button', {
        class: 'btn ghost', type: 'button', 'aria-pressed': 'false',
        onclick: (e) => {
          chosen = key;
          for (const b of buttons) b.setAttribute('aria-pressed', String(b === e.currentTarget));
          save.disabled = false;
        },
      }, label));
      return h('div', {}, h('div', { class: 'choice-grid' }, buttons), h('div', { class: 'field' }, note), save);
    });
  }

  function copySummary() {
    const s = data.session;
    const by = (st) => data.rows.filter((r) => statusOf(r) === st);
    const names = (rows) => rows.map((r) => `เลขที่ ${r.student.number ?? '-'} ${r.student.first_name}`).join(', ') || '-';
    const c = data.summary;
    copyText(`${s.classroom} ${s.subject} ${formatDate(s.starts_at)}${s.title ? ` ${s.title}` : ''} — มา ${c.present} สาย ${c.late}`
      + ` | ขาด: ${names(by('absent'))} | ลา: ${names([...by('leave'), ...by('sick')])}`
      + (c.notYet ? ` | ยังไม่เช็ก: ${names(by('none'))}` : ''));
  }

  function rowEl(row) {
    const st = statusOf(row);
    const r = row.record;
    const info = r ? `${formatTime(r.checked_at)} น. · ${METHOD[r.method] || r.method}${r.note ? ` · ${r.note}` : ''}` : 'ยังไม่เช็กชื่อ';
    const content = [
      selecting ? h('input', {
        type: 'checkbox', checked: selected.has(row.student.id), 'aria-label': `เลือก ${studentName(row.student)}`,
        onchange: (e) => { if (e.target.checked) selected.add(row.student.id); else selected.delete(row.student.id); drawBar(); },
      }) : h('div', { class: 'task-icon green', 'aria-hidden': 'true' }, String(row.student.number ?? '–')),
      h('div', { class: 'task-main' }, h('strong', {}, studentName(row.student)), h('small', {}, info)),
      attendancePill(st),
    ];
    if (selecting) return h('label', { class: 'task selectable' }, content);
    return h('button', { class: 'task', type: 'button', onclick: () => statusSheet([row.student.id], studentName(row.student)) }, content);
  }

  const listHolder = h('div', { class: 'task-list' });
  const barHolder = h('div');
  function visible() {
    return data.rows.filter((r) => filter === 'all' || statusOf(r) === filter);
  }
  function drawList() {
    const rows = visible();
    render(listHolder, rows.length ? rows.map(rowEl) : emptyState('ไม่มีนักเรียนในหมวดนี้'));
  }
  function drawBar() {
    if (!selecting) return render(barHolder);
    render(barHolder, h('div', { class: 'select-bar' },
      h('span', {}, `เลือก ${selected.size} คน`),
      h('div', { class: 'actions', style: { marginTop: 0 } },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => {
          const rows = visible();
          const all = rows.every((r) => selected.has(r.student.id));
          for (const r of rows) { if (all) selected.delete(r.student.id); else selected.add(r.student.id); }
          draw();
        } }, 'เลือกทั้งหมด'),
        h('button', { class: 'btn primary', type: 'button', disabled: !selected.size,
          onclick: () => statusSheet([...selected], `ตั้งสถานะ ${selected.size} คน`) }, `ตั้งสถานะ (${selected.size} คน)`))));
  }

  function draw() {
    const s = data.session;
    const c = data.summary;
    const counts = { all: data.rows.length, present: c.present, late: c.late, absent: c.absent, leave: c.leave, sick: c.sick, none: c.notYet };
    const closeBtn = h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      const ok = await confirmSheet('ปิดรอบเช็กชื่อ?', `นักเรียนที่ยังไม่เช็ก ${c.notYet} คนจะถูกบันทึกว่าขาด (แก้ไขภายหลังได้)`, 'ปิดรอบ', 'danger');
      if (!ok) return;
      setBusy(closeBtn, true);
      try {
        data = await apiPost('teacher', 'close-attendance', {}, { id });
        toast('ปิดรอบแล้ว');
        draw();
      } catch (err) {
        toast(err.message, 'error');
        setBusy(closeBtn, false);
      }
    } }, 'ปิดรอบเช็กชื่อ');
    const unchecked = data.rows.filter((r) => !r.record).map((r) => r.student.id);

    render(main,
      h('section', { class: 'panel' },
        h('div', { class: 'section-head first' },
          h('div', {},
            h('h1', { class: 'page-title' }, `${s.classroom} · ${s.subject}`),
            h('p', { class: 'sub' }, `${formatDate(s.starts_at)} เริ่ม ${formatTime(s.starts_at)} น.${s.title ? ` · ${s.title}` : ''} · มาสายหลัง ${s.late_after_minutes} นาที`)),
          s.status === 'open' ? pill('done', 'กำลังเปิด') : pill('muted', 'ปิดแล้ว')),
        h('div', { class: 'actions', style: { marginTop: 0 } },
          s.status === 'open' ? h('a', { class: 'btn primary', href: `/teacher/attendance/live?id=${encodeURIComponent(s.id)}` }, 'เปิดจอ QR') : null,
          s.status === 'open' && unchecked.length ? h('button', { class: 'btn ghost', type: 'button', onclick: () => statusSheet(unchecked, `ตั้งสถานะคนที่ยังไม่เช็ก ${unchecked.length} คน`) }, 'ตั้งสถานะคนที่เหลือ') : null,
          s.status === 'open' ? closeBtn : null)),
      h('div', { class: 'toolbar' }, CHIPS.map(([key, label]) => h('button', {
        class: `btn sm ${key === filter ? 'secondary' : 'ghost'}`, type: 'button', 'aria-pressed': String(key === filter),
        onclick: () => { filter = key; draw(); },
      }, `${label} ${counts[key] ?? 0}`))),
      h('div', { class: 'toolbar' },
        h('button', { class: `btn sm ${selecting ? 'secondary' : 'ghost'}`, type: 'button', onclick: () => { selecting = !selecting; selected.clear(); draw(); } },
          selecting ? 'ยกเลิกการเลือก' : 'เลือกหลายคน'),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: copySummary }, '📋 คัดลอกสรุป'),
        h('span', { class: 'muted small' }, 'แตะที่ชื่อเพื่อแก้สถานะ (แก้ได้แม้ปิดรอบแล้ว)')),
      listHolder,
      barHolder);
    drawList();
    drawBar();
  }

  await loadInto(main, () => apiGet('teacher', 'attendance-session', { id }), (d) => {
    data = d;
    draw();
  });
});
