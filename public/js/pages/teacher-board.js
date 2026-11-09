import { apiGet, apiPost } from '/js/api.js';
import { openSheet } from '/js/bottom-sheet.js';
import { h, param, render } from '/js/dom.js';
import { formatThai, relativeDue, studentName } from '/js/format.js';
import { openExternal } from '/js/liff.js';
import { autoRefresh, initPage, loadInto, refreshButton, runPage } from '/js/page.js';
import { copyText, emptyState, pill, setBusy, submissionPill, toast } from '/js/ui.js';

const CHIPS = [
  ['all', 'ทั้งหมด', (r) => true],
  ['not_submitted', 'ยังไม่ส่ง', (r) => r.status === 'not_submitted'],
  ['submitted', 'รอตรวจ', (r) => r.status === 'submitted'],
  ['approved', 'ตรวจแล้ว', (r) => r.status === 'approved'],
  ['revise', 'ให้แก้ไข', (r) => r.status === 'revise'],
  ['late', 'ส่งช้า', (r) => r.isLate],
];

function chipCount(key, summary) {
  if (key === 'all') return summary.total;
  return summary[key] ?? 0;
}

runPage(async () => {
  const { main } = await initPage('teacher');
  const id = param('id');
  let board = null;
  let filter = 'all';
  let search = '';
  let selecting = false;
  const selected = new Set();

  const isSafeLink = (url) => /^https?:\/\//i.test(url || '');

  async function act(studentIds, action, comment) {
    const before = board;
    // Optimistic update
    const nextStatus = { approve: 'approved', revise: 'revise', reset: 'not_submitted' }[action];
    board = {
      ...board,
      rows: board.rows.map((r) => (studentIds.includes(r.student.id) ? { ...r, status: nextStatus } : r)),
    };
    draw();
    try {
      board = await apiPost('teacher', 'review', { studentIds, action, comment }, { id });
      selected.clear();
      selecting = false;
      draw();
      toast(action === 'approve' ? `ยืนยันส่งแล้ว ${studentIds.length} คน` : action === 'revise' ? 'ส่งความเห็นให้แก้ไขแล้ว' : 'รีเซ็ตเป็นยังไม่ส่งแล้ว');
    } catch (err) {
      board = before;
      draw();
      toast(err.message, 'error');
    }
  }

  function reviseSheet(studentIds) {
    openSheet('ให้แก้ไข', (close) => {
      const input = h('textarea', { maxlength: '300', placeholder: 'บอกนักเรียนว่าต้องแก้ไขอะไร', 'aria-label': 'ความเห็นถึงนักเรียน' });
      const send = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        if (!input.value.trim()) return toast('กรุณาพิมพ์ความเห็น', 'error');
        setBusy(send, true);
        close();
        await act(studentIds, 'revise', input.value.trim());
      } }, 'ส่งความเห็น');
      return h('div', {}, h('div', { class: 'field' }, input), h('div', { class: 'actions' }, send));
    });
  }

  function rowSheet(row) {
    const s = row.submission;
    openSheet(`${row.student.number ?? ''} ${studentName(row.student)}`.trim(), (close) => h('div', { class: 'stack' },
      h('div', {}, submissionPill(row.status), row.isLate ? [' ', pill('late', 'ส่งช้า')] : null),
      s?.submitted_at ? h('p', { class: 'muted small' }, `ส่งเมื่อ ${formatThai(s.submitted_at)}`) : null,
      s?.note ? h('div', {}, h('strong', {}, 'หมายเหตุ'), h('p', { class: 'pre', style: { margin: '2px 0' } }, s.note)) : null,
      s?.link_url && isSafeLink(s.link_url)
        ? h('button', { class: 'btn secondary', type: 'button', onclick: () => openExternal(s.link_url) }, '🔗 เปิดลิงก์งาน') : null,
      s?.teacher_comment ? h('p', { class: 'notice' }, `ความเห็นครู: ${s.teacher_comment}`) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { close(); act([row.student.id], 'approve'); } }, '✓ ยืนยันส่งแล้ว'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { close(); reviseSheet([row.student.id]); } }, '↺ ให้แก้ไข'),
        row.status !== 'not_submitted'
          ? h('button', { class: 'btn danger', type: 'button', onclick: () => { close(); act([row.student.id], 'reset'); } }, 'รีเซ็ตเป็นยังไม่ส่ง') : null)));
  }

  function copyPending() {
    const a = board.assignment;
    const pending = board.rows.filter((r) => r.status === 'not_submitted');
    if (!pending.length) return toast('ทุกคนส่งงานแล้ว 🎉');
    const names = pending.map((r) => `เลขที่ ${r.student.number ?? '-'} ${r.student.first_name}`).join(', ');
    copyText(`งาน ${a.title} (${a.classroom}) ยังไม่ส่ง ${pending.length} คน: ${names} ส่งภายใน ${formatThai(a.due_at)}`);
  }

  function rowEl(row) {
    const s = row.submission;
    const detail = [];
    if (s?.submitted_at && row.status !== 'not_submitted') detail.push(`ส่ง ${formatThai(s.submitted_at)}`);
    if (s?.note && row.status !== 'not_submitted') detail.push(s.note);
    const content = [
      selecting ? h('input', {
        type: 'checkbox', checked: selected.has(row.student.id), 'aria-label': `เลือก ${studentName(row.student)}`,
        onclick: (e) => e.stopPropagation(),
        onchange: (e) => { if (e.target.checked) selected.add(row.student.id); else selected.delete(row.student.id); drawBar(); },
      }) : h('div', { class: 'task-icon green', 'aria-hidden': 'true' }, String(row.student.number ?? '–')),
      h('div', { class: 'task-main' },
        h('strong', {}, studentName(row.student)),
        detail.length ? h('small', {}, detail.join(' · ')) : null,
        s?.link_url && isSafeLink(s.link_url) && row.status !== 'not_submitted' ? h('small', {}, '🔗 มีลิงก์งาน') : null),
      h('div', { class: 'task-side' }, submissionPill(row.status), row.isLate ? pill('late', 'ส่งช้า') : null),
    ];
    if (selecting) {
      return h('label', { class: 'task selectable' }, content);
    }
    return h('button', { class: 'task', type: 'button', onclick: () => rowSheet(row) }, content);
  }

  const barHolder = h('div');
  function drawBar() {
    if (!selecting) return render(barHolder);
    const approveBtn = h('button', { class: 'btn primary', type: 'button', disabled: !selected.size,
      onclick: () => act([...selected], 'approve') }, `ยืนยันส่งแล้ว (${selected.size} คน)`);
    render(barHolder, h('div', { class: 'select-bar' },
      h('span', {}, `เลือก ${selected.size} คน`),
      h('div', { class: 'actions', style: { marginTop: 0 } },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => {
          const visible = visibleRows();
          const all = visible.every((r) => selected.has(r.student.id));
          for (const r of visible) { if (all) selected.delete(r.student.id); else selected.add(r.student.id); }
          draw();
        } }, 'เลือกทั้งหมด'),
        approveBtn)));
  }

  function visibleRows() {
    const test = CHIPS.find(([k]) => k === filter)[2];
    const q = search.trim();
    return board.rows.filter((r) => test(r) && (!q || studentName(r.student).includes(q) || String(r.student.number) === q));
  }

  const listHolder = h('div', { class: 'task-list' });
  function drawList() {
    const rows = visibleRows();
    render(listHolder, rows.length ? rows.map(rowEl) : emptyState('ไม่มีนักเรียนในหมวดนี้'));
  }

  function draw() {
    const a = board.assignment;
    const summary = { total: board.rows.length, not_submitted: 0, submitted: 0, approved: 0, revise: 0, late: 0 };
    for (const r of board.rows) { summary[r.status] += 1; if (r.isLate) summary.late += 1; }
    const searchInput = h('input', { class: 'input grow', type: 'search', placeholder: 'ค้นหาชื่อหรือเลขที่', value: search,
      'aria-label': 'ค้นหานักเรียน', oninput: (e) => { search = e.target.value; drawList(); } });
    render(main,
      h('section', { class: 'panel' },
        h('div', { class: 'section-head first' },
          h('div', {}, h('h1', { class: 'page-title' }, a.title), h('p', { class: 'sub' }, `${a.subject} · ${a.classroom}`)),
          h('a', { class: 'btn ghost sm', href: `/teacher/edit?id=${encodeURIComponent(a.id)}` }, 'แก้ไข')),
        h('p', { style: { margin: 0 } }, `กำหนดส่ง ${formatThai(a.due_at)} · ${relativeDue(a.due_at)} `,
          a.status === 'open' ? pill('done', 'เปิดรับ') : pill('muted', 'ปิดแล้ว')),
        a.description ? h('p', { class: 'pre muted small' }, a.description) : null),
      h('div', { class: 'toolbar' },
        CHIPS.map(([key, label]) => h('button', {
          class: `btn sm ${key === filter ? 'secondary' : 'ghost'}`, type: 'button', 'aria-pressed': String(key === filter),
          onclick: () => { filter = key; draw(); },
        }, `${label} ${chipCount(key, summary)}`))),
      h('div', { class: 'toolbar' },
        searchInput,
        h('button', { class: `btn sm ${selecting ? 'secondary' : 'ghost'}`, type: 'button', onclick: () => { selecting = !selecting; selected.clear(); draw(); } },
          selecting ? 'ยกเลิกการเลือก' : 'เลือกหลายคน'),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: copyPending }, '📋 คัดลอกรายชื่อคนค้างส่ง'),
        refreshButton(load)),
      listHolder,
      barHolder);
    drawList();
    drawBar();
  }

  function load() {
    return loadInto(main, () => apiGet('teacher', 'board', { id }), (data) => {
      board = data;
      selected.clear();
      selecting = false;
      draw();
    });
  }
  autoRefresh(load);
  await load();
});
