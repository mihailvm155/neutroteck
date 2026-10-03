import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SongStatus = "draft" | "generating" | "done" | "failed";

export interface User {
  id: number;
  state: string;
  balance: number;
  current_song_id: number | null;
  created_at: number;
}

export interface Song {
  id: number;
  user_id: number;
  story: string;
  title: string;
  style: string;
  lyrics: string;
  status: SongStatus;
  task_id: string | null;
  audio_url: string | null;
  cost: number;
  created_at: number;
}

export interface Payment {
  inv_id: number;
  user_id: number;
  pack_id: string;
  amount_rub: number;
  tokens: number;
  status: "pending" | "paid";
}

export function openDb(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'idle',
      balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
      current_song_id INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      story TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT '',
      lyrics TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      task_id TEXT,
      audio_url TEXT,
      cost INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS songs_user ON songs(user_id, id DESC);
    CREATE TABLE IF NOT EXISTS payments (
      inv_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pack_id TEXT NOT NULL,
      amount_rub INTEGER NOT NULL,
      tokens INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

/** Тонкая обёртка с типизированными запросами. */
export class Store {
  constructor(readonly db: DatabaseSync) {}

  ensureUser(id: number): User {
    this.db
      .prepare("INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)")
      .run(id, Date.now());
    return this.getUser(id)!;
  }

  getUser(id: number): User | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User | undefined;
  }

  setState(id: number, state: string, currentSongId?: number | null): void {
    if (currentSongId === undefined) {
      this.db.prepare("UPDATE users SET state = ? WHERE id = ?").run(state, id);
    } else {
      this.db
        .prepare("UPDATE users SET state = ?, current_song_id = ? WHERE id = ?")
        .run(state, currentSongId, id);
    }
  }

  /** Атомарно списывает токены. false — если не хватает. */
  debit(id: number, amount: number): boolean {
    const r = this.db
      .prepare("UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?")
      .run(amount, id, amount);
    return Number(r.changes) === 1;
  }

  credit(id: number, amount: number): void {
    this.ensureUser(id);
    this.db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(amount, id);
  }

  createSong(userId: number, story: string): Song {
    const r = this.db
      .prepare("INSERT INTO songs (user_id, story, created_at) VALUES (?, ?, ?)")
      .run(userId, story, Date.now());
    return this.getSong(Number(r.lastInsertRowid))!;
  }

  getSong(id: number): Song | undefined {
    return this.db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as unknown as Song | undefined;
  }

  listSongs(userId: number, limit = 30): Song[] {
    return this.db
      .prepare("SELECT * FROM songs WHERE user_id = ? AND status != 'draft' ORDER BY id DESC LIMIT ?")
      .all(userId, limit) as unknown as Song[];
  }

  listGenerating(): Song[] {
    return this.db.prepare("SELECT * FROM songs WHERE status = 'generating'").all() as unknown as Song[];
  }

  updateSong(id: number, patch: Partial<Omit<Song, "id" | "user_id" | "created_at">>): void {
    const keys = Object.keys(patch);
    if (!keys.length) return;
    const sql = `UPDATE songs SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    this.db.prepare(sql).run(...(Object.values(patch) as (string | number | null)[]), id);
  }

  /** draft → generating одним атомарным переходом (защита от двойного клика). */
  startGenerating(songId: number, cost: number): boolean {
    const r = this.db
      .prepare("UPDATE songs SET status = 'generating', cost = ? WHERE id = ? AND status = 'draft'")
      .run(cost, songId);
    return Number(r.changes) === 1;
  }

  createPayment(userId: number, packId: string, amountRub: number, tokens: number): Payment {
    const r = this.db
      .prepare("INSERT INTO payments (user_id, pack_id, amount_rub, tokens, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, packId, amountRub, tokens, Date.now());
    return this.getPayment(Number(r.lastInsertRowid))!;
  }

  getPayment(invId: number): Payment | undefined {
    return this.db.prepare("SELECT * FROM payments WHERE inv_id = ?").get(invId) as unknown as Payment | undefined;
  }

  /** pending → paid + начисление токенов, идемпотентно. Возвращает платёж, если начислили сейчас. */
  settlePayment(invId: number): Payment | undefined {
    const r = this.db
      .prepare("UPDATE payments SET status = 'paid' WHERE inv_id = ? AND status = 'pending'")
      .run(invId);
    if (Number(r.changes) !== 1) return undefined;
    const p = this.getPayment(invId)!;
    this.credit(p.user_id, p.tokens);
    return p;
  }
}
