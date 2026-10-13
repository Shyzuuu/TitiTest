import type { AppContext } from '../context.js';
import type { CharacterInput } from '../modules/characters/characters.service.js';

/** Personnages de démonstration : point de départ, l'architecture en accepte autant que nécessaire. */
export const DEMO_CHARACTERS: CharacterInput[] = [
  {
    firstName: 'Emma',
    lastName: 'Laurent',
    avatarColor: '#ec4899',
    avatarEmoji: '🌸',
    description: 'Amie sociable qui adore prendre des nouvelles et organiser des sorties.',
    personality: 'Sympathique, curieuse, naturelle. Elle aime les conversations et reprend volontiers un sujet abordé plus tôt.',
    interests: ['les sorties entre amis', 'les séries', 'la cuisine', 'les voyages'],
    languageStyle: 'Chaleureux, tutoiement, quelques emojis, phrases simples.',
    status: 'online',
    automation: { incomingMinMinutes: 15, incomingMaxMinutes: 60, burstMax: 1, followupEnabled: true, followupAfterMinutes: 30 },
    ai: { mode: 'off', delaySeconds: 120 },
  },
  {
    firstName: 'Lucas',
    lastName: 'Martin',
    avatarColor: '#22c55e',
    avatarEmoji: '🎮',
    description: 'Le pote drôle, toujours une blague ou une partie en cours.',
    personality: 'Drôle, spontané, passionné de jeux vidéo. Humour adapté au contexte.',
    interests: ['les jeux vidéo', 'le streaming', 'les mèmes', 'le football'],
    languageStyle: 'Messages courts et naturels, argot léger, « mdr », humour.',
    status: 'online',
    automation: { incomingMinMinutes: 20, incomingMaxMinutes: 75, burstMax: 2 },
    ai: { mode: 'off', delaySeconds: 120 },
  },
  {
    firstName: 'Sarah',
    lastName: 'Benali',
    avatarColor: '#0ea5e9',
    avatarEmoji: '📚',
    description: 'Amie posée avec qui les discussions vont en profondeur.',
    personality: 'Réfléchie, attentive, posée. Elle apprécie les discussions approfondies et reprend les sujets précédents.',
    interests: ['la lecture', 'la philosophie', 'la randonnée', 'le thé'],
    languageStyle: 'Phrases complètes et soignées, ton calme, pas d’emoji.',
    status: 'away',
    automation: { incomingMinMinutes: 40, incomingMaxMinutes: 120, burstMax: 1 },
    ai: { mode: 'off', delaySeconds: 180 },
  },
  {
    firstName: 'Nathan',
    lastName: 'Roux',
    avatarColor: '#f97316',
    avatarEmoji: '⚡',
    description: 'Boule d’énergie, toujours partant pour un nouveau défi.',
    personality: 'Très actif, enthousiaste, énergique. Envoie parfois plusieurs messages de suite et relance les discussions.',
    interests: ['le sport', 'la musculation', 'les défis', 'le vélo'],
    languageStyle: 'Enthousiaste, beaucoup de points d’exclamation, messages en rafale.',
    status: 'online',
    automation: { incomingMinMinutes: 10, incomingMaxMinutes: 45, burstMax: 3, followupEnabled: true, followupAfterMinutes: 15 },
    ai: { mode: 'off', delaySeconds: 120 },
  },
  {
    firstName: 'Chloé',
    lastName: 'Dubois',
    avatarColor: '#a855f7',
    avatarEmoji: '🎧',
    description: 'Musicienne créative qui parle volontiers de ses projets.',
    personality: 'Créative, expressive, passionnée par la musique. Elle parle de ses projets et de ses découvertes.',
    interests: ['la musique', 'la guitare', 'les concerts', 'le dessin'],
    languageStyle: 'Expressif, imagé, emojis musicaux.',
    status: 'busy',
    automation: { incomingMinMinutes: 25, incomingMaxMinutes: 90, burstMax: 2 },
    ai: { mode: 'off', delaySeconds: 150 },
  },
  {
    firstName: 'Hugo',
    lastName: 'Petit',
    avatarColor: '#eab308',
    avatarEmoji: '🍳',
    description: 'Collègue gourmand, fan de cuisine et de bons plans.',
    personality: 'Bon vivant, serviable, un peu bavard.',
    interests: ['la cuisine', 'les restaurants', 'le jardinage'],
    languageStyle: 'Convivial, quelques emojis.',
    status: 'offline',
    automation: { incomingEnabled: false, incomingMinMinutes: 60, incomingMaxMinutes: 240 },
    ai: { mode: 'off', delaySeconds: 300 },
  },
];

export function seedDemoData(ctx: AppContext, userId: string): number {
  let created = 0;
  for (const input of DEMO_CHARACTERS) {
    ctx.characters.create(userId, input);
    created++;
  }
  ctx.logger.info('seed', `${created} personnages de démonstration créés`);
  return created;
}

/** Supprime toutes les données métier puis recrée la démonstration (l'utilisateur et sa session sont conservés). */
export function resetDemoData(ctx: AppContext, userId: string): number {
  ctx.db.transaction(() => {
    ctx.db.run('DELETE FROM scheduled_tasks WHERE user_id = $u', { u: userId });
    ctx.db.run('DELETE FROM notifications WHERE user_id = $u', { u: userId });
    ctx.db.run('DELETE FROM characters WHERE user_id = $u', { u: userId });
    ctx.db.run('DELETE FROM ai_usage');
    ctx.db.run(`DELETE FROM settings WHERE key IN ('global', 'ai_status')`);
    ctx.settings.invalidate();
  });
  const n = ctx.db.transaction(() => seedDemoData(ctx, userId));
  ctx.db.transaction(() => ctx.bus.publish(userId, 'resync', { reason: 'reset' }));
  return n;
}
