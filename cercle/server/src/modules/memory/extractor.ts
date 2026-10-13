import type { MemoryKind } from '../../domain.js';

export interface ExtractedMemory {
  kind: MemoryKind;
  content: string;
  importance: number;
}

const clean = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–-]+|[\s,;:.!?…–-]+$/g, '')
    .trim();

/** Coupe la capture à la fin de la proposition pour ne retenir que l'information utile. */
const clause = (s: string) => clean(s.split(/(?<=\S)\s*(?:[.!?;]|\bmais\b|\bet puis\b|\bdu coup\b)\s*/i)[0] ?? s);

interface Rule {
  kind: MemoryKind;
  importance: number;
  pattern: RegExp;
  format: (m: RegExpMatchArray) => string | null;
}

const RULES: Rule[] = [
  {
    kind: 'pinned',
    importance: 5,
    pattern: /(?:retiens|souviens[- ]toi|rappelle[- ]toi|n['’]oublie pas|note bien)\s+(?:bien\s+)?(?:que|qu['’])\s*(.{3,200})/i,
    format: (m) => clause(m[1]!),
  },
  {
    kind: 'fact',
    importance: 4,
    pattern: /\b(?:je m['’]appelle|mon (?:pr[ée]nom|nom) (?:c['’]est|est))\s+([\p{L}' -]{2,40})/iu,
    format: (m) => `S'appelle ${clean(m[1]!)}`,
  },
  {
    kind: 'fact',
    importance: 3,
    pattern: /\bj['’]ai\s+(\d{1,3})\s+ans\b/i,
    format: (m) => `A ${m[1]} ans`,
  },
  {
    kind: 'fact',
    importance: 3,
    pattern: /\bj['’]habite\s+((?:à|a|au|aux|en|dans)\s+[^,.!?\n]{2,60})/i,
    format: (m) => `Habite ${clause(m[1]!)}`,
  },
  {
    kind: 'fact',
    importance: 3,
    pattern: /\bje travaille\s+((?:comme|chez|dans|en|au|à)\s+[^,.!?\n]{2,80})/i,
    format: (m) => `Travaille ${clause(m[1]!)}`,
  },
  {
    kind: 'fact',
    importance: 3,
    pattern: /\bje suis\s+((?:étudiant|etudiant|étudiante|développeur|developpeur|développeuse|prof|professeur|infirmier|infirmière|ingénieur|ingenieur|graphiste|médecin|avocat|musicien|musicienne)[^,.!?\n]{0,60})/i,
    format: (m) => `Est ${clause(m[1]!)}`,
  },
  {
    kind: 'preference',
    importance: 3,
    pattern: /\bje (?:n['’]aime pas|déteste|deteste|n['’]aime vraiment pas|ne supporte pas)\s+(.{2,80})/i,
    format: (m) => `N'aime pas ${clause(m[1]!)}`,
  },
  {
    kind: 'preference',
    importance: 3,
    pattern: /\b(?:j['’]aime(?: bien| beaucoup| trop)?|j['’]adore|je kiffe|je suis fan de|je suis passionn[ée]e? (?:par|de))\s+(.{2,80})/i,
    format: (m) => `Aime ${clause(m[1]!)}`,
  },
  {
    kind: 'preference',
    importance: 3,
    pattern: /\bje pr[ée]f[èe]re\s+(.{2,80})/i,
    format: (m) => `Préfère ${clause(m[1]!)}`,
  },
  {
    kind: 'project',
    importance: 3,
    pattern: /\b(?:mon projet(?: c['’]est| est)?|je (?:compte|pr[ée]vois|r[êe]ve de|veux|voudrais|aimerais))\s+(.{3,100})/i,
    format: (m) => `Projet : ${clause(m[1]!)}`,
  },
  {
    kind: 'event',
    importance: 2,
    pattern:
      /\bje (?:vais|pars|serai|dois|joue|vois|passe)\s+(.{2,80}?\b(?:ce soir|demain|ce week-?end|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|la semaine prochaine|bient[ôo]t|cet [ée]t[ée]|en vacances)\b.{0,30})/i,
    format: (m) => `Prévu : ${clause(m[1]!)}`,
  },
];

/**
 * Extraction déterministe des informations personnelles exprimées par l'utilisateur.
 * Volontairement conservatrice : mieux vaut oublier un détail que mémoriser une
 * information jamais communiquée.
 */
export function extractMemories(text: string, interests: string[] = []): ExtractedMemory[] {
  const out: ExtractedMemory[] = [];
  const seen = new Set<string>();
  const push = (m: ExtractedMemory) => {
    if (m.content.length < 4 || m.content.length > 200) return;
    const key = m.content.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(m);
  };
  // Une phrase interrogative (« tu aimes … ? ») ne décrit pas l'utilisateur.
  const sentences = text.split(/(?<=[.!?\n])\s+/).filter((s) => !/\?\s*$/.test(s.trim()));
  for (const sentence of sentences) {
    for (const rule of RULES) {
      const m = sentence.match(rule.pattern);
      if (!m) continue;
      const content = rule.format(m);
      if (content) push({ kind: rule.kind, content, importance: rule.importance });
    }
  }
  const lower = text.toLowerCase();
  for (const interest of interests) {
    const word = interest.toLowerCase().trim();
    if (word.length >= 3 && lower.includes(word)) {
      push({ kind: 'topic', content: `A parlé de ${interest}`, importance: 1 });
    }
  }
  return out;
}
