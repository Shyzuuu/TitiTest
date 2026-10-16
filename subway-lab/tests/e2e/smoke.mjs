/**
 * Test de bout en bout dans un vrai navigateur (Playwright + Chromium) :
 * clavier, glissement, REC, ralenti, pause, ressources, STOP + renommage,
 * rechargement de la page, chargement et rejeu depuis l'interface.
 * Usage : npm run test:e2e  (Playwright doit être installé localement ou globalement)
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

function loadPlaywright() {
  const candidates = [import.meta.url, '/opt/node-tools/node_modules/', `${process.env.NPM_CONFIG_PREFIX ?? '/usr/local'}/lib/node_modules/`];
  for (const base of candidates) {
    try {
      return createRequire(base)('playwright');
    } catch {
      /* candidat suivant */
    }
  }
  console.error('Playwright introuvable : npm i -D playwright (puis npx playwright install chromium).');
  process.exit(2);
}

const { chromium } = loadPlaywright();
const root = fileURLToPath(new URL('../../', import.meta.url));
const port = 8700 + Math.floor(Math.random() * 200);
const server = spawn(process.execPath, ['server.mjs', String(port)], { cwd: root, stdio: 'pipe' });
await new Promise((resolve) => server.stdout.once('data', resolve));
const url = `http://localhost:${port}/`;

const results = [];
/** @param {string} name @param {() => Promise<void>} fn */
async function step(name, fn) {
  try {
    await fn();
    results.push(['réussi', name]);
  } catch (e) {
    results.push(['ÉCHEC', `${name} — ${e instanceof Error ? e.message : e}`]);
  }
}

const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
const lab = (/** @type {string} */ expr) => page.evaluate(`(() => { const l = window.__lab; return ${expr}; })()`);
const waitState = (/** @type {string} */ s, timeout = 15000) => page.waitForFunction((st) => window.__lab?.fsm.state === st, s, { timeout });
const tab = (/** @type {string} */ label) => page.click(`.tab:text-is("${label}")`);

