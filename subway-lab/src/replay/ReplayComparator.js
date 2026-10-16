/**
 * Comparaison événement par événement entre une run d'origine et son rejeu
 * (ou entre deux runs quelconques). Les événements de contrôle (pause,
 * vitesse) sont exclus : ils n'influencent pas la simulation à pas fixe.
 * Complexité O(n) : regroupement par type puis appariement par rang.
 */

import { EVENT_TYPES } from '../recorder/EventSchema.js';

const MAX_SAMPLES = 25;

/** @typedef {import('../recorder/EventSchema.js').EventTuple} EventTuple */

/**
 * @typedef {{ exact: boolean, partial: boolean, verdict: string,
 *   totals: { original: number, replay: number, matched: number, missing: number, extra: number, timingDiffs: number, payloadDiffs: number, maxTimingTicks: number },
 *   checkpoints: { compared: number, mismatched: number, maxPositionDelta: number, maxScoreDelta: number, maxDistanceDelta: number },
 *   final: { originalScore: number, replayScore: number, originalDistance: number, replayDistance: number, scoreDelta: number, distanceDelta: number, compared: boolean },
 *   firstDivergence: { tick: number, type: string, detail: string } | null,
 *   samples: { kind: string, type: string, tick: number, detail: string }[],
 *   byType: Record<string, { original: number, replay: number }> }} ComparisonReport
 */

/**
 * @param {{ events: EventTuple[], meta?: { score: number, distance: number, recovered?: boolean } }} original
 * @param {{ events: EventTuple[], meta?: { score: number, distance: number } }} replay
 * @param {{ untilTick?: number }} [options] limite pour un rejeu interrompu
 * @returns {ComparisonReport}
 */
export function compareRuns(original, replay, { untilTick = Infinity } = {}) {
  const partial = Number.isFinite(untilTick);
  const groupA = groupByType(original.events, untilTick);
  const groupB = groupByType(replay.events, untilTick);
  const totals = { original: 0, replay: 0, matched: 0, missing: 0, extra: 0, timingDiffs: 0, payloadDiffs: 0, maxTimingTicks: 0 };
  const checkpoints = { compared: 0, mismatched: 0, maxPositionDelta: 0, maxScoreDelta: 0, maxDistanceDelta: 0 };
  /** @type {ComparisonReport['samples']} */
  const samples = [];
  /** @type {ComparisonReport['firstDivergence']} */
  let first = null;
  /** @type {ComparisonReport['byType']} */
  const byType = {};

  /**
   * @param {string} kind
   * @param {string} type
   * @param {number} tick
   * @param {string} detail
   */
  const note = (kind, type, tick, detail) => {
    if (samples.length < MAX_SAMPLES) samples.push({ kind, type, tick, detail });
    if (!first || tick < first.tick) first = { tick, type, detail: `${kind} : ${detail}` };
  };

  const types = new Set([...groupA.keys(), ...groupB.keys()]);
  for (const type of [...types].sort()) {
    const a = groupA.get(type) ?? [];
    const b = groupB.get(type) ?? [];
    byType[type] = { original: a.length, replay: b.length };
    totals.original += a.length;
    totals.replay += b.length;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const ea = a[i];
      const eb = b[i];
      const dt = eb[1] - ea[1];
      if (dt !== 0) {
        totals.timingDiffs++;
        totals.maxTimingTicks = Math.max(totals.maxTimingTicks, Math.abs(dt));
        note('écart temporel', type, Math.min(ea[1], eb[1]), `#${i} au tick ${ea[1]} dans l'original, ${eb[1]} au rejeu`);
      }
      if (type === 'CHECKPOINT') {
        checkpoints.compared++;
        const pa = /** @type {Record<string, number|string>} */ (ea[4]);
        const pb = /** @type {Record<string, number|string>} */ (eb[4]);
        const dx = Math.abs(Number(pa.x) - Number(pb.x));
        const dy = Math.abs(Number(pa.y) - Number(pb.y));
        checkpoints.maxPositionDelta = Math.max(checkpoints.maxPositionDelta, Math.hypot(dx, dy));
        checkpoints.maxScoreDelta = Math.max(checkpoints.maxScoreDelta, Math.abs(Number(pa.s) - Number(pb.s)));
        checkpoints.maxDistanceDelta = Math.max(checkpoints.maxDistanceDelta, Math.abs(Number(pa.d) - Number(pb.d)));
        if (pa.h !== pb.h) {
          checkpoints.mismatched++;
          totals.payloadDiffs++;
          note('divergence d\'état', type, ea[1], `empreinte ${pa.h} ≠ ${pb.h} (score ${pa.s}/${pb.s}, distance ${pa.d}/${pb.d}, voie ${pa.ln}/${pb.ln})`);
        } else totals.matched++;
        continue;
      }
      const ja = JSON.stringify(ea[4]);
      const jb = JSON.stringify(eb[4]);
      if (ja !== jb) {
        totals.payloadDiffs++;
        note('données différentes', type, ea[1], `${ja} ≠ ${jb}`);
      } else if (dt === 0) totals.matched++;
    }
    for (let i = n; i < a.length; i++) {
      totals.missing++;
      note('manquant au rejeu', type, a[i][1], `#${i} au tick ${a[i][1]}`);
    }
    for (let i = n; i < b.length; i++) {
      totals.extra++;
      note('supplémentaire au rejeu', type, b[i][1], `#${i} au tick ${b[i][1]}`);
    }
  }

  const recovered = !!original.meta?.recovered;
  const finalCompared = !partial && !recovered && !!original.meta && !!replay.meta;
  const final = {
    originalScore: original.meta?.score ?? 0,
    replayScore: replay.meta?.score ?? 0,
    originalDistance: original.meta?.distance ?? 0,
    replayDistance: replay.meta?.distance ?? 0,
    scoreDelta: 0,
    distanceDelta: 0,
    compared: finalCompared,
  };
  final.scoreDelta = final.replayScore - final.originalScore;
  final.distanceDelta = Math.round((final.replayDistance - final.originalDistance) * 1000) / 1000;

  const finalOk = !finalCompared || (final.scoreDelta === 0 && final.distanceDelta === 0);
  const exact = totals.missing === 0 && totals.extra === 0 && totals.timingDiffs === 0 && totals.payloadDiffs === 0 && finalOk;
  /** @type {ComparisonReport['firstDivergence']} */
  const firstDivergence = first;
  let verdict;
  if (exact) verdict = partial ? 'Identique jusqu\'au point d\'arrêt.' : 'Reproduction exacte : tous les critères sont satisfaits.';
  else if (firstDivergence) verdict = `Divergence détectée au tick ${firstDivergence.tick} (${firstDivergence.type}).`;
  else verdict = 'Résultat final différent.';
  return { exact, partial, verdict, totals, checkpoints, final, firstDivergence, samples, byType };
}

