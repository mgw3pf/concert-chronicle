import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "./config.js";

/**
 * Uses Node's built-in SQLite driver (node:sqlite, Node >= 22.5) so the server
 * has zero native npm dependencies for its database. Swap this module for a
 * Postgres client later without touching route code — routes only use
 * prepare().run/get/all and transaction().
 */
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/** Runs fn atomically. Nested calls are not supported (SQLite has one writer). */
export function transaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Minimal forward-only migration runner. Add new migrations to the end of the
 * array; each runs exactly once per database, tracked in `schema_migrations`.
 */
const migrations = [
  {
    name: "0001_initial",
    sql: `
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE artists (
        id         INTEGER PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, name COLLATE NOCASE)
      );

      CREATE TABLE venues (
        id         INTEGER PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        city       TEXT NOT NULL DEFAULT '',
        region     TEXT NOT NULL DEFAULT '',
        country    TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, name COLLATE NOCASE, city COLLATE NOCASE)
      );

      CREATE TABLE concerts (
        id         INTEGER PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        venue_id   INTEGER NOT NULL REFERENCES venues(id),
        date       TEXT NOT NULL,             -- ISO date YYYY-MM-DD
        notes      TEXT NOT NULL DEFAULT '',
        rating     INTEGER,                   -- 1..5, optional
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_concerts_user_date ON concerts(user_id, date DESC);

      CREATE TABLE concert_artists (
        concert_id INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
        artist_id  INTEGER NOT NULL REFERENCES artists(id),
        slot       INTEGER NOT NULL DEFAULT 0, -- 0 = headliner, 1+ = openers in order
        PRIMARY KEY (concert_id, artist_id)
      );

      CREATE TABLE photos (
        id             INTEGER PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concert_id     INTEGER NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
        filename       TEXT NOT NULL,   -- stored file on disk (full size, re-encoded)
        thumb_filename TEXT NOT NULL,   -- stored thumbnail on disk
        original_name  TEXT NOT NULL DEFAULT '',
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_photos_concert ON photos(concert_id);
    `,
  },
];

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const applied = new Set(
  db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name)
);

for (const m of migrations) {
  if (applied.has(m.name)) continue;
  transaction(() => {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(m.name);
  });
}
