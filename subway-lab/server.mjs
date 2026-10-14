/**
 * Serveur statique minimal (aucune dépendance) pour lancer le laboratoire en local.
 * Usage : node server.mjs [port]  — écoute sur 0.0.0.0 pour un accès depuis un téléphone du même réseau.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const ALLOWED_TOP = new Set(['index.html', 'src', 'public', 'manifest.webmanifest', 'sw.js']);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    rel = normalize(rel);
    const top = rel.split(sep)[0];
    // Seuls les fichiers de l'application sont servis (pas les tests, ni node_modules).
    if (rel.startsWith('..') || !ALLOWED_TOP.has(top)) {
      res.writeHead(404).end('Introuvable');
      return;
    }
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Interdit');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end('Introuvable');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Introuvable');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Subway Lab : http://localhost:${PORT}/`);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  Réseau local (téléphone) : http://${a.address}:${PORT}/`);
    }
  }
});
