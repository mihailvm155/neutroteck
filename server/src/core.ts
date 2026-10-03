import { PACKS, SONG_COST } from "./config.js";
import type { Song, Store } from "./db.js";
import type { LyricsProvider } from "./services/lyrics.js";
import type { MusicProvider } from "./services/music.js";
import { paymentUrl } from "./services/robokassa.js";

export type Notify = (userId: number, text: string, opts?: { songId?: number }) => Promise<void>;

export class CoreError extends Error {
  constructor(readonly code: "no_balance" | "not_found" | "bad_state" | "empty", message: string) {
    super(message);
  }
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** Бизнес-логика, общая для бота и мини-приложения. */
export class Core {
  constructor(
    readonly store: Store,
    private lyrics: LyricsProvider,
    private music: MusicProvider,
    private notify: Notify,
    private pollIntervalMs = POLL_INTERVAL_MS,
  ) {}

  /** Новый черновик: рассказ → текст песни. */
  async createDraft(userId: number, story: string, occasion = ""): Promise<Song> {
    story = story.trim();
    if (!story) throw new CoreError("empty", "Пустой рассказ");
    this.store.ensureUser(userId);
    occasion = occasion.trim().slice(0, 100);
    const song = this.store.createSong(userId, story, occasion);
    const r = await this.lyrics.generate({ story, occasion });
    this.store.updateSong(song.id, r);
    return this.store.getSong(song.id)!;
  }

  /** Правка текста по комментарию пользователя (бесплатно). */
  async reviseDraft(userId: number, songId: number, feedback: string): Promise<Song> {
    const song = this.owned(userId, songId);
    if (song.status !== "draft") throw new CoreError("bad_state", "Песня уже запущена");
    if (!feedback.trim()) throw new CoreError("empty", "Пустая правка");
    const r = await this.lyrics.generate({ story: song.story, occasion: song.occasion, previous: song.lyrics, feedback });
    this.store.updateSong(song.id, r);
    return this.store.getSong(song.id)!;
  }

  /** «Сделать хит!»: списывает токены и запускает генерацию в фоне. */
  confirm(userId: number, songId: number): Song {
    const song = this.owned(userId, songId);
    if (song.status !== "draft") throw new CoreError("bad_state", "Песня уже запущена");
    if (!this.store.debit(userId, SONG_COST)) throw new CoreError("no_balance", "Недостаточно токенов");
    if (!this.store.startGenerating(song.id, SONG_COST)) {
      this.store.credit(userId, SONG_COST); // параллельный клик уже запустил
      throw new CoreError("bad_state", "Песня уже запущена");
    }
    void this.runJob(this.store.getSong(song.id)!);
    return this.store.getSong(song.id)!;
  }

  /** Возобновить опрос задач после рестарта сервера. */
  resume(): void {
    for (const s of this.store.listGenerating()) void this.runJob(s);
  }

  startPayment(userId: number, packId: string): { url: string; invId: number } {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) throw new CoreError("not_found", "Нет такого тарифа");
    this.store.ensureUser(userId);
    const p = this.store.createPayment(userId, pack.id, pack.priceRub, pack.tokens);
    const url = paymentUrl({ invId: p.inv_id, amountRub: p.amount_rub, description: `${pack.tokens} токенов` });
    return { url, invId: p.inv_id };
  }

  /** Вызывается из ResultURL Robokassa. */
  async settlePayment(invId: number): Promise<void> {
    const p = this.store.settlePayment(invId);
    if (p) await this.safeNotify(p.user_id, `✅ Оплата получена, начислено ${p.tokens} токенов.`);
  }

  private owned(userId: number, songId: number): Song {
    const s = this.store.getSong(songId);
    if (!s || s.user_id !== userId) throw new CoreError("not_found", "Песня не найдена");
    return s;
  }

  private async runJob(song: Song): Promise<void> {
    try {
      const taskId = song.task_id ?? (await this.music.start(song));
      if (!song.task_id) this.store.updateSong(song.id, { task_id: taskId });
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, this.pollIntervalMs));
        const r = await this.music.poll(taskId);
        if (r.status === "done") {
          this.store.updateSong(song.id, { status: "done", audio_url: r.audioUrl ?? null });
          await this.safeNotify(song.user_id, "🎉 Ваша песня готова!", { songId: song.id });
          return;
        }
        if (r.status === "failed") break;
      }
      throw new Error("generation failed or timed out");
    } catch (e) {
      console.error(`song ${song.id} failed:`, e);
      this.store.updateSong(song.id, { status: "failed" });
      this.store.credit(song.user_id, song.cost);
      await this.safeNotify(song.user_id, "😔 Не получилось сгенерировать песню. Токены возвращены на баланс.");
    }
  }

  private async safeNotify(...args: Parameters<Notify>) {
    try {
      await this.notify(...args);
    } catch (e) {
      console.error("notify failed:", e);
    }
  }
}
