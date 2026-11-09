import { describe, expect, it } from 'vitest';
import { isDueSoon, isLate, thaiDateKey, thaiDayDiff, thaiDayRange, thaiTimeKey, toDueAt, addDaysKey } from '../lib/time.js';
import { dayDiff, formatDateShort, formatThai, formatTime, relativeDue } from '../public/js/format.js';

describe('lib/time', () => {
  it('toDueAt interprets the input as Thai time', () => {
    expect(toDueAt('2026-11-20', '23:59').toISOString()).toBe('2026-11-20T16:59:00.000Z');
  });

  it('isLate compares instants', () => {
    expect(isLate('2026-11-20T17:00:00Z', '2026-11-20T16:59:00Z')).toBe(true);
    expect(isLate('2026-11-20T16:58:59Z', '2026-11-20T16:59:00Z')).toBe(false);
  });

  it('thaiDateKey crosses midnight in Thai time, not UTC', () => {
    // 2026-11-09 17:30 UTC = 2026-11-10 00:30 in Thailand
    expect(thaiDateKey(new Date('2026-11-09T17:30:00Z'))).toBe('2026-11-10');
    expect(thaiDateKey(new Date('2026-11-09T16:59:00Z'))).toBe('2026-11-09');
  });

  it('thaiDayRange returns the Thai day boundaries', () => {
    const [start, end] = thaiDayRange('2026-11-10');
    expect(start.toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-10T17:00:00.000Z');
    expect(addDaysKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysKey('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('thaiTimeKey and day diff', () => {
    expect(thaiTimeKey('2026-11-20T16:59:00Z')).toBe('23:59');
    expect(thaiDayDiff(new Date('2026-11-09T16:30:00Z'), new Date('2026-11-09T17:30:00Z'))).toBe(1);
  });

  it('isDueSoon within 2 Thai days and not past', () => {
    const now = new Date('2026-11-10T03:00:00Z');
    expect(isDueSoon('2026-11-12T16:00:00Z', now)).toBe(true);
    expect(isDueSoon('2026-11-13T17:30:00Z', now)).toBe(false);
    expect(isDueSoon('2026-11-09T03:00:00Z', now)).toBe(false);
  });
});

describe('public/js/format', () => {
  it('formats Thai dates with Buddhist year', () => {
    expect(formatThai('2026-11-20T16:59:00Z')).toBe('20 พ.ย. 69 23:59');
    expect(formatDateShort('2026-11-20T16:59:00Z')).toBe('20 พ.ย.');
    expect(formatTime('2026-11-10T01:32:00Z')).toBe('08:32');
  });

  it('relativeDue', () => {
    const now = new Date('2026-11-10T03:00:00Z'); // 10:00 Thai
    expect(relativeDue('2026-11-10T16:59:00Z', now)).toBe('ครบกำหนดวันนี้');
    expect(relativeDue('2026-11-11T16:59:00Z', now)).toBe('ครบกำหนดพรุ่งนี้');
    expect(relativeDue('2026-11-12T16:59:00Z', now)).toBe('เหลืออีก 2 วัน');
    expect(relativeDue('2026-11-10T01:00:00Z', now)).toBe('เลยกำหนดแล้ว');
    expect(relativeDue('2026-11-07T16:59:00Z', now)).toBe('เลยกำหนด 3 วัน');
  });

  it('dayDiff uses Thai midnight', () => {
    expect(dayDiff(new Date('2026-11-09T16:30:00Z'), new Date('2026-11-09T17:30:00Z'))).toBe(1);
  });
});
