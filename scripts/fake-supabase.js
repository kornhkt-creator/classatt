// In-memory stand-in for the Supabase client — for tests and `npm run dev:demo` only.
// Implements just the query-builder methods this project uses. Never used in production.
import { randomUUID } from 'node:crypto';

const DEFAULTS = {
  teachers: () => ({ reg_code: null, line_user_id: null, linked_at: null, active: true }),
  students: () => ({ prefix: '', last_name: '', number: null, verify_code: null, line_user_id: null, linked_at: null, active: true }),
  assignments: () => ({ description: '', status: 'open' }),
  submissions: () => ({
    status: 'not_submitted', note: null, link_url: null, submitted_at: null, is_late: false,
    reviewed_by: null, reviewed_at: null, teacher_comment: null,
  }),
  link_attempts: () => ({ kind: 'link' }),
  audit_log: () => ({ detail: {} }),
  attendance_sessions: () => ({ title: null, starts_at: new Date().toISOString(), late_after_minutes: 10, status: 'open', closed_at: null }),
  attendance_records: () => ({ checked_at: new Date().toISOString(), marked_by: null, note: null }),
};

const UNIQUE = {
  teachers: [['teacher_code'], ['line_user_id']],
  students: [['student_code'], ['line_user_id']],
  submissions: [['assignment_id', 'student_id']],
  attendance_records: [['session_id', 'student_id']],
};

const HAS_UPDATED_AT = new Set(['assignments', 'submissions', 'attendance_records']);
const NUMERIC_IDS = new Set(['link_attempts', 'audit_log']);

function cmp(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  const da = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(a) ? Date.parse(a) : NaN;
  const db = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(b) ? Date.parse(b) : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'th', { numeric: true });
}

