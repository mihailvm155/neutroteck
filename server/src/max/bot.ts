import { PACKS, SONG_COST, config } from "../config.js";
import { Core, CoreError } from "../core.js";
import type { Song } from "../db.js";
import { MaxApi, type Keyboard, type Update } from "./api.js";

const FAQ = `❓ FAQ

• Песня стоит ${SONG_COST} токенов.
• Текст можно править бесплатно, пока не нажата кнопка «Сделать хит!».
• Если генерация не удалась — токены вернутся на баланс.
• Генерация занимает 1–3 минуты.`;

const TARIFFS = `🔥 Выберите тариф\n\n🎵 Песня — ${SONG_COST} токенов`;

const mainKb = (): Keyboard => {
  const rows: Keyboard = [
    [{ type: "callback", text: "🎵 Создать песню", payload: "create" }],
    [{ type: "callback", text: "💳 Пополнить баланс", payload: "topup" }],
    [{ type: "callback", text: "🎧 Мои песни", payload: "songs" }],
  ];
  if (config.miniappUrl) rows.push([{ type: "link", text: "📱 Открыть приложение", url: config.miniappUrl }]);
  rows.push([{ type: "callback", text: "❓ FAQ", payload: "faq" }]);
  return rows;
};

export class Bot {
  constructor(
    private api: MaxApi,
    private core: Core,
  ) {}

  /** Сообщение пользователю (используется как Notify для Core). */
  notify = async (userId: number, text: string, opts?: { songId?: number }) => {
    const song = opts?.songId ? this.core.store.getSong(opts.songId) : undefined;
    const kb: Keyboard | undefined = song?.audio_url
      ? [[{ type: "link", text: "▶️ Слушать / скачать", url: song.audio_url }]]
      : undefined;
    await this.api.send(userId, song ? `${text}\n\n«${song.title}»` : text, kb);
  };

