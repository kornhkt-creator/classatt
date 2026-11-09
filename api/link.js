import { createApi } from '../lib/http.js';
import { requireSession } from '../lib/guard.js';
import { linkStudent, linkTeacher } from '../lib/services/link.js';

export default createApi({
  // POST /api/link?op=student { studentCode, verifyCode, confirm }
  student: {
    method: 'POST',
    handler: async ({ req, body }) => linkStudent(await requireSession(req), body),
  },
  // POST /api/link?op=teacher { teacherCode, regCode, confirm }
  teacher: {
    method: 'POST',
    handler: async ({ req, body }) => linkTeacher(await requireSession(req), body),
  },
});
