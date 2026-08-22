/**
 * Static server for the built frontend.
 *
 * `vite preview` is explicitly not meant for anything but local preview, so
 * this serves `dist/` with a tiny zero-dependency handler instead: correct
 * MIME types, long-lived caching for fingerprinted assets, and an SPA
 * fallback so deep links like /trips/:id survive a hard refresh.
 *
 * Binds 0.0.0.0 so phones on the same network can reach it.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Strip the query and normalise, then confine to ROOT so `..` cannot escape.
  const requested = decodeURIComponent(url.pathname);
  const resolved = path.normalize(path.join(ROOT, requested));
  if (!resolved.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.stat(resolved, (err, stat) => {
    const isFile = !err && stat.isFile();

    // Anything that is not a real file falls back to index.html — that is what
    // makes client-side routes work on a full page load.
    const file = isFile ? resolved : path.join(ROOT, 'index.html');
    const ext = path.extname(file).toLowerCase();

    fs.readFile(file, (readErr, data) => {
      if (readErr) return send(res, 404, 'Not found');

      // Vite fingerprints everything under /assets, so those are immutable.
      // index.html must never be cached or users get stuck on an old build.
      const cacheControl = file.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache';

      send(res, isFile ? 200 : 200, data, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': cacheControl,
      });
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`GlobeTrotter frontend serving ${ROOT} on http://${HOST}:${PORT}`);
});
