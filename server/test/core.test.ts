import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { SONG_COST } from "../src/config.js";
import { Core, CoreError } from "../src/core.js";
import { Store, openDb } from "../src/db.js";
import { verifyInitData } from "../src/max/initData.js";
import { MockLyrics } from "../src/services/lyrics.js";
import { verifyResult } from "../src/services/robokassa.js";
import type { MusicProvider } from "../src/services/music.js";

const okMusic: MusicProvider = {
  start: async () => "t1",
  poll: async () => ({ status: "done", audioUrl: "https://x/a.mp3" }),
};
const failMusic: MusicProvider = { start: async () => "t2", poll: async () => ({ status: "failed" }) };

function setup(music: MusicProvider) {
  const store = new Store(openDb(":memory:"));
  const sent: string[] = [];
  const core = new Core(store, new MockLyrics(), music, async (_u, t) => void sent.push(t), 5);
  return { store, core, sent };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("confirm без баланса не запускает генерацию", async () => {
  const { core } = setup(okMusic);
  const song = await core.createDraft(1, "Вася любит пиццу");
  assert.throws(() => core.confirm(1, song.id), (e) => e instanceof CoreError && e.code === "no_balance");
});

test("успешная генерация списывает токены и отдаёт аудио", async () => {
  const { core, store, sent } = setup(okMusic);
  store.credit(1, SONG_COST + 10);
  const song = await core.createDraft(1, "Вася любит пиццу");
  core.confirm(1, song.id);
  assert.equal(store.getUser(1)!.balance, 10);
  await wait(60);
  assert.equal(store.getSong(song.id)!.status, "done");
  assert.equal(store.getSong(song.id)!.audio_url, "https://x/a.mp3");
  assert.ok(sent.some((t) => t.includes("готова")));
});

test("повторный confirm не списывает дважды", async () => {
  const { core, store } = setup(okMusic);
  store.credit(1, SONG_COST * 2);
  const song = await core.createDraft(1, "x");
  core.confirm(1, song.id);
  assert.throws(() => core.confirm(1, song.id), (e) => e instanceof CoreError && e.code === "bad_state");
  assert.equal(store.getUser(1)!.balance, SONG_COST);
});

test("провал генерации возвращает токены", async () => {
  const { core, store } = setup(failMusic);
  store.credit(1, SONG_COST);
  const song = await core.createDraft(1, "x");
  core.confirm(1, song.id);
  await wait(60);
  assert.equal(store.getSong(song.id)!.status, "failed");
  assert.equal(store.getUser(1)!.balance, SONG_COST);
});

test("чужую песню запускать нельзя", async () => {
  const { core, store } = setup(okMusic);
  store.credit(2, SONG_COST);
  const song = await core.createDraft(1, "x");
  assert.throws(() => core.confirm(2, song.id), (e) => e instanceof CoreError && e.code === "not_found");
});

test("платёж начисляется ровно один раз", async () => {
  const { core, store } = setup(okMusic);
  const { invId } = core.startPayment(5, "p589");
  await core.settlePayment(invId);
  await core.settlePayment(invId);
  assert.equal(store.getUser(5)!.balance, 589);
});

test("подпись Robokassa", () => {
  const sig = "e3a5b0a3b6a2b1a0".padEnd(32, "0");
  assert.equal(verifyResult("439.00", "1", sig, "pw"), false);
  
  const good = createHash("md5").update("439.00:1:pw").digest("hex").toUpperCase();
  assert.equal(verifyResult("439.00", "1", good, "pw"), true);
});

test("initData: валидная, чужая подпись и устаревшая", () => {
  const token = "bot-token";
  const sign = (fields: Record<string, string>) => {
    const dc = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const hash = createHmac("sha256", secret).update(dc).digest("hex");
    return new URLSearchParams({ ...fields, hash }).toString();
  };
  const now = Date.now();
  const fields = { auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: 42 }) };
  assert.equal(verifyInitData(sign(fields), token, 3600, now)?.id, 42);
  assert.equal(verifyInitData(sign(fields), "other", 3600, now), null);
  assert.equal(verifyInitData(sign(fields), token, 3600, now + 7200_000), null);
});
