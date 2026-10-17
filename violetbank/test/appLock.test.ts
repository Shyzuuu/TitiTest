import { describe, expect, it } from 'vitest';
import { createLock, isValidPin, verifyPin } from '../src/lib/appLock';
import { validateState } from '../src/domain/persistence';
import { createDemoState } from '../src/domain/seed';

describe('code d’accès de démonstration', () => {
  it('ne stocke qu’une empreinte salée et vérifie le bon code', async () => {
    const lock = await createLock('2580');
    expect(lock.hash).toHaveLength(64);
    expect(JSON.stringify(lock)).not.toContain('2580');
    expect(await verifyPin(lock, '2580')).toBe(true);
    expect(await verifyPin(lock, '0000')).toBe(false);
    const other = await createLock('2580');
    expect(other.hash).not.toBe(lock.hash);
  });
  it('refuse les codes mal formés', async () => {
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('123')).toBe(false);
    await expect(createLock('12345')).rejects.toThrow();
  });
  it('les sauvegardes v1 (sans profil étendu ni verrou) restent valides', () => {
    const raw = JSON.parse(JSON.stringify(createDemoState('2026-10-16')));
    delete raw.profile.bio;
    delete raw.profile.plan;
    delete raw.profile.joinedAt;
    delete raw.settings.appLock;
    raw.settings.appName = 'VIOLETBANK';
    const res = validateState(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.profile.plan).toBe('essentiel');
      expect(res.state.settings.appLock).toBeNull();
      expect(res.state.settings.appName).toBe('VBanque');
    }
  });
});
