/**
 * Hachage FNV-1a 32 bits. Non cryptographique : sert à détecter la corruption
 * accidentelle (fichier tronqué, édition manuelle) et les divergences de rejeu.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * @param {string} text
 * @param {number} [seed]
 * @returns {number}
 */
export function fnv1a(text, seed = FNV_OFFSET) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    // Les code units UTF-16 sont hachés sur deux octets pour éviter les collisions triviales.
    const c = text.charCodeAt(i);
    h ^= c & 0xff;
    h = Math.imul(h, FNV_PRIME);
    h ^= c >>> 8;
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/**
 * @param {number} value
 * @returns {string}
 */
export function toHex32(value) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hachage d'une liste de nombres en représentation exacte : deux états
 * différant d'un seul ULP produisent deux empreintes différentes.
 * @param {ArrayLike<number>} values
 * @returns {string}
 */
export function hashNumbers(values) {
  let h = FNV_OFFSET;
  for (let i = 0; i < values.length; i++) {
    h = fnv1a(String(values[i]), h);
    h = fnv1a('|', h);
  }
  return toHex32(h);
}
