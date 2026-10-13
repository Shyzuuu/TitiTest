import { AiProviderError } from './types.js';

const MAX_PART_LENGTH = 1200;

/**
 * Validation stricte d'une sortie de modèle avant enregistrement : texte brut uniquement,
 * sans balises, préfixes de nom ou blocs de code, découpé en messages successifs.
 */
export function sanitizeAiOutput(raw: string, opts: { maxParts: number; names: string[] }): string[] {
  let text = raw.replace(/\r\n?/g, '\n');
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/<\/?[a-zA-Z][^>]{0,200}>/g, ' ');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const prefixes = opts.names.filter(Boolean).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const prefixRe = prefixes.length ? new RegExp(`^\\s*(?:\\[[^\\]]{1,20}\\]\\s*)?(?:${prefixes.join('|')})\\s*:\\s*`, 'i') : null;
  const parts = text
    .split(/\n\s*-{3,}\s*\n|^\s*-{3,}\s*$/m)
    .map((p) =>
      p
        .split('\n')
        .map((line) => (prefixRe ? line.replace(prefixRe, '') : line))
        .join('\n')
        .trim()
        .replace(/^["«“]\s*([\s\S]*?)\s*["»”]$/, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    )
    .filter((p) => p.length > 0)
    .map((p) => (p.length > MAX_PART_LENGTH ? `${p.slice(0, MAX_PART_LENGTH - 1).trimEnd()}…` : p))
    .slice(0, Math.max(1, opts.maxParts));
  if (parts.length === 0) throw new AiProviderError('Réponse vide ou invalide du fournisseur IA.', true, 'invalid_output');
  return parts;
}
