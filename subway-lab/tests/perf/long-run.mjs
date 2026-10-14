/**
 * Mesure de performance : run de 30 minutes simulées au pilote automatique,
 * enregistrée, sauvegardée, puis rejouée et comparée. Affiche des mesures
 * réelles (pas d'objectif inventé). Usage : npm run test:perf [minutes]
 */

import { performance } from 'node:perf_hooks';
import { LabController } from '../../src/app/LabController.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';
import { formatReport } from '../../src/replay/ReplayComparator.js';
import { DEFAULT_BUDGET_CHARS } from '../../src/storage/SaveManager.js';

const minutes = Number(process.argv[2] ?? 30);
const ticks = Math.round(minutes * 60 * 60);
const storage = new MemoryStorage({ quotaChars: DEFAULT_BUDGET_CHARS });
const lab = new LabController({ storage }).init();
lab.resources.enableUnlimited('both');
lab.autopilot = true;

const heap0 = process.memoryUsage().heapUsed;
let t = performance.now();
lab.startRun({ record: true, seed: 30303, name: `Run longue ${minutes} min` });
lab.advanceTicks(ticks);
lab.autopilot = false;
const rec = lab.stopRecording();
const recordMs = performance.now() - t;
if (!rec.ok) {
  console.error('Sauvegarde impossible :', rec.error);
  process.exit(1);
}
const heap1 = process.memoryUsage().heapUsed;

t = performance.now();
lab.startReplay(rec.summary.id);
lab.advanceTicks(Number.MAX_SAFE_INTEGER);
const replayMs = performance.now() - t;
const report = lab.lastReplayReport;

const fmt = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
console.log(`Durée simulée            : ${minutes} min (${fmt(ticks)} pas)`);
console.log(`Simulation + enregistrement : ${fmt(recordMs)} ms (${fmt((recordMs * 1000) / ticks)} µs/pas)`);
console.log(`Rejeu + comparaison      : ${fmt(replayMs)} ms (${fmt((replayMs * 1000) / ticks)} µs/pas)`);
console.log(`Événements               : ${fmt(rec.summary.eventCount)}`);
console.log(`Taille de la run         : ${fmt((rec.summary.chars * 2) / 1024)} Ko (UTF-16, localStorage)`);
console.log(`Écritures de stockage    : ${storage.writes}`);
console.log(`Distance / score         : ${fmt(rec.summary.distance)} m / ${fmt(rec.summary.score)}`);
console.log(`Résurrections            : ${rec.run.events.filter((e) => e[3] === 'REVIVE').length}`);
console.log(`Tas JS après enregistrement : +${fmt((heap1 - heap0) / 1048576)} Mo`);
console.log(formatReport(report).join('\n'));
process.exit(report.exact ? 0 : 1);
