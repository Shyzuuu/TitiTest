import { createHash, randomBytes, randomUUID } from 'node:crypto';

export type IdPrefix = 'usr' | 'chr' | 'cnv' | 'msg' | 'mbx' | 'mem' | 'tsk' | 'ntf' | 'sug' | 'ses';

/** Identifiants stables, préfixés par type pour faciliter le diagnostic. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
