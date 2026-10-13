import type { Database } from './database.js';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Migrations versionnées, appliquées dans l'ordre et une seule fois.
 * Ne jamais modifier une migration publiée : en ajouter une nouvelle.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'schema_initial',
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- empreinte SHA-256 du jeton, jamais le jeton lui-même
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  avatar_emoji TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  interests_json TEXT NOT NULL DEFAULT '[]',
  language_style TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','away','busy','offline')),
  is_active INTEGER NOT NULL DEFAULT 1,
  automation_json TEXT NOT NULL DEFAULT '{}',
  ai_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX characters_user ON characters(user_id);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  next_seq INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 0,
  last_message_id TEXT,
  last_message_at INTEGER,
  last_user_seq INTEGER NOT NULL DEFAULT 0,
  last_character_seq INTEGER NOT NULL DEFAULT 0,
  auto_chain INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, character_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','character')),
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('manual','ai_auto','ai_suggestion','simulation','character_reply')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','deleted')),
  reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  client_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  deleted_at INTEGER,
  UNIQUE (conversation_id, seq),
  UNIQUE (conversation_id, client_id)
);
CREATE INDEX messages_unread ON messages(conversation_id, author_type, read_at);
CREATE INDEX messages_reply_to ON messages(reply_to_message_id);

CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  message_id UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
CREATE TRIGGER messages_fts_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content, message_id) VALUES (new.rowid, new.content, new.id);
END;
CREATE TRIGGER messages_fts_au AFTER UPDATE OF content ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.rowid;
  INSERT INTO messages_fts(rowid, content, message_id) VALUES (new.rowid, new.content, new.id);
END;
CREATE TRIGGER messages_fts_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.rowid;
END;

CREATE TABLE mailbox_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  folder TEXT NOT NULL CHECK (folder IN ('inbox','sent','archive','trash')),
  subject TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX mailbox_folder ON mailbox_entries(user_id, folder, created_at DESC);

CREATE TABLE character_memories (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('fact','preference','topic','project','question','event','pinned')),
  content TEXT NOT NULL,
  content_norm TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','manual')),
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  importance INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (character_id, content_norm)
);
CREATE INDEX memories_character ON character_memories(character_id, updated_at DESC);

CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  dedupe_key TEXT,
  run_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','cancelled','superseded','failed')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  lease_until INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Une seule tâche en attente par clé de déduplication (ex. une réponse IA par conversation).
CREATE UNIQUE INDEX tasks_dedupe_pending ON scheduled_tasks(dedupe_key) WHERE status = 'pending' AND dedupe_key IS NOT NULL;
CREATE INDEX tasks_due ON scheduled_tasks(status, run_at);
CREATE INDEX tasks_conversation ON scheduled_tasks(conversation_id, status);

CREATE TABLE ai_suggestions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  task_id TEXT,
  content TEXT NOT NULL,
  anchor_user_seq INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','discarded','stale')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX suggestions_conv ON ai_suggestions(conversation_id, status);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 1,
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, read_at, updated_at DESC);

CREATE TABLE drafts (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX events_user ON events(user_id, seq);

CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  scope TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE ai_usage (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);
`,
  },
];

export function migrate(db: Database, now: number): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`);
  const applied = new Set(db.all<{ version: number }>('SELECT version FROM schema_migrations').map((r) => r.version));
  const done: number[] = [];
  for (const m of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES ($v, $n, $t)', {
        v: m.version,
        n: m.name,
        t: now,
      });
    });
    done.push(m.version);
  }
  return done;
}
