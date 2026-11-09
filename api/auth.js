import { z } from 'zod';
import { createApi } from '../lib/http.js';
import { verifyIdToken } from '../lib/line-verify.js';
import { resolveIdentity, toMe } from '../lib/identity.js';
import { clearSessionCookie, createSessionCookie } from '../lib/session.js';
import { requireSession } from '../lib/guard.js';

const lineSchema = z.object({
  idToken: z.string({ error: 'ไม่ได้รับข้อมูลยืนยันตัวตนจาก LINE' }).min(1, 'ไม่ได้รับข้อมูลยืนยันตัวตนจาก LINE').max(4096),
});

export default createApi({
  // POST /api/auth?op=line { idToken } — verify with LINE, then create the session cookie
  line: {
    method: 'POST',
    handler: async ({ req, res, body }) => {
      const { idToken } = lineSchema.parse(body);
      const profile = await verifyIdToken(idToken, req);
      const identity = await resolveIdentity(profile.lineUserId);
      res.setHeader('Set-Cookie', await createSessionCookie(profile, req));
      return toMe(profile, identity);
    },
  },
  // GET /api/auth?op=me
  me: {
    method: 'GET',
    handler: async ({ req }) => {
      const ctx = await requireSession(req);
      return toMe(ctx.session, ctx);
    },
  },
  // POST /api/auth?op=logout
  logout: {
    method: 'POST',
    handler: async ({ req, res }) => {
      res.setHeader('Set-Cookie', clearSessionCookie(req));
      return { ok: true };
    },
  },
});
