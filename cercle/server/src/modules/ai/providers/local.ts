import type { MemoryRow } from '../../../domain.js';
import { normalize } from '../../../lib/text.js';
import { pick, type Random } from '../../../lib/random.js';
import type { AiProvider, GenerationContext, GenerationResult, HistoryItem } from '../types.js';

/**
 * Simulation locale, sans IA réelle : des gabarits contextuels (personnalité, centres
 * d'intérêt, souvenirs, questions en attente) qui évitent de répéter les messages récents.
 * Elle garantit une application utilisable sans clé API et sert de repli en cas de panne.
 */
interface Voice {
  emojis: string[];
  laugh: string;
  short: boolean;
  energetic: boolean;
  calm: boolean;
}

function voiceOf(ctx: GenerationContext): Voice {
  const text = normalize(`${ctx.character.personality} ${ctx.character.languageStyle} ${ctx.character.description}`);
  const energetic = /energ|enthousias|dynamique|tres actif|majuscule/.test(text);
  const calm = /calme|pose|reflechi|attenti|profond/.test(text);
  const funny = /drole|humour|blague|spontane/.test(text);
  const creative = /creati|musique|artist/.test(text);
  const emojis = /pas d'emoji|sans emoji/.test(text)
    ? []
    : creative
      ? ['🎶', '✨', '🎧', '🎨']
      : energetic
        ? ['🔥', '💪', '🚀', '😄']
        : funny
          ? ['😂', '😅', '🎮', '😎']
          : calm
            ? []
            : ['😊', '🙂', '😄'];
  return {
    emojis,
    laugh: funny ? 'mdr' : energetic ? 'haha' : calm ? '' : 'haha',
    short: /court|bref|concis/.test(text) || funny,
    energetic,
    calm,
  };
}

const lastOf = <T,>(items: T[]) => items[items.length - 1];

/** Respecte le nombre de messages autorisé sans perdre de contenu : l'excédent rejoint le dernier message. */
function fitParts(parts: string[], maxParts: number): string[] {
  const max = Math.max(1, maxParts);
  if (parts.length <= max) return parts;
  return [...parts.slice(0, max - 1), parts.slice(max - 1).join(' ')];
}

function pendingUserMessages(history: HistoryItem[]): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!;
    if (h.author !== 'user') break;
    out.unshift(h);
  }
  return out;
}

function pendingCharacterMessages(history: HistoryItem[]): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!;
    if (h.author !== 'character') break;
    out.unshift(h);
  }
  return out;
}

export class LocalProvider implements AiProvider {
  readonly id = 'local';
  readonly label = 'Simulation locale (sans IA réelle)';
  readonly isReal = false;
  readonly model = 'simulation-locale-v1';

  constructor(private readonly rng: Random) {}

  async ping(): Promise<{ model: string; text: string }> {
    return { model: this.model, text: 'OK' };
  }

  async generate(ctx: GenerationContext): Promise<GenerationResult> {
    const recent = new Set(
      ctx.history
        .filter((h) => (ctx.purpose === 'user_proxy' ? h.author === 'user' : h.author === 'character'))
        .slice(-12)
        .map((h) => normalize(h.content)),
    );
    let parts: string[] = [];
    // Plusieurs tirages : on écarte une formulation déjà utilisée récemment.
    for (let attempt = 0; attempt < 6; attempt++) {
      parts = this.compose(ctx);
      if (!parts.some((p) => recent.has(normalize(p)))) break;
    }
    return { parts: fitParts(parts, ctx.maxParts), providerId: this.id, model: this.model, fallback: false };
  }

  private compose(ctx: GenerationContext): string[] {
    switch (ctx.purpose) {
      case 'character_reply':
        return this.reply(ctx);
      case 'character_initiate':
        return this.initiate(ctx);
      case 'character_followup':
        return this.followup(ctx);
      case 'user_proxy':
        return this.proxy(ctx);
    }
  }

  private emoji(v: Voice, chance = 0.5): string {
    return v.emojis.length && this.rng.next() < chance ? ` ${pick(this.rng, v.emojis)}` : '';
  }

