// Local dev server (alternative to `vercel dev`, no Vercel login needed).
// Serves public/ with clean URLs and runs api/*.js handlers the same way Vercel does.
// Run: npm run dev:local
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const apiDir = path.join(root, 'api');
const port = Number(process.env.PORT || 3000);

// Demo mode (npm run dev:demo): in-memory database with the seed data, no Supabase or LINE needed.
const demo = process.env.DEMO === '1' || process.argv.includes('--demo');
if (demo) {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://demo.invalid',
    SUPABASE_SECRET_KEY: 'demo-secret-key-not-real-000000',
    SESSION_SECRET: 'demo-session-secret-only-for-local-testing-000000',
    LINE_CHANNEL_ID: '1234567890',
    LIFF_ID: '1234567890-DemoOnly',
    DEV_MOCK_LOGIN: 'true',
  });
  const { createFakeSupabase, seedDemo } = await import(pathToFileURL(path.join(root, 'scripts', 'fake-supabase.js')).href);
  const { setSupabaseForTests } = await import(pathToFileURL(path.join(root, 'lib', 'supabase.js')).href);
  setSupabaseForTests(seedDemo(createFakeSupabase()));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

async function resolveStatic(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\/+$/, '') || '';
  const target = path.normalize(path.join(publicDir, clean));
  if (!target.startsWith(publicDir)) return null;
  for (const candidate of [target, `${target}.html`, path.join(target, 'index.html')]) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const apiMatch = url.pathname.match(/^\/api\/([a-z0-9-]+)\/?$/);
    if (apiMatch) {
      const file = path.join(apiDir, `${apiMatch[1]}.js`);
      if (!(await isFile(file))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end('{"error":{"code":"not_found","message":"ไม่พบ API"}}');
      }
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    const file = await resolveStatic(url.pathname);
    if (!file) {
      const notFound = path.join(publicDir, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end((await isFile(notFound)) ? await readFile(notFound) : 'Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`ClassTrack dev server: http://localhost:${port}${demo ? '  (DEMO: ฐานข้อมูลจำลองในหน่วยความจำ ข้อมูลหายเมื่อปิด)' : ''}`);
  console.log('ทดสอบแบบจำลองผู้ใช้: http://localhost:%d/?mockUser=U_mock_t1', port);
});
