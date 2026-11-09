import * as teachersRepo from './repos/teachers.js';
import * as studentsRepo from './repos/students.js';

// Who is this LINE user in our database? Checked on every request (role is never stored in the cookie).
export async function resolveIdentity(lineUserId) {
  const teacher = await teachersRepo.getByLineUserId(lineUserId);
  if (teacher) return { role: 'teacher', teacher };
  const student = await studentsRepo.getByLineUserId(lineUserId);
  if (student) return { role: 'student', student };
  return { role: 'unlinked' };
}

// Safe "me" payload for pages — no codes, no line_user_id
export function toMe(session, identity) {
  const base = {
    role: identity.role,
    displayName: session.displayName || '',
    pictureUrl: session.pictureUrl || '',
  };
  if (identity.role === 'teacher') {
    const t = identity.teacher;
    return { ...base, name: t.name, teacher: { id: t.id, teacher_code: t.teacher_code, name: t.name } };
  }
  if (identity.role === 'student') {
    const s = identity.student;
    return {
      ...base,
      name: `${s.prefix}${s.first_name} ${s.last_name}`.trim(),
      student: {
        id: s.id, student_code: s.student_code, prefix: s.prefix, first_name: s.first_name,
        last_name: s.last_name, classroom: s.classroom, number: s.number,
      },
    };
  }
  return { ...base, name: session.displayName || '' };
}
