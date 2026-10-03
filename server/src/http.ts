import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PACKS, SONG_COST, config } from "./config.js";
import { Core, CoreError } from "./core.js";
import { verifyInitData } from "./max/initData.js";
import { CUSTOM_OCCASION_ID, OCCASIONS, occasionTitle } from "./occasions.js";
import { verifyResult } from "./services/robokassa.js";

interface Deps {
  core: Core;
  /** Проверка обязательной подписки (для бота и мини-приложения одна и та же). */
  isSubscribed: (userId: number) => Promise<boolean>;
}

declare module "fastify" {
  interface FastifyRequest {
    userId: number;
  }
}

export function buildServer({ core, isSubscribed }: Deps) {
  const app = Fastify({ logger: true });

  // --- авторизация мини-приложения ---
  app.decorateRequest("userId", 0);
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith("/api/")) return;
    const initData = req.headers["x-max-init-data"];
    let id: number | undefined;
    if (typeof initData === "string") id = verifyInitData(initData, config.max.token)?.id;
    else if (config.devAuth && typeof req.headers["x-dev-user"] === "string") id = Number(req.headers["x-dev-user"]);
    if (!id) return reply.code(401).send({ error: "unauthorized" });
    req.userId = id;
    core.store.ensureUser(id);
  });

  app.setErrorHandler((err: Error, _req, reply) => {
    if (err instanceof CoreError) {
      const status = { no_balance: 402, not_found: 404, bad_state: 409, empty: 400 }[err.code];
      return reply.code(status).send({ error: err.code, message: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: "internal" });
  });

  const songView = (s: ReturnType<typeof core.store.getSong> & object) => ({
    id: s.id,
    title: s.title,
    lyrics: s.lyrics,
    style: s.style,
    occasion: s.occasion,
    status: s.status,
    audioUrl: s.audio_url,
    createdAt: s.created_at,
  });

  // --- API мини-приложения ---
  app.get("/api/me", async (req) => ({
    id: req.userId,
    balance: core.store.getUser(req.userId)!.balance,
    songCost: SONG_COST,
    packs: PACKS,
    occasions: OCCASIONS,
    subscribed: await isSubscribed(req.userId),
    channels: config.max.requiredChannels.map((c) => c.url),
  }));

  app.get("/api/songs", async (req) => core.store.listSongs(req.userId).map(songView));

  app.get<{ Params: { id: string } }>("/api/songs/:id", async (req, reply) => {
    const s = core.store.getSong(Number(req.params.id));
    if (!s || s.user_id !== req.userId) return reply.code(404).send({ error: "not_found" });
    return songView(s);
  });

  app.post<{ Body: { story?: string; occasionId?: string; customOccasion?: string } }>("/api/songs", async (req, reply) => {
    if (!(await isSubscribed(req.userId))) return reply.code(403).send({ error: "not_subscribed" });
    const { occasionId = "", customOccasion = "" } = req.body ?? {};
    const occasion = occasionId === CUSTOM_OCCASION_ID ? customOccasion : (occasionTitle(occasionId) ?? "");
    return songView(await core.createDraft(req.userId, req.body?.story ?? "", occasion));
  });

  app.post<{ Params: { id: string }; Body: { feedback?: string } }>("/api/songs/:id/revise", async (req) =>
    songView(await core.reviseDraft(req.userId, Number(req.params.id), req.body?.feedback ?? "")),
  );

  app.post<{ Params: { id: string } }>("/api/songs/:id/confirm", async (req, reply) => {
    if (!(await isSubscribed(req.userId))) return reply.code(403).send({ error: "not_subscribed" });
    return songView(core.confirm(req.userId, Number(req.params.id)));
  });

  app.post<{ Body: { packId?: string } }>("/api/pay", async (req) => core.startPayment(req.userId, req.body?.packId ?? ""));

  // --- вебхуки ---
  app.register(async (hooks) => {
    hooks.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_r, body, done) =>
      done(null, Object.fromEntries(new URLSearchParams(body as string))),
    );
    const result = async (params: Record<string, string>, reply: FastifyReply) => {
      const { OutSum = "", InvId = "", SignatureValue = "" } = params;
      if (!verifyResult(OutSum, InvId, SignatureValue)) return reply.code(400).send("bad signature");
      const p = core.store.getPayment(Number(InvId));
      if (!p || Number(OutSum) !== p.amount_rub) return reply.code(400).send("bad payment");
      await core.settlePayment(p.inv_id);
      return reply.send(`OK${InvId}`);
    };
    hooks.post<{ Body: Record<string, string> }>("/pay/robokassa/result", (req, reply) => result(req.body ?? {}, reply));
    hooks.get<{ Querystring: Record<string, string> }>("/pay/robokassa/result", (req, reply) => result(req.query, reply));
    // Suno присылает callback, но мы опрашиваем статус сами — достаточно ответить 200.
    hooks.post("/hooks/suno", async () => ({ ok: true }));
    hooks.get("/pay/success", async (_r, reply) => reply.type("text/html").send("<h3>Оплата прошла. Вернитесь в MAX.</h3>"));
    hooks.get("/pay/fail", async (_r, reply) => reply.type("text/html").send("<h3>Оплата не завершена. Вернитесь в MAX.</h3>"));
  });

  // --- статика мини-приложения ---
  const dist = resolve(import.meta.dirname, "../../miniapp/dist");
  if (existsSync(dist)) app.register(fastifyStatic, { root: dist });

  return app;
}
