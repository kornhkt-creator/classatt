import { h } from '/js/dom.js';

// Opens a bottom sheet. `content` is a Node or (close) => Node. Returns { close }.
export function openSheet(title, content, { onClose } = {}) {
  const previousFocus = document.activeElement;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  const body = typeof content === 'function' ? content(close) : content;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { class: 'sheet-close', type: 'button', 'aria-label': 'ปิด', onclick: close }, '✕')),
    body);
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, sheet);

  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  const focusable = sheet.querySelector('input, select, textarea, button:not(.sheet-close)');
  (focusable || sheet.querySelector('.sheet-close')).focus();
  return { close };
}

export function confirmSheet(title, message, confirmLabel = 'ยืนยัน', variant = 'primary') {
  return new Promise((resolve) => {
    let answered = false;
    const { close } = openSheet(title, (closeSheet) => h('div', {},
      h('p', { class: 'muted' }, message),
      h('div', { class: 'actions' },
        h('button', { class: `btn ${variant}`, type: 'button', onclick: () => { answered = true; closeSheet(); resolve(true); } }, confirmLabel),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => closeSheet() }, 'ยกเลิก'))), {
      onClose: () => { if (!answered) resolve(false); },
    });
    void close;
  });
}
