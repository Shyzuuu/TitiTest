import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppContext } from '../../context.js';
import type { UserRow } from '../../domain.js';
import { newId, randomToken, sha256 } from '../../lib/ids.js';
import { unauthorized } from '../../lib/errors.js';

const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  isAdmin: boolean;
  createdAt: number;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
  };
}

export class AuthService {
  constructor(private readonly ctx: AppContext) {}

  /** Crée l'utilisateur principal s'il n'existe pas encore (premier démarrage). */
  ensurePrimaryUser(): UserRow {
    const { db, config, clock } = this.ctx;
    const existing = db.get<UserRow>('SELECT * FROM users WHERE username = $u', { u: config.auth.username });
    if (existing) return existing;
    const row: UserRow = {
      id: newId('usr'),
      username: config.auth.username,
      display_name: config.auth.displayName,
      bio: '',
      password_hash: hashPassword(config.auth.password),
      is_admin: 1,
      created_at: clock.now(),
    };
    db.run(
      `INSERT INTO users (id, username, display_name, bio, password_hash, is_admin, created_at)
       VALUES ($id, $username, $display_name, $bio, $password_hash, $is_admin, $created_at)`,
      { ...row },
    );
    return row;
  }

  primaryUser(): UserRow {
    const row = this.ctx.db.get<UserRow>('SELECT * FROM users ORDER BY created_at LIMIT 1');
    return row ?? this.ensurePrimaryUser();
  }

  login(username: string, password: string): { token: string; user: UserRow; expiresAt: number } {
    const user = this.ctx.db.get<UserRow>('SELECT * FROM users WHERE username = $u', { u: username });
    // Vérification systématique (même sans utilisateur) pour ne pas révéler son existence par le temps de réponse.
    const ok = verifyPassword(password, user?.password_hash ?? hashPassword('leurre-temps-constant'));
    if (!user || !ok) throw unauthorized('Identifiants incorrects.');
    const token = randomToken();
    const now = this.ctx.clock.now();
    const expiresAt = now + this.ctx.config.auth.sessionTtlMs;
    this.ctx.db.run(
      'INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES ($id, $u, $c, $e, $c)',
      { id: sha256(token), u: user.id, c: now, e: expiresAt },
    );
    this.ctx.db.run('DELETE FROM sessions WHERE expires_at < $now', { now });
    return { token, user, expiresAt };
  }

  logout(token: string): void {
    this.ctx.db.run('DELETE FROM sessions WHERE id = $id', { id: sha256(token) });
  }

  authenticate(token: string | undefined): UserRow | null {
    if (!token || token.length > 200) return null;
    const now = this.ctx.clock.now();
    const row = this.ctx.db.get<UserRow & { expires_at: number; last_seen_at: number; session_id: string }>(
      `SELECT u.*, s.expires_at, s.last_seen_at, s.id AS session_id FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.id = $id`,
      { id: sha256(token) },
    );
    if (!row || row.expires_at < now) return null;
    if (now - row.last_seen_at > 60_000) {
      this.ctx.db.run('UPDATE sessions SET last_seen_at = $now WHERE id = $id', { now, id: row.session_id });
    }
    return row;
  }

  updateProfile(userId: string, patch: { displayName?: string; bio?: string }): UserRow {
    const current = this.ctx.db.get<UserRow>('SELECT * FROM users WHERE id = $id', { id: userId });
    if (!current) throw unauthorized();
    this.ctx.db.transaction(() => {
      this.ctx.db.run('UPDATE users SET display_name = $d, bio = $b WHERE id = $id', {
        id: userId,
        d: patch.displayName ?? current.display_name,
        b: patch.bio ?? current.bio,
      });
      const updated = this.ctx.db.get<UserRow>('SELECT * FROM users WHERE id = $id', { id: userId })!;
      this.ctx.bus.publish(userId, 'me.updated', { me: toPublicUser(updated) });
    });
    return this.ctx.db.get<UserRow>('SELECT * FROM users WHERE id = $id', { id: userId })!;
  }

  changePassword(userId: string, currentPassword: string, newPassword: string): void {
    const user = this.ctx.db.get<UserRow>('SELECT * FROM users WHERE id = $id', { id: userId });
    if (!user || !verifyPassword(currentPassword, user.password_hash)) throw unauthorized('Mot de passe actuel incorrect.');
    this.ctx.db.transaction(() => {
      this.ctx.db.run('UPDATE users SET password_hash = $h WHERE id = $id', { id: userId, h: hashPassword(newPassword) });
      this.ctx.db.run('DELETE FROM sessions WHERE user_id = $id', { id: userId });
    });
  }
}