  async runPolling(): Promise<never> {
    let marker: number | undefined;
    for (;;) {
      try {
        const r = await this.api.getUpdates(marker);
        marker = r.marker ?? marker;
        for (const u of r.updates) await this.handle(u).catch((e) => console.error("update failed:", e));
      } catch (e) {
        console.error("polling error:", e);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  async handle(u: Update): Promise<void> {
    if (u.update_type === "bot_started" && u.user) {
      return this.start(u.user.user_id);
    }
    if (u.update_type === "message_created" && u.message?.sender) {
      const id = u.message.sender.user_id;
      return this.onText(id, (u.message.body?.text ?? "").trim());
    }
    if (u.update_type === "message_callback" && u.callback) {
      await this.api.answerCallback(u.callback.callback_id).catch(() => {});
      return this.onCallback(u.callback.user.user_id, u.callback.payload ?? "");
    }
  }

  // ---- экраны ----

  private async start(userId: number) {
    this.core.store.ensureUser(userId);
    if (!(await this.subscribed(userId))) return this.gate(userId);
    return this.home(userId);
  }

  private async subscribed(userId: number) {
    for (const ch of config.max.requiredChannels) {
      if (!(await this.api.isMember(ch.chatId, userId))) return false;
    }
    return true;
  }

  private async gate(userId: number) {
    const kb: Keyboard = config.max.requiredChannels.map((c, i) => [
      { type: "link", text: `${i + 1}. Подписаться`, url: c.url } as const,
    ]);
    kb.push([{ type: "callback", text: "✅ Проверить подписку", payload: "check_sub" }]);
    await this.api.send(
      userId,
      "Для использования бота необходимо подписаться на все каналы ниже:\n\nПодписка поможет нам радовать вас нашими песнями 🥳",
      kb,
    );
  }

  private async home(userId: number) {
    const u = this.core.store.ensureUser(userId);
    this.core.store.setState(userId, "idle", null);
    const text =
      u.balance >= SONG_COST
        ? `На вашем балансе ${u.balance} токенов 🎵`
        : `На вашем балансе ${u.balance} токенов\nПополните баланс, чтобы продолжить.`;
    await this.api.send(userId, text, mainKb());
  }

  private async tariffs(userId: number) {
    const kb: Keyboard = PACKS.map((p) => [
      { type: "callback", text: `${p.tokens} токенов — ${p.priceRub}₽`, payload: `buy:${p.id}` } as const,
    ]);
    kb.push([{ type: "callback", text: "Назад", payload: "home" }]);
    await this.api.send(userId, TARIFFS, kb);
  }

  private async showDraft(userId: number, song: Song) {
    this.core.store.setState(userId, "reviewing", song.id);
    await this.api.send(userId, `${song.lyrics}`, [
      [{ type: "callback", text: "🔥 Сделать хит!", payload: `go:${song.id}` }],
      [{ type: "callback", text: "Изменить текст", payload: `edit:${song.id}` }],
    ]);
  }

  // ---- обработчики ----

  private async onCallback(userId: number, payload: string) {
    const [cmd, arg] = payload.split(":");
    if (cmd === "check_sub") return (await this.subscribed(userId))
      ? (await this.api.send(userId, "✅ Подписка подтверждена, доступ открыт!"), this.home(userId))
      : (await this.api.send(userId, "Подписка пока не найдена. Подпишитесь и нажмите «Проверить» ещё раз."), this.gate(userId));

    if (!(await this.subscribed(userId))) return this.gate(userId);

    switch (cmd) {
      case "home":
        return this.home(userId);
      case "faq":
        return void (await this.api.send(userId, FAQ, [[{ type: "callback", text: "Назад", payload: "home" }]]));
      case "topup":
        return this.tariffs(userId);
      case "buy": {
        const { url } = this.core.startPayment(userId, arg ?? "");
        return void (await this.api.send(userId, "Перейдите по кнопке для оплаты. Токены придут автоматически.", [
          [{ type: "link", text: "💳 Оплатить", url }],
        ]));
      }
      case "create":
        this.core.store.setState(userId, "awaiting_story");
        return void (await this.api.send(
          userId,
          "Ну а теперь самое главное! Сделаем песню по-настоящему личной 🎯\n\n" +
            "💬 Напиши всё, что может вдохновить:\n" +
            "– Как зовут героя или героиню песни?\n" +
            "– Чем он/она запомнился? Какие фишки?\n" +
            "– Есть ли смешные истории или любимые фразы?\n" +
            "– Что хочется передать этим треком — любовь, угар, благодарность?",
        ));
      case "edit":
        this.core.store.setState(userId, "awaiting_feedback", Number(arg));
        return void (await this.api.send(userId, "Напишите, что изменить в тексте (имя, тон, добавить историю…)"));
      case "go":
        return this.confirm(userId, Number(arg));
      case "songs":
        return this.songs(userId);
    }
  }

  private async onText(userId: number, text: string) {
    if (text.startsWith("/grant") && config.adminIds.includes(userId)) {
      const [, uid, n] = text.split(/\s+/);
      this.core.store.credit(Number(uid), Number(n));
      return void (await this.api.send(userId, `Начислено ${n} токенов пользователю ${uid}`));
    }
    if (text === "/start" || text === "/menu") return this.start(userId);
    if (!(await this.subscribed(userId))) return this.gate(userId);

    const user = this.core.store.ensureUser(userId);
    try {
      if (user.state === "awaiting_story" && text) {
        await this.api.send(userId, "⏳ Пишу текст, подождите пару минут…");
        return this.showDraft(userId, await this.core.createDraft(userId, text));
      }
      if (user.state === "awaiting_feedback" && user.current_song_id && text) {
        await this.api.send(userId, "⏳ Переписываю текст…");
        return this.showDraft(userId, await this.core.reviseDraft(userId, user.current_song_id, text));
      }
    } catch (e) {
      console.error(e);
      return void (await this.api.send(userId, "Не получилось написать текст, попробуйте ещё раз."));
    }
    return this.home(userId);
  }

  private async confirm(userId: number, songId: number) {
    try {
      this.core.confirm(userId, songId);
      this.core.store.setState(userId, "idle", null);
      await this.api.send(userId, "🎶 Песня в работе! Это займёт 1–3 минуты, я пришлю её сюда.");
    } catch (e) {
      if (e instanceof CoreError && e.code === "no_balance") {
        await this.api.send(userId, `Не хватает токенов (нужно ${SONG_COST}). Пополните баланс — текст сохранится.`, [
          [{ type: "callback", text: "💳 Пополнить баланс", payload: "topup" }],
        ]);
      } else if (e instanceof CoreError) {
        await this.api.send(userId, e.message);
      } else throw e;
    }
  }

  private async songs(userId: number) {
    const list = this.core.store.listSongs(userId, 10);
    if (!list.length) return void (await this.api.send(userId, "У вас пока нет песен.", mainKb()));
    const kb: Keyboard = list.map((s) =>
      s.status === "done" && s.audio_url
        ? ([{ type: "link", text: `▶️ ${s.title}`, url: s.audio_url }] as Keyboard[number])
        : ([{ type: "callback", text: `⏳ ${s.title || "Песня"} (${s.status})`, payload: "songs" }] as Keyboard[number]),
    );
    kb.push([{ type: "callback", text: "Назад", payload: "home" }]);
    await this.api.send(userId, "🎧 Ваши песни:", kb);
  }
}
