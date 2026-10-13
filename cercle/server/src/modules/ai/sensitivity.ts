import { normalize } from '../../lib/text.js';

const SENSITIVE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'argent', re: /\b(argent|preter|pret|rembourse\w*|virement|payer|paie|euros?|€|banque|carte bancaire|dette)\b/ },
  { label: 'identifiants', re: /\b(mot de passe|password|code (pin|secret|d'acces)|identifiant|login)\b/ },
  { label: 'coordonnées', re: /\b(adresse|numero de telephone|ton numero|mon numero|iban|rib)\b/ },
  { label: 'santé', re: /\b(malade|hopital|medecin|docteur|sante|blesse|urgence|deprim\w*|suicid\w*)\b/ },
  { label: 'émotions fortes', re: /\b(je t'aime|amoureu\w*|rupture|on se separe|tu m'as blesse|je suis triste|pleure\w*|deuil|deces|mort)\b/ },
  { label: 'engagement', re: /\b(promets?|engage\w*|signer|contrat|rendez-vous|rdv)\b/ },
  { label: 'secret', re: /\b(secret|confidentiel|ne le dis a personne|entre nous)\b/ },
];

export interface SensitivityVerdict {
  sensitive: boolean;
  reasons: string[];
}

/**
 * Détermine si une réponse automatique doit être soumise à confirmation (mode
 * « automatique avec exceptions ») : sujets sensibles, sujets exclus ou demande ambiguë.
 */
export function assessSensitivity(messages: string[], excludedTopics: string[]): SensitivityVerdict {
  const reasons = new Set<string>();
  const text = normalize(messages.join('\n'));
  for (const p of SENSITIVE_PATTERNS) if (p.re.test(text)) reasons.add(`sujet sensible : ${p.label}`);
  for (const topic of excludedTopics) {
    const t = normalize(topic);
    if (t.length >= 2 && text.includes(t)) reasons.add(`sujet exclu : ${topic}`);
  }
  const last = normalize(messages[messages.length - 1] ?? '');
  const words = last.replace(/[^\p{L}\p{N}' ]/gu, ' ').split(' ').filter(Boolean);
  if (/\?/.test(last) && words.length <= 2) reasons.add('demande ambiguë');
  if (/\b(ou|soit)\b.*\?/.test(last) && /\b(choisis|choisir|prefere\w*|plutot)\b/.test(last)) reasons.add('choix demandé');
  return { sensitive: reasons.size > 0, reasons: [...reasons] };
}
