import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager } from '../../src/storage/SaveManager.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';
import { RunRepository, sanitizeRunName } from '../../src/storage/RunRepository.js';
import { buildRun } from '../helpers/runs.mjs';
import { computeChecksum } from '../../src/recorder/RunValidator.js';

const parseObj = (v) => {
  if (!v || typeof v !== 'object' || typeof v.n !== 'number') throw new Error('forme invalide');
  return v;
};

test('SaveManager : création, lecture, mise à jour, suppression', () => {
  const s = new MemoryStorage();
  const sm = new SaveManager(s);
  sm.writeAtomic('x', { n: 1 });
  assert.deepEqual(sm.read('x', parseObj), { value: { n: 1 }, source: 'primary', error: null });
  sm.writeAtomic('x', { n: 2 });
  assert.equal(sm.read('x', parseObj).value.n, 2);
  assert.equal(JSON.parse(s.getItem('sslab:x.bak')).n, 1, 'version précédente conservée');
  assert.equal(s.getItem('sslab:x.tmp'), null, 'aucun temporaire résiduel');
  sm.remove('x');
  assert.deepEqual(sm.read('x', parseObj), { value: null, source: 'none', error: null });
});

test('SaveManager : fichier invalide → repli sur la sauvegarde précédente', () => {
  const s = new MemoryStorage();
  const sm = new SaveManager(s);
  sm.writeAtomic('x', { n: 1 });
  sm.writeAtomic('x', { n: 2 });
  s.setItem('sslab:x', '{"n":');
  const r = sm.read('x', parseObj);
  assert.equal(r.source, 'backup');
  assert.equal(r.value.n, 1);
  assert.match(r.error, /corrompues/);
});

test('SaveManager : panne d\'écriture et quota → erreur claire, données précédentes intactes', () => {
  const s = new MemoryStorage();
  const sm = new SaveManager(s);
  sm.writeAtomic('x', { n: 1 });
  s.failNextWrites = 1;
  assert.throws(() => sm.writeAtomic('x', { n: 2 }), (e) => e.code === 'WRITE_FAILED');
  assert.equal(sm.read('x', parseObj).value.n, 1);
  const small = new SaveManager(new MemoryStorage(), { budgetChars: 100 });
  assert.throws(() => small.writeAtomic('big', { n: 1, pad: 'x'.repeat(200) }), (e) => e.code === 'QUOTA' && /Espace insuffisant/.test(e.message));
  const q = new MemoryStorage({ quotaChars: 50 });
  assert.throws(() => new SaveManager(q).writeAtomic('y', { n: 1, pad: 'y'.repeat(80) }), (e) => e.code === 'QUOTA');
});

test('SaveManager : validation après écriture et nettoyage des temporaires', () => {
  const s = new MemoryStorage();
  const sm = new SaveManager(s);
  assert.throws(() => sm.writeAtomic('x', { n: 1 }, { validate: () => { throw new Error('non'); } }));
  assert.equal(s.getItem('sslab:x'), null, 'rien n\'est publié si la validation échoue');
  s.setItem('sslab:orphan.tmp', '1');
  assert.equal(sm.cleanupTemporaries(), 1);
});

test('RunRepository : sauvegarde, liste, tri, recherche, renommage, duplication, suppression', () => {
  const sm = new SaveManager(new MemoryStorage());
  const repo = new RunRepository(sm);
  repo.load();
  const a = buildRun();
  repo.save(a);
  const b = structuredClone(a);
  b.id = 'run_other_0002';
  b.name = 'Zeta rapide';
  b.createdAt = new Date(Date.parse(a.createdAt) + 1000).toISOString();
  b.meta.score = 999;
  b.checksum = computeChecksum(b);
  repo.save(b);
  assert.deepEqual(repo.list({ sort: 'score' }).map((r) => r.score), [999, 50]);
  assert.deepEqual(repo.list({ sort: 'date', order: 'asc' }).map((r) => r.id), [a.id, b.id]);
  assert.deepEqual(repo.list({ search: 'zeta' }).map((r) => r.id), [b.id]);
  repo.rename(a.id, '  Ma run  ');
  assert.equal(repo.get(a.id).run.name, 'Ma run');
  const dup = repo.duplicate(a.id);
  assert.notEqual(dup.id, a.id);
  assert.equal(repo.get(dup.id).run.checksum, repo.get(a.id).run.checksum);
  repo.delete(dup.id);
  assert.throws(() => repo.get(dup.id), /introuvable/);
  assert.throws(() => repo.rename(a.id, ''), /vide/);
  assert.throws(() => sanitizeRunName('x'.repeat(81)));
});

test('RunRepository : export/import JSON, collision d\'identifiant, rejets', () => {
  const sm = new SaveManager(new MemoryStorage());
  const repo = new RunRepository(sm);
  repo.load();
  const run = buildRun();
  repo.save(run);
  const json = repo.exportJson(run.id);
  const res = repo.importJson(json);
  assert.equal(res.renamedId, true, 'jamais d\'écrasement silencieux');
  assert.equal(repo.index.length, 2);
  assert.throws(() => repo.importJson('{"format":'), /JSON invalide ou tronqué/);
  assert.throws(() => repo.importJson(JSON.stringify({ ...run, version: 42 })), /inconnue/);
  assert.throws(() => repo.importJson('x'.repeat(13 * 1024 * 1024)), /volumineux/);
});

test('RunRepository : run corrompue listée (jamais supprimée silencieusement), index reconstruit', () => {
  const storage = new MemoryStorage();
  const sm = new SaveManager(storage);
  const repo = new RunRepository(sm);
  repo.load();
  repo.save(buildRun());
  storage.setItem('sslab:run:run_broken_0001', '{"format":"subway-lab-run"');
  storage.setItem('sslab:runs:index', 'pas du json');
  storage.removeItem('sslab:runs:index.bak');
  const repo2 = new RunRepository(sm);
  repo2.load();
  assert.equal(repo2.index.length, 2);
  assert.equal(repo2.summary('run_broken_0001').integrity, 'corrupt');
  assert.equal(repo2.list({ validOnly: true }).length, 1);
  assert.ok(repo2.warnings.length >= 1);
});