try {
  await page.goto(url);
  await waitState('READY');

  await step('REC depuis l\'écran d\'accueil', async () => {
    await page.click('#overlay-buttons button:has-text("REC")');
    await waitState('RECORDING');
    assert.equal(await lab('l.recorder.active'), true);
  });

  await step('Clavier : flèches, espace, bas, A/D', async () => {
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__lab.world.player.lane === 0);
    await page.keyboard.press('KeyD');
    await page.waitForFunction(() => window.__lab.world.player.lane === 1);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__lab.world.player.airborne || window.__lab.world.player.crashed);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    const types = await lab('l.recorder.events.map(e => e[3])');
    for (const t of ['LANE_LEFT', 'LANE_RIGHT', 'JUMP', 'SLIDE']) assert.ok(types.includes(t), `${t} enregistré`);
  });

  await step('Glissement (pointeur) vers la droite', async () => {
    const box = await page.locator('#stage').boundingBox();
    const lane = await lab('l.world.player.lane');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction((l) => window.__lab.world.player.lane === Math.min(2, l + 1) || window.__lab.world.player.crashed, lane);
  });

  await step('Ressources : ∞ les deux (et l\'autopilote garde la run en vie)', async () => {
    await tab('Ressources');
    await page.click('button:text-is("∞ Les deux")');
    assert.equal(await lab('l.resources.balance("coins")'), Infinity);
    assert.equal(await lab('l.resources.balance("keys")'), Infinity);
    await tab('Jeu');
    await page.check('#opt-autopilot');
    if (await lab('l.world.player.crashed')) await lab('l.revive()');
  });

  await step('Vitesse : préréglage 0,10× puis 1,00× sans interrompre l\'enregistrement', async () => {
    await tab('Vitesse');
    await page.click('[data-speed="0.1"]');
    assert.equal(await lab('l.clock.multiplier'), 0.1);
    const t0 = await lab('l.globalTick');
    await page.waitForTimeout(1000);
    const slow = (await lab('l.globalTick')) - t0;
    await page.click('[data-speed="1"]');
    const t1 = await lab('l.globalTick');
    await page.waitForTimeout(1000);
    const fast = (await lab('l.globalTick')) - t1;
    assert.ok(fast > slow * 4, `pas/s : ${slow} à 0,10× contre ${fast} à 1,00×`);
    assert.equal(await lab('l.fsm.state'), 'RECORDING');
    const speeds = await lab('l.recorder.events.filter(e => e[3] === "SPEED_CHANGE").map(e => e[4].to)');
    assert.deepEqual(speeds, [0.1, 1]);
  });

  await step('Échap : pause puis reprise', async () => {
    await page.keyboard.press('Escape');
    await waitState('RECORDING_PAUSED');
    const t = await lab('l.globalTick');
    await page.waitForTimeout(400);
    assert.equal(await lab('l.globalTick'), t);
    await page.keyboard.press('Escape');
    await waitState('RECORDING');
  });

  await step('STOP + renommage dans la boîte de dialogue', async () => {
    await page.waitForTimeout(1500);
    await tab('REC');
    await page.click('button:text-is("■ STOP")');
    await page.waitForSelector('dialog[open]');
    await page.fill('#dialog-input', 'Run E2E');
    await page.click('dialog button[value="ok"]');
    await page.waitForFunction(() => window.__lab.repo.index.some((r) => r.name === 'Run E2E'));
    assert.equal(await lab('l.fsm.state'), 'FINISHED');
  });

  await step('Rechargement de la page : run persistée et listée', async () => {
    await page.reload();
    await waitState('READY');
    await tab('Runs');
    await page.waitForSelector('.run-item:has-text("Run E2E")');
  });

  await step('Rejeu depuis le panneau : chargement, lecture, rapport exact', async () => {
    await tab('Rejeu');
    const id = await lab('l.repo.index.find(r => r.name === "Run E2E").id');
    await page.selectOption('.panel-section[data-panel="rejeu"] select', id);
    const panel = '.panel-section[data-panel="rejeu"]';
    await page.click(`${panel} button:text-is("Charger")`);
    await page.click(`${panel} button:text-is("▶ Lecture")`);
    await waitState('REPLAYING');
    await page.click(`${panel} button:text-is("⏸ Pause")`);
    await waitState('REPLAY_PAUSED');
    const frozen = await lab('l.globalTick');
    await page.waitForTimeout(300);
    assert.equal(await lab('l.globalTick'), frozen, 'PAUSE du rejeu effective');
    await page.click(`${panel} button:text-is("⏵ Reprendre")`);
    await waitState('FINISHED', 60000);
    const exact = await lab('l.lastReplayReport.exact');
    assert.equal(exact, true, await lab('l.lastReplayReport.verdict'));
    await page.waitForSelector('.report .ok-text');
  });

  await step('Boutique : débloquer et équiper un personnage, acheter un hoverboard', async () => {
    await tab('Boutique');
    const card = page.locator('.char-card', { hasText: 'Néa' });
    await card.locator('button:text-is("Débloquer")').click();
    await card.locator('button:text-is("Équiper")').click();
    assert.equal(await lab('l.shop.profile.equippedCharacter'), 'NEON');
    await page.locator('.shop-list li', { hasText: 'Hoverboard ×1' }).locator('button').click();
    assert.equal(await lab('l.shop.profile.hoverboards'), 1);
  });

  await step('Hoverboard par double appui pendant une partie', async () => {
    await page.click('#overlay-buttons button:has-text("Nouvelle partie")');
    await waitState('RUNNING');
    const box = await page.locator('#stage').boundingBox();
    const x = box.x + box.width / 3;
    const y = box.y + box.height / 2;
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await page.waitForFunction(() => window.__lab.world.hoverboardTicks > 0 || window.__lab.world.hoverboardsUsed > 0, null, { timeout: 3000 });
    assert.equal(await lab('l.world.config.skin'), 'NEON');
  });

  await step('Aucune erreur JavaScript dans la page', async () => {
    assert.deepEqual(pageErrors, []);
  });

  await page.screenshot({ path: fileURLToPath(new URL('./last-run.png', import.meta.url)) });
} finally {
  await browser.close();
  server.kill();
}

for (const [status, name] of results) console.log(`${status.padEnd(7)} ${name}`);
const failed = results.filter(([s]) => s !== 'réussi').length;
console.log(`\n${results.length - failed}/${results.length} étapes réussies`);
process.exit(failed ? 1 : 0);
