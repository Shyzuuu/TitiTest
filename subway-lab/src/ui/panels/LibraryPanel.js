/** Panneau « Runs » : bibliothèque locale (tri, recherche, import/export, comparaison). */

import { MAX_IMPORT_BYTES } from '../../recorder/EventSchema.js';
import { compareRuns, formatReport } from '../../replay/ReplayComparator.js';
import { formatChars } from '../../storage/SaveManager.js';
import { button, downloadText, fmtDate, fmtInt, fmtNum, fmtTime, h, readFileText, setDisabled, setText } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createLibraryPanel(ctx) {
  const { lab } = ctx;
  const err = ctx.onError;
  const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: 'Rechercher par nom…' }));
  const sort = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Tri' },
    h('option', { value: 'date' }, 'Date'), h('option', { value: 'duration' }, 'Durée'), h('option', { value: 'score' }, 'Score'), h('option', { value: 'name' }, 'Nom')));
  const order = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Ordre' }, h('option', { value: 'desc' }, '↓'), h('option', { value: 'asc' }, '↑')));
  const validOnly = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
  const fileInput = /** @type {HTMLInputElement} */ (h('input', { type: 'file', accept: 'application/json,.json', hidden: true }));
  const list = h('ul', { class: 'run-list' });
  const usage = h('p', { class: 'hint' });
  const cmpA = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Run A' }));
  const cmpB = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Run B' }));
  const cmpOut = h('div', { class: 'report' });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await readFileText(file, MAX_IMPORT_BYTES);
      const res = lab.repo.importJson(text);
      ctx.toast('success', `Import réussi : « ${res.summary.name} »${res.renamedId ? ' (nouvel identifiant attribué)' : ''}.`);
      for (const w of res.warnings) ctx.toast('warning', w);
      ctx.refreshLibrary();
    } catch (e) {
      err(e);
    }
  });
  for (const input of [search, sort, order, validOnly]) input.addEventListener('input', () => ctx.refreshLibrary());

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Bibliothèque de runs'),
    h('div', { class: 'row' }, search, sort, order),
    h('div', { class: 'row' },
      h('label', { class: 'check' }, validOnly, ' Valides uniquement'),
      button('Importer JSON…', () => fileInput.click(), err),
      fileInput,
    ),
    usage,
    list,
    h('h4', {}, 'Comparer deux runs'),
    h('div', { class: 'row' }, cmpA, cmpB, button('Comparer', () => {
      if (!cmpA.value || !cmpB.value) throw new Error('Choisissez deux runs.');
      const a = lab.repo.get(cmpA.value).run;
      const b = lab.repo.get(cmpB.value).run;
      const r = compareRuns(a, b);
      cmpOut.replaceChildren(...formatReport(r).map((l) => h('p', {}, l)));
    }, err)),
    cmpOut,
  );

  /**
   * @param {import('../../storage/RunRepository.js').RunSummary} s
   */
  function item(s) {
    const details = h('div', { class: 'run-details', hidden: true });
    const actions = h('div', { class: 'btn-row small' },
      button('▶ Rejouer', () => {
        lab.startReplay(s.id);
        ctx.closePanelOnMobile();
      }, err, { disabled: s.integrity === 'corrupt' || !lab.capabilities().loadReplay }),
      button('Renommer', async () => {
        const name = await ctx.prompt('Nouveau nom de la run :', s.name);
        if (name === null) return;
        lab.repo.rename(s.id, name);
        ctx.refreshLibrary();
      }, err, { disabled: s.integrity === 'corrupt' }),
      button('Dupliquer', () => {
        lab.repo.duplicate(s.id);
        ctx.refreshLibrary();
      }, err, { disabled: s.integrity === 'corrupt' }),
      button('Exporter', () => downloadText(`${s.name.replace(/[^\w\-]+/g, '_').slice(0, 40)}_${s.id}.json`, lab.repo.exportJson(s.id)), err, { disabled: s.integrity === 'corrupt' }),
      button('Détails', () => {
        details.hidden = !details.hidden;
        if (!details.hidden && details.childElementCount === 0) {
          try {
            const { run, warnings } = lab.repo.get(s.id);
            const counts = /** @type {Record<string, number>} */ ({});
            for (const e of run.events) counts[e[3]] = (counts[e[3]] ?? 0) + 1;
            details.append(
              h('p', {}, `Graine ${run.setup.seed} · physique v${run.setup.physicsVersion} · vitesse initiale ${run.setup.initialSpeed} · empreinte ${run.checksum}`),
              h('p', {}, `Configuration : ${JSON.stringify(run.setup.config)}`),
              h('p', {}, `Événements : ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}`),
              ...warnings.map((w) => h('p', { class: 'error-text' }, w)),
            );
          } catch (e) {
            details.append(h('p', { class: 'error-text' }, /** @type {Error} */ (e).message));
          }
        }
      }, err),
      button('Supprimer', async () => {
        if (!(await ctx.confirm(`Supprimer définitivement « ${s.name} » ?`))) return;
        lab.repo.delete(s.id);
        ctx.refreshLibrary();
      }, err, { class: 'danger' }),
    );
    const badge = s.integrity === 'ok' ? '✔ intègre' : s.integrity === 'recovered' ? '⚠ récupérée' : '✖ corrompue';
    return h('li', { class: `run-item ${s.integrity}` },
      h('div', { class: 'run-title' }, h('strong', {}, s.name), h('span', { class: `badge ${s.integrity}` }, badge)),
      h('div', { class: 'run-meta' },
        `${fmtDate(s.createdAt)} · réel ${fmtTime(s.realDurationMs / 1000)} · simulé ${fmtTime(s.simDurationS)} · score ${fmtInt(s.score)} · ${fmtNum(s.distance)} m · ${s.eventCount} évts · v${s.version} · ${formatChars(s.chars)}`),
      actions,
      details,
    );
  }

  function refresh() {
    const runs = lab.repo.list({
      sort: /** @type {'date'} */ (sort.value), order: /** @type {'asc'} */ (order.value), search: search.value, validOnly: validOnly.checked,
    });
    list.replaceChildren(...(runs.length ? runs.map(item) : [h('li', { class: 'hint' }, 'Aucune run. Appuyez sur REC pour en enregistrer une.')]));
    const all = lab.repo.list({ validOnly: true });
    for (const sel of [cmpA, cmpB]) {
      const cur = sel.value;
      sel.replaceChildren(h('option', { value: '' }, '—'), ...all.map((r) => h('option', { value: r.id }, r.name)));
      if (all.some((r) => r.id === cur)) sel.value = cur;
    }
    setText(usage, `${lab.repo.index.length} run(s) · stockage utilisé ${formatChars(lab.saveManager.usageChars())} / ${formatChars(lab.saveManager.budgetChars)}`);
    return lab.repo.list();
  }

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    for (const b of list.querySelectorAll('button')) {
      if (b.textContent === '▶ Rejouer') setDisabled(/** @type {HTMLButtonElement} */ (b), !s.caps.loadReplay || b.closest('.corrupt') !== null);
    }
  }

  return { id: 'runs', title: 'Runs', el, update, refresh };
}
