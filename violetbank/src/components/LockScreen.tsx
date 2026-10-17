import { useEffect, useRef, useState } from 'react';
import { PIN_LENGTH, verifyPin } from '../lib/appLock';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { Credit, LogoMark, Wordmark } from './Logo';
import { PinPad } from './PinPad';
import { ConfirmDialog } from './ui';

const RELOCK_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

/** Écran de verrouillage : au lancement, puis après une minute en arrière-plan. */
export function LockScreen() {
  const lock = useBank((s) => s.state.settings.appLock);
  const displayName = useBank((s) => s.state.profile.displayName);
  const update = useBank((s) => s.update);
  const unlocked = useUi((s) => s.unlocked);
  const setUnlocked = useUi((s) => s.setUnlocked);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setUnlocked]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  // Le compteur d'essais vit dans une référence : en dépendance de l'effet, chaque
  // échec relancerait la vérification du même code en boucle.
  const attemptsRef = useRef(0);
  useEffect(() => {
    if (!lock || pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    void verifyPin(lock, pin).then((good) => {
      if (cancelled) return;
      if (good) {
        attemptsRef.current = 0;
        setUnlocked(true);
        setPin('');
        return;
      }
      attemptsRef.current += 1;
      setError(true);
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        attemptsRef.current = 0;
        setCooldownUntil(Date.now() + COOLDOWN_MS);
        setNow(Date.now());
      }
      setTimeout(() => {
        setError(false);
        setPin('');
      }, 450);
    });
    return () => {
      cancelled = true;
    };
  }, [pin, lock, setUnlocked]);

  if (!lock || unlocked) return null;
  const waiting = cooldownUntil > now;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-between bg-[linear-gradient(180deg,#9C80FF_0%,#7656F6_30%,#4C32B8_70%,#2B1C6E_100%)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-white" role="dialog" aria-modal="true" aria-label="Déverrouiller VBanque">
      <div className="flex flex-col items-center text-center">
        <LogoMark size={72} className="shadow-glow" />
        <Wordmark onDark className="mt-4 text-2xl" />
        <Credit className="mt-0.5 text-white" />
        <p className="mt-6 text-lg font-semibold">Bonjour {displayName}</p>
        <p className="text-sm text-white/80">{waiting ? `Trop d’essais : réessayez dans ${Math.ceil((cooldownUntil - now) / 1000)} s` : error ? 'Code incorrect' : 'Saisissez votre code d’accès'}</p>
      </div>
      <PinPad value={pin} onChange={setPin} disabled={waiting} error={error} light />
      <div className="text-center">
        <button type="button" onClick={() => setForgot(true)} className="text-sm font-semibold text-white/85 underline-offset-4 hover:underline">
          Code oublié ?
        </button>
        <p className="mt-2 text-[11px] text-white/60">Simulation bancaire — argent et crédits fictifs</p>
      </div>
      <ConfirmDialog
        open={forgot}
        onClose={() => setForgot(false)}
        title="Retirer le code d’accès ?"
        confirmLabel="Retirer le code"
        tone="danger"
        onConfirm={() => {
          update((s) => ({ ...s, settings: { ...s.settings, appLock: null } }));
          setForgot(false);
          setUnlocked(true);
        }}
      >
        Le code d’accès de démonstration sera supprimé. Vos données fictives sont conservées ; vous pourrez définir un nouveau code dans votre profil.
      </ConfirmDialog>
    </div>
  );
}
