/**
 * Code d'accès de démonstration. Seule une empreinte SHA-256 salée est stockée.
 * Ce verrou évite les regards indiscrets ; ce n'est pas une protection de sécurité
 * (les données restent lisibles dans le stockage local de l'appareil).
 */
import type { AppLock } from '../domain/schema';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return hex(await crypto.subtle.digest('SHA-256', data));
}

export async function createLock(pin: string): Promise<AppLock> {
  if (!isValidPin(pin)) throw new Error(`Le code doit comporter ${PIN_LENGTH} chiffres.`);
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { salt, hash: await hashPin(pin, salt) };
}

export async function verifyPin(lock: AppLock, pin: string): Promise<boolean> {
  return (await hashPin(pin, lock.salt)) === lock.hash;
}