  private finish(v: Voice, parts: string[]): string[] {
    const cleaned = parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!v.energetic || cleaned.length !== 1) return cleaned;
    // Personnage énergique : découpe naturelle en messages successifs.
    const sentences = cleaned[0]!.split(/(?<=[!?.])\s+/).filter(Boolean);
    return sentences.length > 1 ? sentences : cleaned;
  }

  private interest(ctx: GenerationContext, exclude?: string): string {
    const list = ctx.character.interests.filter((i) => i !== exclude);
    return list.length ? pick(this.rng, list) : 'des petits projets perso';
  }

  private memoryHook(ctx: GenerationContext): MemoryRow | null {
    const usable = ctx.memories.filter((m) => ['preference', 'project', 'event', 'pinned', 'fact'].includes(m.kind));
    if (usable.length === 0) return null;
    const recentText = normalize(ctx.history.slice(-8).map((h) => h.content).join(' '));
    const fresh = usable.filter((m) => !recentText.includes(normalize(m.content).slice(0, 18)));
    return fresh.length ? pick(this.rng, fresh) : null;
  }

  private reply(ctx: GenerationContext): string[] {
    const v = voiceOf(ctx);
    const pending = pendingUserMessages(ctx.history);
    const text = normalize(pending.map((p) => p.content).join(' ') || lastOf(ctx.history)?.content || '');
    // Un nom d'affichage générique (« Moi ») ne s'utilise pas dans une salutation.
    const name = /^(moi|me|user|utilisateur)$/i.test(ctx.userName.trim()) ? '' : ctx.userName;
    const parts: string[] = [];

    const mentioned = ctx.character.interests.find((i) => text.includes(normalize(i)));
    const asksHowAreYou = /\b(ca va|comment (tu vas|vas-tu|ca va)|la forme|tu vas bien)\b/.test(text);
    const asksWhatsUp = /\b(tu fais quoi|quoi de neuf|tu deviens|t'es ou|tu fais quoi de beau)\b/.test(text);
    const asksAvailability = /\b(dispo|disponible|libre|t'es la|tu es la)\b/.test(text);
    const greets = /^(salut|coucou|hello|bonjour|bonsoir|yo|hey|re)\b/.test(text);
    const leaving = /\b(je reviens|a plus|a tout|je file|bonne nuit|a demain)\b/.test(text);
    const back = /\b(je suis revenu|je suis de retour|me revoila|re)\b/.test(text);
    const thanks = /\b(merci|thanks)\b/.test(text);
    const question = /\?/.test(pending.map((p) => p.content).join(' '));
    const quotedOwn = pending.find((p) => p.quoted && p.quoted.author === 'user');

    if (back && pending.length > 1) {
      parts.push(pick(this.rng, ['Ah, te revoilà !', 'Oh, déjà de retour !', 'Re ! Ça a été rapide.']) + this.emoji(v));
    } else if (greets && !asksHowAreYou) {
      parts.push(
        (name
          ? pick(this.rng, [`Hey ${name} !`, `Coucou ${name} !`, `Salut ${name} !`, `Oh, ${name} !`])
          : pick(this.rng, ['Hey !', 'Coucou !', 'Salut toi !', 'Oh, salut !'])) + this.emoji(v, 0.6),
      );
    }
    if (asksHowAreYou) {
      parts.push(
        pick(this.rng, [
          `Ça va bien, merci ! Je sors d'un moment ${this.aboutInterest(this.interest(ctx))}. Et toi ?`,
          `Plutôt bien ! Journée tranquille, j'ai pu me consacrer à ${this.interest(ctx)}. Et de ton côté ?`,
          `Ça roule${v.energetic ? ' !!' : ' !'} Un peu occupé${this.fem(ctx)} mais ça va. Toi, ça va ?`,
        ]),
      );
    }
    if (asksWhatsUp) {
      parts.push(
        pick(this.rng, [
          `Là je suis en plein dans ${this.interest(ctx)}${this.emoji(v)}`,
          `Pas grand-chose, je me suis posé${this.fem(ctx)} avec ${this.interest(ctx)}. Et toi ?`,
          `Je réfléchissais justement à ${this.interest(ctx)}, tu tombes bien !`,
        ]),
      );
    }
    if (asksAvailability) {
      parts.push(
        pick(this.rng, [
          'Oui, je suis dispo ! Tu voulais me dire quoi ?',
          "Je suis là ! Qu'est-ce qui se passe ?",
          'Ça dépend pour quoi, mais a priori oui. Dis-moi tout !',
        ]),
      );
    }
    if (mentioned && parts.length < 2) {
      parts.push(
        pick(this.rng, [
          `Oh, ${mentioned} ? Tu sais que j'adore ça${this.emoji(v, 0.7)}`,
          `${this.capitalize(mentioned)}, carrément ! On devrait en parler plus souvent.`,
          `Attends, tu parles de ${mentioned} ? Raconte-moi tout !`,
        ]),
      );
    }
    if (quotedOwn && parts.length < 2) {
      parts.push(pick(this.rng, ['Ah ok, je note le changement de plan !', "D'accord, c'est noté pour la mise à jour !"]));
    }
    if (leaving) {
      parts.push(pick(this.rng, ['Ça marche, à tout à l’heure !', 'Ok, file ! On se reparle plus tard.', 'Pas de souci, à plus !']));
    }
    if (thanks && parts.length === 0) {
      parts.push(pick(this.rng, ['Avec plaisir !', 'De rien, c’est normal !', 'Toujours là pour toi !']) + this.emoji(v));
    }
    if (question && !asksHowAreYou && !asksWhatsUp && !asksAvailability && parts.length < 2) {
      parts.push(
        pick(this.rng, [
          `Bonne question… Je dirais oui, mais ça dépend un peu. Tu en penses quoi, toi ?`,
          `Hmm, laisse-moi réfléchir. Honnêtement, je pencherais pour oui.`,
          `Franchement, je ne suis pas sûr${this.fem(ctx)}. Pourquoi tu me demandes ça ?`,
        ]),
      );
    }
    const hook = this.memoryHook(ctx);
    if (hook && this.rng.next() < 0.35 && parts.length < 2) parts.push(this.recall(hook));
    if (parts.length === 0) {
      parts.push(
        pick(this.rng, [
          `Ah oui ? Dis-m'en plus${this.emoji(v)}`,
          `Je vois ! Et ça t'a fait quoi ?`,
          v.calm ? 'Je comprends. Prends ton temps pour m’expliquer.' : `Ah ${v.laugh || 'ah'}, j'adore ! Et ensuite ?`,
          `Intéressant… Tu me tiens au courant ?`,
          `Ok je vois. Au fait, tu t'intéresses un peu à ${this.interest(ctx)} ?`,
        ]),
      );
    }
    return this.finish(v, v.short ? parts.slice(0, 2) : parts);
  }

  private initiate(ctx: GenerationContext): string[] {
    const v = voiceOf(ctx);
    const hook = this.memoryHook(ctx);
    const options: Array<() => string> = [
      () => `Je viens de passer un moment génial avec ${this.interest(ctx)}${this.emoji(v, 0.8)} Tu as fait quoi de beau aujourd'hui ?`,
      () => `Petite question du jour : si tu devais ne garder qu'un seul loisir, ce serait lequel ?`,
      () => `J'ai pensé à toi en tombant sur un truc autour de ${this.interest(ctx)}. Ça te parle ?`,
      () => `Tu fais quoi ce week-end ? Moi j'hésite entre ${this.interest(ctx)} et ${this.interest(ctx, undefined)}.`,
      () => (v.calm ? `Je réfléchissais à quelque chose : qu'est-ce qui t'a fait plaisir ces derniers jours ?` : `Devine quoi${v.energetic ? ' !!!' : ' !'} J'ai enfin avancé sur mon projet ${this.aboutInterest(this.interest(ctx))}.`),
      () => `Ça fait un moment ! Quoi de neuf de ton côté ?`,
    ];
    if (hook) options.push(() => this.recall(hook), () => this.recall(hook));
    const lastTopic = [...ctx.history].reverse().find((h) => h.author === 'user' && h.content.length > 25);
    if (lastTopic) {
      options.push(() => `Je repensais à ce que tu m'as dit (« ${this.short(lastTopic.content)} »). Finalement, ça a donné quoi ?`);
    }
    return this.finish(v, [pick(this.rng, options)()]);
  }

  private followup(ctx: GenerationContext): string[] {
    const v = voiceOf(ctx);
    const unanswered = pendingCharacterMessages(ctx.history);
    const last = lastOf(unanswered);
    const options = [
      `Tu as vu mon message ?${this.emoji(v, 0.4)}`,
      'Pas de pression hein, réponds quand tu peux !',
      last ? `Je reviens vers toi pour ça : « ${this.short(last.content)} »` : 'Toujours partant pour en parler ?',
      v.energetic ? 'Allô allô ?? 😄' : 'Je te laisse tranquille, mais je suis curieux·se de ton avis !',
    ];
    return [pick(this.rng, options)];
  }

  private proxy(ctx: GenerationContext): string[] {
    const pending = pendingCharacterMessages(ctx.history);
    const text = normalize(pending.map((p) => p.content).join(' '));
    const first = ctx.character.firstName;
    if (/\b(dispo|disponible|libre|ce soir|demain|on se voit|rdv)\b/.test(text)) {
      return [pick(this.rng, [`Je suis un peu pris là, ${first}, je te redis vite !`, 'Je regarde mon planning et je te confirme dès que possible !'])];
    }
    if (/\b(ca va|comment tu vas|la forme)\b/.test(text)) {
      return [pick(this.rng, ['Ça va bien, merci ! Un peu occupé, je te raconte plus tard.', 'Tranquille ! Et toi ?'])];
    }
    if (/\?/.test(text)) {
      return [pick(this.rng, ['Bonne question ! Laisse-moi y réfléchir, je te réponds mieux tout à l’heure.', 'Je ne sais pas encore, je te tiens au courant !'])];
    }
    if (/^(salut|coucou|hello|bonjour|hey)\b/.test(text)) {
      return [pick(this.rng, [`Salut ${first} !`, `Coucou ${first} !`])];
    }
    return [pick(this.rng, ['Haha oui ! Désolé, je suis un peu occupé, je te réponds vraiment plus tard.', 'Je vois ! On en reparle très vite.', 'Top ! Je te redis ça bientôt.'])];
  }

  private recall(memory: MemoryRow): string {
    const content = memory.content;
    switch (memory.kind) {
      case 'preference':
        return content.startsWith('Aime ')
          ? `Au fait, tu m'avais dit que tu aimais ${content.slice(5)}. Tu en as profité récemment ?`
          : `Je n'ai pas oublié : ${this.lowerFirst(content)}. Je m'en souviendrai !`;
      case 'project':
        return `Et ton projet, ça avance ? (${this.lowerFirst(content.replace(/^Projet : /, ''))})`;
      case 'event':
        return `Alors, ${this.lowerFirst(content.replace(/^Prévu : /, ''))}, ça s'est passé comment ?`;
      case 'pinned':
        return `J'ai bien retenu ce que tu m'avais demandé : ${this.lowerFirst(content)}.`;
      default:
        return `Je repensais à ce que tu m'as dit : ${this.lowerFirst(content)}.`;
    }
  }

  private aboutInterest(interest: string): string {
    return /^(la |le |les |l'|du |des )/i.test(interest) ? `autour de ${interest}` : `de ${interest}`;
  }

  private fem(ctx: GenerationContext): string {
    return /\b(elle|passionnee|creative|curieuse|calme|posee|reflechie|attentive)\b/.test(
      normalize(`${ctx.character.description} ${ctx.character.personality}`),
    )
      ? 'e'
      : '';
  }

  private short(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > 60 ? `${flat.slice(0, 57).trimEnd()}…` : flat;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private lowerFirst(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
}
