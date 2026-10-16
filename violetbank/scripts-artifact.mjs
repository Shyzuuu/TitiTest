// Construit la version « lien partagé » : un fichier HTML autonome, sans balises de squelette
// (l'hébergeur ajoute <!doctype>, <html>, <head> et <body>).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VB_TARGET: 'artifact' } });
const html = readFileSync('dist-artifact/index.html', 'utf8');
// Le JS intégré contient lui-même des chaînes « </head> » et « </body> » (relevé de prêt) :
// on découpe donc sur les DERNIÈRES balises, qui sont les vraies.
const bodyOpen = html.lastIndexOf('<body>');
const headClose = html.lastIndexOf('</head>', bodyOpen);
const head = html.slice(html.indexOf('<head>') + 6, headClose);
const body = html.slice(bodyOpen + 6, html.lastIndexOf('</body>'));
const title = /<title>[\s\S]*?<\/title>/.exec(head)?.[0] ?? '<title>VioletBank Demo</title>';
const keep = head
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<link rel="icon"[^>]*>/i, '');
writeFileSync('dist-artifact/violetbank-demo.html', `${title.replace(/>[\s\S]*?</, '>VioletBank Demo<')}\n${keep.trim()}\n${body.trim()}\n`);
console.log('dist-artifact/violetbank-demo.html', (readFileSync('dist-artifact/violetbank-demo.html').length / 1024).toFixed(0), 'Ko');
