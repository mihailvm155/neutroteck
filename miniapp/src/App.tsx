import { useCallback, useEffect, useState } from "react";
import { api, webApp, type Me, type Occasion, type Song } from "./api";

type Screen = "home" | "create" | "draft" | "topup" | "songs";

export function App() {
  const [me, setMe] = useState<Me>();
  const [screen, setScreen] = useState<Screen>("home");
  const [draft, setDraft] = useState<Song>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = useCallback(() => api.me().then(setMe).catch((e) => setError(e.message)), []);
  useEffect(() => {
    webApp?.ready();
    refresh();
  }, [refresh]);

  /** Обёртка: индикатор занятости + показ ошибки. */
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      if ((e as { code?: string }).code === "no_balance") setScreen("topup");
    } finally {
      setBusy("");
    }
  };

  if (!me) return <main>{error || "Загрузка…"}</main>;

  if (!me.subscribed)
    return (
      <main>
        <h2>Подпишитесь на каналы</h2>
        {me.channels.map((url, i) => (
          <a key={url} className="btn" href={url} target="_blank" rel="noreferrer">{i + 1}. Подписаться</a>
        ))}
        <button onClick={refresh}>✅ Проверить подписку</button>
      </main>
    );

  return (
    <main>
      <header>
        <b>💰 {me.balance} токенов</b>
        {screen !== "home" && <button className="link" onClick={() => setScreen("home")}>← Назад</button>}
      </header>
      {error && <p className="error">{error}</p>}
      {busy && <p className="busy">⏳ {busy}</p>}

      {screen === "home" && (
        <>
          <h2>Песня в подарок 🎵</h2>
          <p>Расскажите о герое — получите песню с вашим текстом. Стоимость: {me.songCost} токенов.</p>
          <button onClick={() => setScreen("create")}>🎵 Создать песню</button>
          <button onClick={() => setScreen("songs")}>🎧 Мои песни</button>
          <button onClick={() => setScreen("topup")}>💳 Пополнить баланс</button>
        </>
      )}

      {screen === "create" && <Create occasions={me.occasions} busy={!!busy} onSubmit={(story, occ, custom) =>
        run("Пишу текст…", async () => { setDraft(await api.create(story, occ, custom)); setScreen("draft"); })} />}

      {screen === "draft" && draft && (
        <Draft song={draft} busy={!!busy}
          onRevise={(fb) => run("Переписываю…", async () => setDraft(await api.revise(draft.id, fb)))}
          onConfirm={() => run("Запускаю…", async () => { await api.confirm(draft.id); await refresh(); setScreen("songs"); })} />
      )}

      {screen === "topup" && (
        <>
          <h2>Выберите тариф</h2>
          {me.packs.map((p) => (
            <button key={p.id} onClick={() => run("Создаю платёж…", async () => {
              const { url } = await api.pay(p.id);
              webApp ? webApp.openLink(url) : window.open(url, "_blank");
            })}>♥ {p.tokens} токенов — {p.priceRub}₽</button>
          ))}
          <button className="link" onClick={refresh}>Обновить баланс</button>
        </>
      )}

      {screen === "songs" && <Songs onChange={refresh} />}
    </main>
  );
}

function Create({ occasions, onSubmit, busy }: {
  occasions: Occasion[]; busy: boolean; onSubmit: (story: string, occasionId: string, custom: string) => void;
}) {
  const [occ, setOcc] = useState("");
  const [custom, setCustom] = useState("");
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? occasions : occasions.slice(0, 12);
  const ready = text.trim() && occ && (occ !== "custom" || custom.trim());
  return (
    <>
      <h2>Для кого песня? Выберите повод</h2>
      <div className="chips">
        {visible.map((o) => (
          <button key={o.id} className={"chip" + (occ === o.id ? " on" : "")} onClick={() => setOcc(o.id)}>
            {o.emoji} {o.title}
          </button>
        ))}
        {!showAll && <button className="chip" onClick={() => setShowAll(true)}>Ещё поводы ▾</button>}
        <button className={"chip" + (occ === "custom" ? " on" : "")} onClick={() => setOcc("custom")}>✍️ Свой вариант</button>
      </div>
      {occ === "custom" && (
        <input value={custom} maxLength={100} onChange={(e) => setCustom(e.target.value)} placeholder="Например: проводы коллеги в декрет" />
      )}
      <h2>Расскажите о герое</h2>
      <ul>
        <li>Как зовут героя или героиню?</li>
        <li>Чем запомнился? Какие фишки?</li>
        <li>Смешные истории, любимые фразы?</li>
        <li>Что передать треком — любовь, угар, благодарность?</li>
      </ul>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Пишите всё, что может вдохновить…" />
      <button disabled={busy || !ready} onClick={() => onSubmit(text, occ, custom)}>Написать текст</button>
    </>
  );
}

function Draft({ song, busy, onRevise, onConfirm }: {
  song: Song; busy: boolean; onRevise: (fb: string) => void; onConfirm: () => void;
}) {
  const [fb, setFb] = useState("");
  return (
    <>
      <h2>{song.title}</h2>
      <pre className="lyrics">{song.lyrics}</pre>
      <button disabled={busy} onClick={onConfirm}>🔥 Сделать хит!</button>
      <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Что изменить в тексте?" />
      <button disabled={busy || !fb.trim()} onClick={() => { onRevise(fb); setFb(""); }}>Изменить текст</button>
    </>
  );
}

function Songs({ onChange }: { onChange: () => void }) {
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => {
    const load = () => api.songs().then((s) => { setSongs(s); if (s.every((x) => x.status !== "generating")) onChange(); });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [onChange]);
  if (!songs.length) return <p>Пока нет песен.</p>;
  return (
    <>
      <h2>Мои песни</h2>
      {songs.map((s) => (
        <section key={s.id} className="card">
          <b>{s.title}</b>
          {s.status === "done" && s.audioUrl && <audio controls src={s.audioUrl} />}
          {s.status === "generating" && <p className="busy">⏳ Генерируется, 1–3 минуты…</p>}
          {s.status === "failed" && <p className="error">Не удалось, токены возвращены</p>}
        </section>
      ))}
    </>
  );
}
