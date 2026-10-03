import { config } from "./config.js";
import { Core } from "./core.js";
import { Store, openDb } from "./db.js";
import { buildServer } from "./http.js";
import { MaxApi } from "./max/api.js";
import { Bot } from "./max/bot.js";
import { makeLyricsProvider } from "./services/lyrics.js";
import { makeMusicProvider } from "./services/music.js";

const store = new Store(openDb(config.dbPath));
const api = new MaxApi();

// Bot ↔ Core ссылаются друг на друга: Core нужен notify, Bot нужен Core.
let bot: Bot;
const core = new Core(store, makeLyricsProvider(), makeMusicProvider(), (...a) => bot.notify(...a));
bot = new Bot(api, core);

const isSubscribed = async (userId: number) => {
  for (const ch of config.max.requiredChannels) {
    if (!(await api.isMember(ch.chatId, userId))) return false;
  }
  return true;
};

const app = buildServer({ core, isSubscribed });
await app.listen({ port: config.port, host: "0.0.0.0" });

core.resume();
if (config.max.token) void bot.runPolling();
else app.log.warn("MAX_BOT_TOKEN не задан — бот не запущен, работает только HTTP/мини-приложение");
