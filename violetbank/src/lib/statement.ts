import { formatDate } from '../domain/dates';
import { formatMoney, formatRate, type CurrencyCode } from '../domain/money';
import type { BankState, Loan } from '../domain/schema';
import { installmentDisplayStatus, loanOutstanding, loanPaidInterest, loanRepaidPrincipal, loanTotalPaid } from '../domain/selectors';
import { INSTALLMENT_LABEL, REPAYMENT_MODE_LABEL } from './labels';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Relevé autonome (HTML imprimable) portant un filigrane de simulation sur chaque page. */
export function loanStatementHtml(state: BankState, loan: Loan, today: string, generatedAt: string): string {
  const cur = state.settings.currency as CurrencyCode;
  const m = (c: number) => esc(formatMoney(c, { currency: cur }));
  const app = 'VBanque';
  const rows = loan.schedule
    .map((i) => `<tr><td>${i.index}</td><td>${formatDate(i.dueDate)}</td><td class="r">${m(i.amount)}</td><td class="r">${m(i.principal)}</td><td class="r">${m(i.interest)}</td><td class="r">${m(i.balanceAfter)}</td><td>${esc(INSTALLMENT_LABEL[installmentDisplayStatus(i, today, loan)])}</td></tr>`)
    .join('');
  const payments = loan.payments.length
    ? loan.payments
        .map((p) => `<tr><td>${formatDate(p.date)}</td><td>${esc({ installment: 'Échéance', partial: 'Paiement partiel', prepayment: 'Remboursement anticipé', payoff: 'Remboursement total' }[p.kind])}${p.installmentIndex ? ` n°${p.installmentIndex}` : ''}</td><td class="r">${m(p.amount)}</td><td class="r">${m(p.principal)}</td><td class="r">${m(p.interest)}</td><td>${p.reversed ? 'Contrepassé' : 'Enregistré'}</td></tr>`)
        .join('')
    : '<tr><td colspan="6">Aucun paiement fictif enregistré.</td></tr>';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relevé de simulation ${esc(loan.reference)}</title>
<style>
*{box-sizing:border-box}body{font-family:Inter,system-ui,Segoe UI,Roboto,sans-serif;color:#101014;margin:0;padding:32px;background:#fff;position:relative}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.wm span{transform:rotate(-30deg);font-size:34px;font-weight:900;color:rgba(118,86,246,.13);text-align:center;line-height:1.3;max-width:90%}
main{position:relative;z-index:1;max-width:900px;margin:0 auto}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7656F6;padding-bottom:16px;gap:16px;flex-wrap:wrap}
h1{margin:0;font-size:22px}h2{font-size:16px;margin:28px 0 8px;color:#4930B5}
.banner{margin:16px 0;padding:12px 16px;border:2px dashed #E44F62;border-radius:12px;color:#B42335;font-weight:700;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.kv{background:#F7F7FB;border-radius:10px;padding:10px 12px}.kv b{display:block;font-size:15px}.kv small{color:#6E6E7A}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 8px;border-bottom:1px solid #E6E4F0;text-align:left}th{background:#E9E3FF}.r{text-align:right;font-variant-numeric:tabular-nums}
footer{margin-top:28px;font-size:11px;color:#6E6E7A}
@media print{body{padding:0}.wm{position:fixed}}
</style></head><body>
<div class="wm"><span>VBANQUE — DOCUMENT FICTIF — SANS VALEUR BANCAIRE OU CONTRACTUELLE</span></div>
<main>
<header><div><h1>${app} — Relevé de prêt fictif</h1><div>Identifiant : <b>${esc(loan.reference)}</b> · ${esc(loan.label)}</div></div><div>Généré le ${formatDate(generatedAt, 'long')}<br>Date de simulation : ${formatDate(today, 'long')}</div></header>
<div class="banner">VBANQUE — DOCUMENT FICTIF — SANS VALEUR BANCAIRE OU CONTRACTUELLE. Relevé de test, ce n’est pas un contrat.</div>
<div class="grid">
<div class="kv"><small>Capital simulé</small><b>${m(loan.principal)}</b></div>
<div class="kv"><small>Durée initiale</small><b>${loan.months} mois</b></div>
<div class="kv"><small>Taux hypothétique actuel</small><b>${esc(formatRate(loan.annualRateBps))}</b></div>
<div class="kv"><small>Mode</small><b>${esc(REPAYMENT_MODE_LABEL[loan.repaymentMode])}</b></div>
<div class="kv"><small>Date de début</small><b>${formatDate(loan.startDate)}</b></div>
<div class="kv"><small>Capital remboursé</small><b>${m(loanRepaidPrincipal(loan))}</b></div>
<div class="kv"><small>Intérêts payés</small><b>${m(loanPaidInterest(loan))}</b></div>
<div class="kv"><small>Total payé</small><b>${m(loanTotalPaid(loan))}</b></div>
<div class="kv"><small>Capital restant dû (simulation)</small><b>${m(loanOutstanding(loan))}</b></div>
</div>
<h2>Échéancier</h2><table><thead><tr><th>N°</th><th>Date</th><th class="r">Montant</th><th class="r">Capital</th><th class="r">Intérêts</th><th class="r">Restant dû</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Paiements fictifs enregistrés</h2><table><thead><tr><th>Date</th><th>Nature</th><th class="r">Montant</th><th class="r">Capital</th><th class="r">Intérêts</th><th>Statut</th></tr></thead><tbody>${payments}</tbody></table>
<footer>${app} est une application de démonstration. Aucun établissement bancaire n’a émis, examiné ou approuvé ce prêt. Les montants sont fictifs.</footer>
</main></body></html>`;
}
