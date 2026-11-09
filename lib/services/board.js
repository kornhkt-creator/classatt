// Pure functions: combine students + submissions into board rows and summaries (easy to test).

export function submissionStatus(submission) {
  return submission?.status || 'not_submitted';
}

export function isOverdue(assignment, now = new Date()) {
  return new Date(assignment.due_at).getTime() < new Date(now).getTime();
}

export function publicStudent(s) {
  return { id: s.id, number: s.number, prefix: s.prefix, first_name: s.first_name, last_name: s.last_name };
}

export function publicSubmission(sub) {
  if (!sub) return null;
  return {
    status: sub.status, note: sub.note, link_url: sub.link_url, submitted_at: sub.submitted_at,
    is_late: sub.is_late, teacher_comment: sub.teacher_comment, reviewed_at: sub.reviewed_at,
  };
}

export function emptySummary() {
  return { total: 0, not_submitted: 0, submitted: 0, approved: 0, revise: 0, late: 0 };
}

export function buildBoard(assignment, students, submissions) {
  const byStudent = new Map(submissions.map((s) => [s.student_id, s]));
  const summary = emptySummary();
  const rows = students.map((student) => {
    const sub = byStudent.get(student.id) || null;
    const status = submissionStatus(sub);
    const isLate = Boolean(sub?.is_late && status !== 'not_submitted');
    summary.total += 1;
    summary[status] += 1;
    if (isLate) summary.late += 1;
    return { student: publicStudent(student), submission: publicSubmission(sub), status, isLate };
  });
  return { rows, summary };
}

// Matrix cell: approved | submitted | revise | missing (not sent & past due) | pending (not sent, not yet due)
export function cellStatus(status, assignment, now = new Date()) {
  if (status === 'approved' || status === 'submitted' || status === 'revise') return status;
  return isOverdue(assignment, now) ? 'missing' : 'pending';
}

export function buildMatrix(students, assignments, submissions, now = new Date()) {
  const key = (a, s) => `${a}:${s}`;
  const subs = new Map(submissions.map((s) => [key(s.assignment_id, s.student_id), s]));
  const cells = {};
  const outstanding = {};
  for (const student of students) {
    cells[student.id] = {};
    outstanding[student.id] = 0;
    for (const assignment of assignments) {
      const status = submissionStatus(subs.get(key(assignment.id, student.id)));
      cells[student.id][assignment.id] = cellStatus(status, assignment, now);
      if (status === 'not_submitted' || status === 'revise') outstanding[student.id] += 1;
    }
  }
  return { cells, outstanding };
}
