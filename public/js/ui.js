import { h, render, qs } from '/js/dom.js';

let toastTimer;

export function ensureToast() {
  let el = qs('#toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  return el;
}

export function toast(message, type = 'info') {
  const el = ensureToast();
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export function toastError(err) {
  toast(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
}

export function setBusy(button, busy, busyLabel = 'กำลังบันทึก...') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = false;
  }
}

export function skeleton(lines = 3) {
  return h('div', { 'aria-busy': 'true', 'aria-label': 'กำลังโหลด' },
    h('div', { class: 'skeleton title' }),
    Array.from({ length: lines }, () => h('div', { class: 'skeleton block' })));
}

export function emptyState(text, icon = '📭') {
  return h('div', { class: 'empty' }, h('span', { class: 'big', 'aria-hidden': 'true' }, icon), text);
}

export function errorState(message, onRetry) {
  return h('div', { class: 'state' }, h('div', {},
    h('span', { class: 'icon', 'aria-hidden': 'true' }, '😕'),
    h('h1', {}, 'เกิดข้อผิดพลาด'),
    h('p', {}, message || 'กรุณาลองใหม่อีกครั้ง'),
    onRetry ? h('button', { class: 'btn primary', type: 'button', onclick: onRetry }, 'ลองใหม่') : null));
}

export function loadingState(text = 'กำลังโหลด...') {
  return h('div', { class: 'state' }, h('div', {}, h('div', { class: 'spinner', 'aria-hidden': 'true' }), h('p', {}, text)));
}

export function pill(kind, text) {
  return h('span', { class: `pill ${kind}` }, text);
}

export function progressBar(value, label, variant = '') {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return h('div', {
    class: `progress ${variant}`.trim(), role: 'progressbar', 'aria-label': label,
    'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100',
  }, h('span', { style: { width: `${pct}%` } }));
}

export function stat(num, label, variant = '') {
  return h('div', { class: `stat ${variant}`.trim() }, h('span', { class: 'num' }, String(num)), h('span', { class: 'label' }, label));
}

// Replace the main content area and keep focus sane
export function show(main, ...children) {
  render(main, ...children);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('คัดลอกแล้ว วางในกลุ่ม LINE ได้เลย');
  } catch {
    toast('คัดลอกไม่สำเร็จ', 'error');
  }
}

// Status → [pill class, Thai label]
export const SUBMISSION_PILL = {
  not_submitted: ['todo', 'ยังไม่ส่ง'],
  submitted: ['review', 'รอตรวจ'],
  approved: ['done', 'ส่งแล้ว'],
  revise: ['revise', 'ให้แก้ไข'],
};

export const ATTENDANCE_PILL = {
  present: ['done', 'มาเรียน'],
  late: ['late', 'มาสาย'],
  absent: ['absent', 'ขาด'],
  leave: ['leave', 'ลากิจ'],
  sick: ['leave', 'ลาป่วย'],
  none: ['todo', 'ยังไม่เช็กชื่อ'],
};

export function submissionPill(status) {
  const [kind, label] = SUBMISSION_PILL[status] || SUBMISSION_PILL.not_submitted;
  return pill(kind, label);
}

export function attendancePill(status) {
  const [kind, label] = ATTENDANCE_PILL[status] || ATTENDANCE_PILL.none;
  return pill(kind, label);
}

// Badge for a student's task in lists
export function taskBadge(item) {
  if (item.status === 'approved') return pill('done', 'ส่งแล้ว');
  if (item.status === 'submitted') return pill('review', 'รอตรวจ');
  if (item.status === 'revise') return pill('revise', 'ให้แก้ไข');
  if (item.overdue) return pill('late', 'เลยกำหนด');
  if (item.dueSoon) return pill('todo', 'ใกล้ถึงกำหนด');
  return pill('todo', 'ยังไม่ส่ง');
}

const SUBJECT_ICONS = [
  [/คณิต/, '📐'], [/วิทย|ฟิสิก|เคมี|ชีว/, '🔬'], [/ไทย/, '📖'], [/อังกฤษ|english|ภาษา/i, '🔤'],
  [/สังคม|ประวัติ/, '🌏'], [/ศิลป|ดนตรี/, '🎨'], [/พละ|สุขศึกษา/, '⚽'], [/การงาน|อาชีพ|คอม|เทคโน/, '🛠️'],
];

export function subjectIcon(subject = '') {
  for (const [re, icon] of SUBJECT_ICONS) if (re.test(subject)) return icon;
  return '📝';
}

export function field(labelText, control, { hint, id } = {}) {
  const controlId = id || control.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  control.id = controlId;
  return h('div', { class: 'field' },
    h('label', { for: controlId }, labelText),
    control,
    hint ? h('span', { class: 'hint' }, hint) : null,
    h('span', { class: 'error', 'aria-live': 'polite' }));
}

export function setFieldError(control, message) {
  const wrap = control.closest('.field');
  if (!wrap) return;
  wrap.classList.toggle('invalid', Boolean(message));
  const err = wrap.querySelector('.error');
  if (err) err.textContent = message || '';
}
