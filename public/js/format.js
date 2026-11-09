// Thai date/time formatting. Always uses Asia/Bangkok so results are the same on every device.
const TZ = 'Asia/Bangkok';
const DAY_MS = 24 * 60 * 60 * 1000;

const partsFormat = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  timeZone: TZ, day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat('th-TH', { timeZone: TZ, weekday: 'long' });

function parts(date) {
  const out = {};
  for (const p of partsFormat.formatToParts(new Date(date))) out[p.type] = p.value;
  return out;
}

// "20 พ.ย. 69 23:59"
export function formatThai(iso) {
  if (!iso) return '-';
  const p = parts(iso);
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`;
}

// "20 พ.ย."
export function formatDateShort(iso) {
  if (!iso) return '-';
  const p = parts(iso);
  return `${p.day} ${p.month}`;
}

// "20 พ.ย. 69"
export function formatDate(iso) {
  if (!iso) return '-';
  const p = parts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

// "08:32"
export function formatTime(iso) {
  if (!iso) return '-';
  const p = parts(iso);
  return `${p.hour}:${p.minute}`;
}

// "วันจันทร์ 10 พ.ย."
export function todayLabel(now = new Date()) {
  return `${weekdayFormat.format(now)} ${formatDateShort(now)}`;
}

// Date → "YYYY-MM-DD" in Thai time
export function dayKey(date = new Date()) {
  return keyFormat.format(new Date(date));
}

function dayStart(key) {
  return new Date(`${key}T00:00:00+07:00`).getTime();
}

export function dayDiff(from, to) {
  return Math.round((dayStart(dayKey(to)) - dayStart(dayKey(from))) / DAY_MS);
}

// "เหลืออีก 2 วัน" / "ครบกำหนดวันนี้" / "ครบกำหนดพรุ่งนี้" / "เลยกำหนด 3 วัน"
export function relativeDue(dueIso, now = new Date()) {
  const due = new Date(dueIso);
  const days = dayDiff(now, due);
  if (due.getTime() < new Date(now).getTime()) {
    const late = -days;
    return late <= 0 ? 'เลยกำหนดแล้ว' : `เลยกำหนด ${late} วัน`;
  }
  if (days === 0) return 'ครบกำหนดวันนี้';
  if (days === 1) return 'ครบกำหนดพรุ่งนี้';
  return `เหลืออีก ${days} วัน`;
}

// <input type=date> value for today in Thai time
export function todayInputValue(now = new Date()) {
  return dayKey(now);
}

export function addDays(key, days) {
  return dayKey(new Date(dayStart(key) + days * DAY_MS + 12 * 60 * 60 * 1000));
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function studentName(s) {
  if (!s) return '-';
  return `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim();
}
