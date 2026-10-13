/** Normalisation pour les comparaisons : minuscules, sans accents ni ponctuation superflue. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Nettoie un texte saisi par l'utilisateur sans altérer sa mise en forme utile. */
export function sanitizeUserText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
}

export function preview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function hasQuestion(text: string): boolean {
  return /\?\s*(\S{0,3})?\s*$/.test(text.trim()) || /\?/.test(text);
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
