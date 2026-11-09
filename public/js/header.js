import { h } from '/js/dom.js';

export function avatar(me, size = '') {
  const cls = `avatar ${size}`.trim();
  if (me?.pictureUrl && /^https:\/\//.test(me.pictureUrl)) {
    return h('img', { class: cls, src: me.pictureUrl, alt: '', referrerpolicy: 'no-referrer' });
  }
  return h('span', { class: cls, 'aria-hidden': 'true' }, '👤');
}

// Green header from the prototype. Right side: LINE profile picture (no role switch).
export function renderHeader(me) {
  const home = me?.role === 'teacher' ? '/teacher/' : me?.role === 'student' ? '/student/' : '/';
  const name = me?.role === 'student' && me.student ? me.student.first_name : me?.name || me?.displayName || '';
  return h('header', { class: 'app-header' },
    h('a', { class: 'brand', href: home },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, 'C'),
      h('div', {}, h('strong', {}, 'ClassTrack'), h('small', {}, 'ระบบติดตามงานและเช็กชื่อเข้าเรียน'))),
    me && me.role !== 'unlinked'
      ? h('a', { class: 'avatar-link', href: '/profile', 'aria-label': 'โปรไฟล์ของฉัน' }, h('span', { class: 'who' }, name), avatar(me))
      : me ? h('span', { class: 'avatar-link' }, avatar(me)) : null);
}

export function skipLink() {
  return h('a', { class: 'skip', href: '#main' }, 'ข้ามไปยังเนื้อหาหลัก');
}
