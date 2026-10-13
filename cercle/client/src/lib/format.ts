const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
const fullFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const formatTime = (ms: number) => timeFmt.format(ms);
export const formatFull = (ms: number) => fullFmt.format(ms);

/** Heure si aujourd'hui, « Hier », jour de la semaine sur 7 jours, sinon date courte. */
export function formatListTime(ms: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (diffDays <= 0) return timeFmt.format(ms);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(ms);
  return shortDayFmt.format(ms);
}

export function formatDaySeparator(ms: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  const s = dayFmt.format(ms);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'imminent';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 6) / 10} min`;
  return `${Math.round(seconds / 360) / 10} h`;
}
