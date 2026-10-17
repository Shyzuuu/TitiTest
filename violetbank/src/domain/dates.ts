/**
 * Dates calendaires « YYYY-MM-DD » et horodatages locaux « YYYY-MM-DDTHH:mm:ss »
 * sans fuseau : l'horloge de simulation est une horloge murale, ce qui évite les
 * décalages de jour liés à l'UTC.
 */

export type ISODate = string;
export type LocalDateTime = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseISODate(value: ISODate): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(value);
  if (!match) throw new Error(`Date invalide : ${value}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function makeISODate(y: number, m: number, d: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function toISODate(date: Date): ISODate {
  return makeISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function toLocalDateTime(date: Date): LocalDateTime {
  return `${toISODate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Ajoute n mois en bornant au dernier jour du mois cible : 31/01 + 1 → 28 ou 29/02.
 * Toujours calculé depuis la date d'origine (et non par chaînage) pour que
 * 31/01 + 2 mois donne bien 31/03.
 */
export function addMonths(date: ISODate, months: number): ISODate {
  const { y, m, d } = parseISODate(date);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  return makeISODate(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

export function addDays(date: ISODate, days: number): ISODate {
  const { y, m, d } = parseISODate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return makeISODate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function monthKey(date: ISODate | LocalDateTime): string {
  return date.slice(0, 7);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function datePart(value: LocalDateTime | ISODate): ISODate {
  return value.slice(0, 10);
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function formatDate(value: ISODate | LocalDateTime, style: 'short' | 'long' = 'short'): string {
  const { y, m, d } = parseISODate(value.slice(0, 10));
  return style === 'long' ? `${d} ${MONTHS_LONG[m - 1]} ${y}` : `${pad(d)} ${MONTHS[m - 1]} ${y}`;
}

export function formatTime(value: LocalDateTime): string {
  return value.length >= 16 ? value.slice(11, 16).replace(':', 'h') : '';
}

export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[(m ?? 1) - 1]} ${y}`;
}

export function shortMonth(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTHS[m - 1] ?? key;
}
