// Safe DOM helpers. Text is always inserted with text nodes — never innerHTML.

const SAFE_URL = /^(https?:|mailto:|\/|#|\?|\.\/|data:image\/svg\+xml)/i;

export function safeUrl(value) {
  const url = String(value ?? '');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return url; // relative URL
  return SAFE_URL.test(url) ? url : '#';
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// h('div', { class: 'card', onclick: fn }, 'text', h('span', {}, 'x'))
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'href' || key === 'src' || key === 'action') el.setAttribute(key, safeUrl(value));
    else if (key === 'value' && 'value' in el) el.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'hidden' || key === 'required') el[key] = Boolean(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  appendChildren(el, children);
  return el;
}

export function render(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
  return el;
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function param(name) {
  return new URLSearchParams(location.search).get(name);
}

export function setParams(values) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  history.replaceState(null, '', url);
}