/**
 * @param {EventTuple[]} events
 * @param {number} untilTick
 * @returns {Map<string, EventTuple[]>}
 */
function groupByType(events, untilTick) {
  /** @type {Map<string, EventTuple[]>} */
  const map = new Map();
  for (const e of events) {
    const type = e[3];
    const cat = EVENT_TYPES[type]?.category;
    if (cat === 'control' || cat === undefined) continue;
    if (e[1] >= untilTick) continue;
    let list = map.get(type);
    if (!list) map.set(type, (list = []));
    list.push(e);
  }
  return map;
}

/**
 * @param {ComparisonReport} r
 * @returns {string[]} lignes lisibles
 */
export function formatReport(r) {
  const lines = [
    r.verdict,
    `Événements comparés : ${r.totals.original} (original) / ${r.totals.replay} (rejeu), ${r.totals.matched} identiques.`,
    `Manquants : ${r.totals.missing} · Supplémentaires : ${r.totals.extra} · Écarts temporels : ${r.totals.timingDiffs} (max ${r.totals.maxTimingTicks} pas) · Données différentes : ${r.totals.payloadDiffs}.`,
    `Points de contrôle : ${r.checkpoints.compared} comparés, ${r.checkpoints.mismatched} divergents · écart max position ${r.checkpoints.maxPositionDelta.toFixed(3)} m, score ${r.checkpoints.maxScoreDelta}, distance ${r.checkpoints.maxDistanceDelta.toFixed(3)} m.`,
  ];
  if (r.final.compared) {
    lines.push(`Final : score ${r.final.originalScore} → ${r.final.replayScore} (Δ ${r.final.scoreDelta}), distance ${r.final.originalDistance} → ${r.final.replayDistance} m (Δ ${r.final.distanceDelta}).`);
  }
  if (r.firstDivergence) lines.push(`Première divergence : tick ${r.firstDivergence.tick}, ${r.firstDivergence.type} — ${r.firstDivergence.detail}.`);
  return lines;
}
