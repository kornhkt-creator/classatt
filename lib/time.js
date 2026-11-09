// Time helpers. Vercel servers run in UTC — always go through these for Thai time (UTC+7, no DST).

export const THAI_OFFSET = '+07:00';
const TZ = 'Asia/Bangkok';
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-11-20", "23:59" → Date at that Thai local time
export function toDueAt(dateStr, timeStr = '23:59') {
  const date = new Date(`${dateStr}T${timeStr}:00${THAI_OFFSET}`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return date;
}

export function isLate(submittedAt, dueAt) {
  return new Date(submittedAt).getTime() > new Date(dueAt).getTime();
}

const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// Date → "YYYY-MM-DD" in Thai time
export function thaiDateKey(date = new Date()) {
  return keyFormat.format(new Date(date));
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// Date → "HH:mm" in Thai time
export function thaiTimeKey(date) {
  return timeFormat.format(new Date(date));
}

// "YYYY-MM-DD" → [start of that Thai day, start of next Thai day)
export function thaiDayRange(dateKey) {
  const start = new Date(`${dateKey}T00:00:00${THAI_OFFSET}`);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid date key');
  return [start, new Date(start.getTime() + DAY_MS)];
}

export function addDaysKey(dateKey, days) {
  const [start] = thaiDayRange(dateKey);
  return thaiDateKey(new Date(start.getTime() + days * DAY_MS + 12 * 60 * 60 * 1000));
}

// Whole Thai calendar days from `from` to `to` (positive = `to` is later)
export function thaiDayDiff(from, to) {
  const a = thaiDayRange(thaiDateKey(from))[0].getTime();
  const b = thaiDayRange(thaiDateKey(to))[0].getTime();
  return Math.round((b - a) / DAY_MS);
}

// Due within the next `days` Thai calendar days and not yet past
export function isDueSoon(dueAt, now = new Date(), days = 2) {
  if (new Date(dueAt).getTime() < new Date(now).getTime()) return false;
  return thaiDayDiff(now, dueAt) <= days;
}
