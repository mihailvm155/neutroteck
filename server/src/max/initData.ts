import { createHmac, timingSafeEqual } from "node:crypto";

export interface InitUser {
  id: number;
  first_name?: string;
  last_name?: string;
}

/**
 * Проверка подписи initData мини-приложения MAX (WebApp.initData).
 * Алгоритм как у Telegram WebApp: secret = HMAC_SHA256("WebAppData", botToken),
 * hash = HMAC_SHA256(secret, отсортированные "key=value" через \n без hash).
 * Возвращает пользователя или null, если подпись неверна или данные устарели.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 24 * 3600,
  now = Date.now(),
): InitUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest("hex");

  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as InitUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}
