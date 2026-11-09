import { h } from '/js/dom.js';

const MENUS = {
  student: [
    { key: 'home', icon: '⌂', label: 'หน้าหลัก', href: '/student/' },
    { key: 'tasks', icon: '▤', label: 'งานของฉัน', href: '/student/tasks' },
    { key: 'attendance', icon: '▦', label: 'เช็กชื่อ', href: '/student/attendance' },
    { key: 'reports', icon: '▥', label: 'รายงาน', href: '/student/reports' },
    { key: 'profile', icon: '♙', label: 'โปรไฟล์', href: '/profile' },
  ],
  teacher: [
    { key: 'home', icon: '⌂', label: 'หน้าหลัก', href: '/teacher/' },
    { key: 'tasks', icon: '▤', label: 'งาน', href: '/teacher/assignments' },
    { key: 'attendance', icon: '▦', label: 'เช็กชื่อ', href: '/teacher/attendance/' },
    { key: 'reports', icon: '▥', label: 'รายงาน', href: '/teacher/reports' },
    { key: 'profile', icon: '♙', label: 'โปรไฟล์', href: '/profile' },
  ],
};

// Which menu is active for the current path (sub-pages highlight their parent)
export function activeKey(pathname = location.pathname) {
  const p = pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  if (p === '/profile') return 'profile';
  if (/^\/teacher\/attendance\/report/.test(p)) return 'reports';
  if (/^\/teacher\/(overview|reports)/.test(p)) return 'reports';
  if (/^\/teacher\/attendance/.test(p)) return 'attendance';
  if (/^\/teacher\/(assignments|assignment|new|edit)/.test(p)) return 'tasks';
  if (/^\/student\/(tasks|assignment)/.test(p)) return 'tasks';
  if (/^\/student\/(attendance|checkin)/.test(p)) return 'attendance';
  if (/^\/student\/reports/.test(p)) return 'reports';
  return 'home';
}

export function renderNav(role, active = activeKey()) {
  const items = MENUS[role];
  if (!items) return null;
  return h('nav', { class: 'bottom-nav', 'aria-label': 'เมนูหลัก' },
    items.map((item) => h('a', {
      class: 'nav-btn',
      href: item.href,
      'aria-current': item.key === active ? 'page' : null,
    }, h('span', { 'aria-hidden': 'true' }, item.icon), item.label)));
}