export function createFakeSupabase() {
  const db = Object.fromEntries(Object.keys(DEFAULTS).map((t) => [t, []]));
  let seq = 1;

  const views = {
    assignment_progress: () => db.assignments.map((a) => {
      const room = new Set(db.students.filter((s) => s.active && s.classroom === a.classroom).map((s) => s.id));
      const subs = db.submissions.filter((s) => s.assignment_id === a.id && room.has(s.student_id));
      return {
        assignment_id: a.id,
        total_students: room.size,
        submitted_count: subs.filter((s) => s.status === 'submitted').length,
        approved_count: subs.filter((s) => s.status === 'approved').length,
        revise_count: subs.filter((s) => s.status === 'revise').length,
        late_count: subs.filter((s) => s.is_late && ['submitted', 'approved'].includes(s.status)).length,
      };
    }),
    classroom_list: () => [...new Set(db.students.filter((s) => s.active).map((s) => s.classroom))]
      .sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).map((classroom) => ({ classroom })),
  };

  function violates(table, row, ignore) {
    for (const cols of UNIQUE[table] || []) {
      if (cols.some((c) => row[c] === null || row[c] === undefined)) continue;
      if (db[table].some((r) => r !== ignore && cols.every((c) => r[c] === row[c]))) return cols;
    }
    return null;
  }

  function withDefaults(table, row) {
    const now = new Date().toISOString();
    const base = { id: NUMERIC_IDS.has(table) ? seq++ : randomUUID(), created_at: now, ...DEFAULTS[table]() };
    if (HAS_UPDATED_AT.has(table)) base.updated_at = now;
    return { ...base, ...structuredClone(row) };
  }

  class Query {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.filters = [];
      this.orders = [];
      this.cols = '*';
      this.returning = null;
      this.opts = {};
    }

    select(cols = '*', opts = {}) {
      if (this.op === 'select') {
        this.cols = cols;
        this.opts = opts;
      } else {
        this.returning = cols;
      }
      return this;
    }

    insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    upsert(rows, opts = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.upsertOpts = opts; return this; }
    delete() { this.op = 'delete'; return this; }

    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
    is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
    in(c, vals) { const set = new Set(vals); this.filters.push((r) => set.has(r[c])); return this; }
    gte(c, v) { this.filters.push((r) => cmp(r[c], v) >= 0); return this; }
    lt(c, v) { this.filters.push((r) => cmp(r[c], v) < 0); return this; }
    order(c, { ascending = true } = {}) { this.orders.push([c, ascending]); return this; }
    range(from, to) { this.rangeV = [from, to]; return this; }
    limit(n) { this.limitV = n; return this; }
    maybeSingle() { this.singleMode = 'maybe'; return this; }
    single() { this.singleMode = 'one'; return this; }

    then(resolve, reject) {
      return Promise.resolve().then(() => this.exec()).then(resolve, reject);
    }

    project(rows, cols) {
      if (!cols || cols.trim() === '*') return rows.map((r) => structuredClone(r));
      const names = cols.split(',').map((c) => c.trim()).filter(Boolean);
      return rows.map((r) => Object.fromEntries(names.map((n) => [n, r[n] === undefined ? null : structuredClone(r[n])])));
    }

    source() {
      if (views[this.table]) return views[this.table]();
      if (!db[this.table]) throw Object.assign(new Error(`relation "${this.table}" does not exist`), { code: '42P01' });
      return db[this.table];
    }

    finish(rows, cols) {
      let data = this.project(rows, cols);
      if (this.singleMode === 'one') {
        if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
        data = data[0];
      } else if (this.singleMode === 'maybe') {
        if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
        data = data[0] || null;
      }
      return { data, error: null };
    }

    exec() {
      try {
        const table = this.table;
        if (this.op === 'select') {
          let rows = this.source().filter((r) => this.filters.every((f) => f(r)));
          for (const [c, asc] of [...this.orders].reverse()) {
            rows = [...rows].sort((a, b) => (asc ? cmp(a[c], b[c]) : cmp(b[c], a[c])));
          }
          const count = rows.length;
          if (this.rangeV) rows = rows.slice(this.rangeV[0], this.rangeV[1] + 1);
          if (this.limitV !== undefined) rows = rows.slice(0, this.limitV);
          if (this.opts.head) return { data: null, error: null, count };
          return { ...this.finish(rows, this.cols), count };
        }
        if (this.op === 'insert') {
          const created = this.rows.map((r) => withDefaults(table, r));
          for (const row of created) {
            if (violates(table, row)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
            db[table].push(row);
          }
          return this.finish(created, this.returning);
        }
        if (this.op === 'update') {
          const matched = db[table].filter((r) => this.filters.every((f) => f(r)));
          for (const row of matched) {
            const next = { ...row, ...structuredClone(this.patch) };
            if (violates(table, next, row)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          for (const row of matched) {
            Object.assign(row, structuredClone(this.patch));
            if (HAS_UPDATED_AT.has(table)) row.updated_at = new Date().toISOString();
          }
          return this.finish(matched, this.returning);
        }
        if (this.op === 'upsert') {
          const keys = (this.upsertOpts.onConflict || 'id').split(',').map((k) => k.trim());
          const out = [];
          for (const r of this.rows) {
            const existing = db[table].find((row) => keys.every((k) => row[k] === r[k]));
            if (existing) {
              if (this.upsertOpts.ignoreDuplicates) continue;
              Object.assign(existing, structuredClone(r));
              if (HAS_UPDATED_AT.has(table)) existing.updated_at = new Date().toISOString();
              out.push(existing);
            } else {
              const row = withDefaults(table, r);
              if (violates(table, row)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
              db[table].push(row);
              out.push(row);
            }
          }
          return this.finish(out, this.returning);
        }
        if (this.op === 'delete') {
          const keep = db[table].filter((r) => !this.filters.every((f) => f(r)));
          db[table].splice(0, db[table].length, ...keep);
          return { data: null, error: null };
        }
        throw new Error(`Unsupported op ${this.op}`);
      } catch (err) {
        return { data: null, error: { code: err.code || 'FAKE', message: err.message } };
      }
    }
  }

  return {
    _db: db,
    from: (table) => new Query(table),
  };
}

// Same data as supabase/seed.sql
export function seedDemo(fake) {
  const db = fake._db;
  const add = (table, row) => {
    const now = new Date().toISOString();
    const full = { id: randomUUID(), created_at: now, ...DEFAULTS[table](), ...row };
    db[table].push(full);
    return full;
  };
  add('teachers', { teacher_code: 'T001', name: 'ครูสมศรี ใจดี', reg_code: 'TEST01' });
  add('teachers', { teacher_code: 'T002', name: 'ครูวิชัย รักเรียน', reg_code: 'TEST02' });
  const students = [
    ['65001', 'ด.ช.', 'สมชาย', 'ใจดี', 'ม.2/1', 1, '111111'],
    ['65002', 'ด.ญ.', 'สมหญิง', 'ดีใจ', 'ม.2/1', 2, '222222'],
    ['65003', 'ด.ช.', 'มานะ', 'ขยันเรียน', 'ม.2/1', 3, '333333'],
    ['65004', 'ด.ญ.', 'ปิติ', 'ยิ้มแย้ม', 'ม.2/1', 4, '444444'],
    ['65005', 'ด.ช.', 'ชูใจ', 'ใฝ่รู้', 'ม.2/2', 1, '555555'],
    ['65006', 'ด.ญ.', 'วีณา', 'ตั้งใจ', 'ม.2/2', 2, '666666'],
    ['65007', 'ด.ช.', 'ธนา', 'มีสุข', 'ม.2/2', 3, '777777'],
    ['65008', 'ด.ญ.', 'กานดา', 'รักดี', 'ม.2/2', 4, '888888'],
  ];
  for (const [student_code, prefix, first_name, last_name, classroom, number, verify_code] of students) {
    add('students', { student_code, prefix, first_name, last_name, classroom, number, verify_code });
  }
  return fake;
}
