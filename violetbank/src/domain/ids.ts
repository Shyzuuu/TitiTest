const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomInt(max: number): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return (buf[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

export function randomId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid.replace(/-/g, '').slice(0, 16)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Référence lisible sans caractères ambigus (0/O, 1/I) : « PRT-7K2Q9X ». */
export function randomReference(prefix: string, length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${s}`;
}

export function randomDigits(length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String(randomInt(10));
  return s;
}
