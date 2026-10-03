import { config } from "../config.js";

export interface MusicProvider {
  /** Запускает генерацию, возвращает id задачи. */
  start(input: { title: string; style: string; lyrics: string }): Promise<string>;
  /** Состояние задачи. */
  poll(taskId: string): Promise<{ status: "pending" | "done" | "failed"; audioUrl?: string }>;
}

/**
 * Suno через агрегатор с API формата sunoapi.org
 * (POST /api/v1/generate, GET /api/v1/generate/record-info).
 * Если выберете другого агрегатора — меняйте только этот класс.
 */
export class SunoApiOrg implements MusicProvider {
  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(config.suno.baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${config.suno.apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as { code?: number; msg?: string; data: T };
    if (!res.ok || (json.code !== undefined && json.code !== 200)) {
      throw new Error(`Suno ${path}: ${res.status} ${json.msg ?? ""}`);
    }
    return json.data;
  }

  async start({ title, style, lyrics }: { title: string; style: string; lyrics: string }) {
    const data = await this.req<{ taskId: string }>("POST", "/api/v1/generate", {
      customMode: true,
      instrumental: false,
      model: config.suno.model,
      prompt: lyrics,
      style,
      title,
      callBackUrl: `${config.publicUrl}/hooks/suno`,
    });
    return data.taskId;
  }

  async poll(taskId: string) {
    const data = await this.req<{
      status: string;
      response?: { sunoData?: { audioUrl?: string; streamAudioUrl?: string }[] };
    }>("GET", `/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
    if (data.status === "SUCCESS") {
      const url = data.response?.sunoData?.[0]?.audioUrl;
      return url ? { status: "done" as const, audioUrl: url } : { status: "failed" as const };
    }
    if (/FAILED|ERROR/.test(data.status)) return { status: "failed" as const };
    return { status: "pending" as const };
  }
}

/** Заглушка: «генерирует» 3 секунды и отдаёт тестовый mp3. */
export class MockMusic implements MusicProvider {
  private started = new Map<string, number>();
  async start() {
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.started.set(id, Date.now());
    return id;
  }
  async poll(taskId: string) {
    const t = this.started.get(taskId) ?? 0;
    return Date.now() - t > 3000
      ? { status: "done" as const, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" }
      : { status: "pending" as const };
  }
}

export const makeMusicProvider = (): MusicProvider =>
  config.suno.apiKey ? new SunoApiOrg() : new MockMusic();
