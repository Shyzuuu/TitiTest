import { ArrowDownLeft, ArrowLeftRight, RotateCcw, Send, ShoppingCart, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Hero, HeroAmount, HeroPill, RoundActions, Widget } from '../components/Hero';
import { TransactionRow } from '../components/Transactions';
import { Avatar, Button, EmptyState } from '../components/ui';
import { refundableAmount } from '../domain/accounts';
import { effectiveType, isPosted } from '../domain/core';
import { monthKey } from '../domain/dates';
import { ORDINARY_OUT_TYPES } from '../domain/selectors';
import { useBankState, useMoney, useToday } from '../lib/hooks';
import { useUi } from '../store/ui';

const PAYMENT_TYPES = new Set(['expense', 'p2p_out', 'p2p_in', 'merchant_refund', 'transfer_out']);

export default function Payments() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const open = useUi((s) => s.openModal);
  const month = monthKey(today);
  const monthOut = useMemo(() => {
    let total = 0;
    for (const tx of state.transactions) if (isPosted(tx) && monthKey(tx.date) === month && ORDINARY_OUT_TYPES.has(effectiveType(tx))) total -= tx.amount;
    return Math.max(0, total);
  }, [state.transactions, month]);
  const recent = useMemo(() => state.transactions.filter((t) => PAYMENT_TYPES.has(t.type)).slice(0, 6), [state.transactions]);
  const refundables = useMemo(() => state.transactions.filter((t) => refundableAmount(state, t) > 0).slice(0, 4), [state]);
  const contacts = state.contacts.filter((c) => !c.archived).sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 8);

  return (
    <div className="mx-auto max-w-2xl">
      <Hero title="Paiements" eyebrow="Paiements · dépenses du mois" className="min-h-[360px]">
        <HeroAmount cents={monthOut} testId="payments-month" className="mt-1 text-[56px] sm:text-[64px]" />
        <p className="mt-1 text-[15px] font-medium text-white/85">Achats, envois et retraits simulés depuis le 1er</p>
        <div className="mt-auto pt-6">
          <HeroPill to="/historique">Historique complet</HeroPill>
        </div>
        <div className="mt-6 w-full pb-6">
          <RoundActions
            actions={[
              { label: 'Payer', icon: ShoppingCart, to: '/paiements/achat' },
              { label: 'Envoyer', icon: Send, to: '/envoyer' },
              { label: 'Recevoir', icon: ArrowDownLeft, to: '/recevoir' },
              { label: 'Entre mes comptes', icon: ArrowLeftRight, onClick: () => open('transfer') },
            ]}
          />
        </div>
      </Hero>

      <div className="space-y-4">
        <Widget title="Contacts fictifs" to="/contacts">
          {contacts.length ? (
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
              {contacts.map((c) => (
                <Link key={c.id} to={`/envoyer?contact=${c.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
                  <Avatar emoji={c.emoji} color={c.color} size={56} />
                  <span className="w-full truncate text-xs font-semibold">{c.name.split(' ')[0]}</span>
                </Link>
              ))}
              <Link to="/contacts" className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-raised">
                  <Users size={22} aria-hidden />
                </span>
                <span className="text-xs font-semibold">Gérer</span>
              </Link>
            </div>
          ) : (
            <EmptyState icon={Users} title="Aucun contact" action={<Link to="/contacts"><Button>Ajouter un contact</Button></Link>} />
          )}
        </Widget>

        <Widget title="Remboursements commerçant">
          {refundables.length ? (
            <ul className="divide-y divide-line">
              {refundables.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.label}</span>
                    <span className="num text-xs text-muted">Remboursable : {money(refundableAmount(state, t))}</span>
                  </span>
                  <Button size="sm" variant="soft" icon={RotateCcw} onClick={() => open('refund', { id: t.id })}>
                    Simuler
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted">Aucune dépense remboursable pour l’instant. Effectuez un achat simulé pour tester un retour d’article.</p>
          )}
        </Widget>

        <Widget title="Derniers paiements" to="/historique">
          {recent.length ? recent.map((t) => <TransactionRow key={t.id} tx={t} />) : <EmptyState icon={ShoppingCart} title="Aucun paiement" action={<Link to="/paiements/achat"><Button>Faire un achat simulé</Button></Link>} />}
        </Widget>
      </div>
    </div>
  );
}
