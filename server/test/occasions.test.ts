import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Core } from "../src/core.js";
import { Store, openDb } from "../src/db.js";
import { MaxApi, type Keyboard } from "../src/max/api.js";
import { Bot } from "../src/max/bot.js";
import { OCCASIONS } from "../src/occasions.js";
import type { LyricsProvider } from "../src/services/lyrics.js";
import { MockMusic } from "../src/services/music.js";

test("поводы: уникальные id и title", () => {
  assert.equal(new Set(OCCASIONS.map((o) => o.id)).size, OCCASIONS.length);
  assert.equal(new Set(OCCASIONS.map((o) => o.title)).size, OCCASIONS.length);
  assert.ok(OCCASIONS.length >= 40);
});

test("повод сохраняется и уходит в генерацию текста, в том числе при правке", async () => {
  const seen: (string | undefined)[] = [];
  const lyrics: LyricsProvider = {
    generate: async ({ occasion }) => (seen.push(occasion), { title: "t", style: "pop", lyrics: "[Verse]\nx" }),
  };
  const store = new Store(openDb(":memory:"));
  const core = new Core(store, lyrics, new MockMusic(), async () => {});
  const song = await core.createDraft(1, "Вася", "Новоселье");
  await core.reviseDraft(1, song.id, "короче");
  assert.deepEqual(seen, ["Новоселье", "Новоселье"]);
  assert.equal(store.getSong(song.id)!.occasion, "Новоселье");
});

test("миграция: старая база без колонки occasion открывается", () => {
  const path = `/tmp/old-${Date.now()}.db`;
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, state TEXT NOT NULL DEFAULT 'idle', balance INTEGER NOT NULL DEFAULT 0, current_song_id INTEGER, created_at INTEGER NOT NULL);
            CREATE TABLE songs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, story TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', style TEXT NOT NULL DEFAULT '', lyrics TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', task_id TEXT, audio_url TEXT, cost INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);`);
  old.close();
  const store = new Store(openDb(path));
  store.ensureUser(1);
  store.setOccasion(1, "Юбилей");
  assert.equal(store.getUser(1)!.occasion, "Юбилей");
  openDb(path); // повторное открытие не падает
});

test("бот: меню поводов листается, выбор повода ведёт к рассказу", async () => {
  const sent: { text: string; kb?: Keyboard }[] = [];
  const api = { send: async (_u: number, text: string, kb?: Keyboard) => void sent.push({ text, kb }), answerCallback: async () => {} } as unknown as MaxApi;
  const store = new Store(openDb(":memory:"));
  const core = new Core(store, { generate: async () => ({ title: "t", style: "s", lyrics: "l" }) }, new MockMusic(), async () => {});
  const bot = new Bot(api, core);
  const press = (payload: string) =>
    bot.handle({ update_type: "message_callback", timestamp: 0, callback: { callback_id: "c", payload, user: { user_id: 1 } } });

  await press("create");
  const first = sent.at(-1)!.kb!.flat();
  assert.ok(first.some((b) => b.type === "callback" && b.payload === "occ:birthday"));
  assert.ok(first.some((b) => b.type === "callback" && b.payload === "occp:1"));
  for (const b of sent.at(-1)!.kb!.flat()) if (b.type === "callback") assert.ok(b.payload.length < 64);

  await press("occp:3");
  assert.ok(sent.at(-1)!.kb!.flat().some((b) => b.type === "callback" && b.payload === "occ:none"));

  await press("occ:pet");
  assert.equal(store.getUser(1)!.occasion, "Для питомца");
  assert.equal(store.getUser(1)!.state, "awaiting_story");

  await press("occ:custom");
  assert.equal(store.getUser(1)!.state, "awaiting_occasion");
  await bot.handle({ update_type: "message_created", timestamp: 0, message: { sender: { user_id: 1 }, body: { text: "Проводы в декрет" } } });
  assert.equal(store.getUser(1)!.occasion, "Проводы в декрет");
  assert.equal(store.getUser(1)!.state, "awaiting_story");
});
