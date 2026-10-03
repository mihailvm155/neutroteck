import { config } from "../config.js";

export type Button =
  | { type: "callback"; text: string; payload: string }
  | { type: "link"; text: string; url: string }
  | { type: "open_app"; text: string; web_app: string };

export type Keyboard = Button[][];

export interface Update {
  update_type: string;
  timestamp: number;
  user?: { user_id: number };
  message?: { sender?: { user_id: number }; body?: { text?: string } };
  callback?: { callback_id: string; payload?: string; user: { user_id: number } };
}

export class MaxApi {
  constructor(
    private token = config.max.token,
    private base = config.max.apiBase,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`MAX ${method} ${path} → ${res.status}: ${text}`);
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async getUpdates(marker: number | undefined, timeoutSec = 30) {
    const q = new URLSearchParams({ timeout: String(timeoutSec), limit: "100" });
    if (marker !== undefined) q.set("marker", String(marker));
    return this.call<{ updates: Update[]; marker?: number }>("GET", `/updates?${q}`);
  }

  async send(userId: number, text: string, keyboard?: Keyboard) {
    const body: Record<string, unknown> = { text };
    if (keyboard) {
      body.attachments = [{ type: "inline_keyboard", payload: { buttons: keyboard } }];
    }
    return this.call("POST", `/messages?user_id=${userId}`, body);
  }

  async answerCallback(callbackId: string, notification?: string) {
    return this.call("POST", `/answers?callback_id=${encodeURIComponent(callbackId)}`, {
      notification: notification ?? " ",
    });
  }

  /** Состоит ли пользователь в чате/канале. */
  async isMember(chatId: number, userId: number): Promise<boolean> {
    try {
      const r = await this.call<{ members?: { user_id: number }[] }>(
        "GET",
        `/chats/${chatId}/members?user_ids=${userId}`,
      );
      return (r.members ?? []).some((m) => m.user_id === userId);
    } catch {
      return false;
    }
  }
}
