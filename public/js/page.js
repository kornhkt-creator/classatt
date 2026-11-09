// Common page setup: check login/role, then add skip link, header, bottom nav and toast.
import { requirePage } from '/js/auth.js';
import { h, qs, render } from '/js/dom.js';
import { renderHeader, skipLink } from '/js/header.js';
import { renderNav } from '/js/nav.js';
import { ensureToast, errorState, skeleton } from '/js/ui.js';

export function getMain() {
  return qs('#main');
}

export function mountShell(me, { nav = true } = {}) {
  const app = qs('#app');
  const main = getMain();
  if (!app.querySelector('header.app-header')) {
    app.prepend(skipLink(), renderHeader(me));
  }
  if (nav && me && (me.role === 'teacher' || me.role === 'student') && !app.querySelector('.bottom-nav')) {
    app.append(renderNav(me.role));
  }
  ensureToast();
  return main;
}

// role: 'teacher' | 'student' | 'linked'
export async function initPage(role, options) {
  const main = getMain();
  render(main, skeleton(3));
  const me = await requirePage(role);
  mountShell(me, options);
  return { me, main };
}

// Run a page's async main function and show a friendly error if it fails
export function runPage(fn) {
  fn().catch((err) => {
    console.error(err);
    const main = getMain();
    if (main) render(main, errorState(err?.message, () => location.reload()));
  });
}

// Load data into `main` with skeleton → content / error+retry
export async function loadInto(main, loader, renderer) {
  render(main, skeleton(3));
  try {
    const data = await loader();
    renderer(data);
  } catch (err) {
    render(main, errorState(err?.message, () => loadInto(main, loader, renderer)));
  }
}

export function pageTitle(title, subtitle, right) {
  return h('section', { class: 'welcome' },
    h('div', {}, h('h1', { class: 'page-title' }, title), subtitle ? h('p', { class: 'sub' }, subtitle) : null),
    right || null);
}
