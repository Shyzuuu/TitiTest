/** Clé d'idempotence d'un envoi : stable entre les réessais d'un même message. */
export function newClientId(): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Math.random()}`.slice(2);
  return `c-${Date.now().toString(36)}-${rand.replace(/-/g, '').slice(0, 16)}`;
}
