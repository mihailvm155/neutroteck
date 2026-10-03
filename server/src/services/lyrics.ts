import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export interface LyricsResult {
  title: string;
  style: string;
  lyrics: string;
}

export interface LyricsProvider {
  generate(input: { story: string; previous?: string; feedback?: string }): Promise<LyricsResult>;
}

const SYSTEM = `Ты — автор персональных песен-подарков на русском языке.
По рассказу пользователя (имя героя, черты, смешные истории, повод) напиши текст песни.
Требования:
- структура с метками на английском: [Verse], [Chorus], [Verse 2], [Chorus], [Bridge], [Chorus];
- рифма, ритм, лёгкая шутка и тёплая интонация; используй конкретные детали из рассказа;
- не выдумывай факты о реальных людях сверх рассказа; без оскорблений и грубости;
- длина 150–250 слов.
Ответь ТОЛЬКО JSON без markdown: {"title": "...", "style": "жанр и настроение по-английски для генератора музыки, например: upbeat pop, female vocals", "lyrics": "..."}`;

export class ClaudeLyrics implements LyricsProvider {
  private client = new Anthropic({ apiKey: config.lyrics.apiKey });

  async generate({ story, previous, feedback }: { story: string; previous?: string; feedback?: string }) {
    const user = previous
      ? `Рассказ:\n${story}\n\nТекущий текст:\n${previous}\n\nПравки пользователя:\n${feedback}\n\nПерепиши текст с учётом правок.`
      : `Рассказ:\n${story}`;
    const msg = await this.client.messages.create({
      model: config.lyrics.model,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return parseLyrics(text);
  }
}

export function parseLyrics(raw: string): LyricsResult {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const o = JSON.parse(json) as Partial<LyricsResult>;
  if (!o.lyrics?.trim()) throw new Error("LLM вернул пустой текст");
  return {
    title: (o.title ?? "Песня").trim().slice(0, 80),
    style: (o.style ?? "pop").trim().slice(0, 200),
    lyrics: o.lyrics.trim(),
  };
}

/** Без ключа Anthropic — заглушка, чтобы весь флоу работал локально. */
export class MockLyrics implements LyricsProvider {
  async generate({ story, feedback }: { story: string; feedback?: string }) {
    const hero = story.split(/\s+/).slice(0, 3).join(" ");
    return {
      title: "Тестовая песня",
      style: "upbeat pop",
      lyrics: `[Verse]\nЭто песня про: ${hero}\n${feedback ? `Правка: ${feedback}\n` : ""}\n[Chorus]\nЛа-ла-ла, это тест,\nЛучше песни в мире нет!`,
    };
  }
}

export const makeLyricsProvider = (): LyricsProvider =>
  config.lyrics.apiKey ? new ClaudeLyrics() : new MockLyrics();
