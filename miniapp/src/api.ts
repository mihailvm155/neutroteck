export interface Pack { id: string; tokens: number; priceRub: number }
export interface Occasion { id: string; emoji: string; title: string }
export interface Me { id: number; balance: number; songCost: number; packs: Pack[]; occasions: Occasion[]; subscribed: boolean; channels: string[] }
export interface Song {
  id: number; title: string; lyrics: string; style: string;
  status: "draft" | "generating" | "done" | "failed"; audioUrl: string | null;
}

declare global {
  interface Window {
    WebApp?: { initData: string; ready(): void; openLink(url: string): void };
  }
}

export const webApp = window.WebApp;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = body === undefined ? {} : { "Content-Type": "application/json" };
  if (webApp?.initData) headers["X-Max-Init-Data"] = webApp.initData;
  else if (import.meta.env.DEV) headers["X-Dev-User"] = "1"; // локальная отладка вне MAX (нужен DEV_AUTH=1)
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.message ?? json.error ?? "error"), { code: json.error as string });
  return json as T;
}

const realApi = {
  me: () => req<Me>("GET", "/api/me"),
  songs: () => req<Song[]>("GET", "/api/songs"),
  song: (id: number) => req<Song>("GET", `/api/songs/${id}`),
  create: (story: string, occasionId: string, customOccasion: string) =>
    req<Song>("POST", "/api/songs", { story, occasionId, customOccasion }),
  revise: (id: number, feedback: string) => req<Song>("POST", `/api/songs/${id}/revise`, { feedback }),
  confirm: (id: number) => req<Song>("POST", `/api/songs/${id}/confirm`),
  pay: (packId: string) => req<{ url: string }>("POST", "/api/pay", { packId }),
};

/** ?demo=1 — интерфейс на тестовых данных без сервера (см. demo.ts). */
export const isDemo = new URLSearchParams(location.search).has("demo");
export const api: typeof realApi = isDemo ? (await import("./demo")).demoApi : realApi;
