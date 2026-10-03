const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  publicUrl: (env.PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  dbPath: env.DB_PATH ?? "./data/app.db",
  devAuth: env.DEV_AUTH === "1",
  adminIds: (env.ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number),
  miniappUrl: env.MINIAPP_URL ?? "",
  max: {
    token: env.MAX_BOT_TOKEN ?? "",
    apiBase: env.MAX_API_BASE ?? "https://platform-api.max.ru",
    requiredChannels: (env.REQUIRED_CHANNELS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [chatId, url] = s.split("|");
        return { chatId: Number(chatId), url: url ?? "" };
      }),
  },
  lyrics: {
    apiKey: env.ANTHROPIC_API_KEY ?? "",
    model: env.LYRICS_MODEL ?? "claude-sonnet-5-5",
  },
  suno: {
    baseUrl: (env.SUNO_BASE_URL ?? "https://api.sunoapi.org").replace(/\/$/, ""),
    apiKey: env.SUNO_API_KEY ?? "",
    model: env.SUNO_MODEL ?? "V4_5",
  },
  robokassa: {
    login: env.ROBOKASSA_LOGIN ?? "",
    password1: env.ROBOKASSA_PASSWORD1 ?? "",
    password2: env.ROBOKASSA_PASSWORD2 ?? "",
    test: env.ROBOKASSA_TEST !== "0",
  },
};

/** Стоимость песни и тарифные пакеты (как на скриншотах исходного сервиса). */
export const SONG_COST = 439;

export const PACKS = [
  { id: "p439", tokens: 439, priceRub: 439 },
  { id: "p589", tokens: 589, priceRub: 589 },
  { id: "p1317", tokens: 1317, priceRub: 1099 },
  { id: "p4390", tokens: 4390, priceRub: 3190 },
] as const;
