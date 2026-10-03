import {
  ArrowLeft, Check, ChevronRight, Coins, CreditCard, Download, ExternalLink, Headphones, Lock, Music2, Pause,
  Pencil, Play, Plus, RefreshCw, Sparkles, WandSparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, isDemo, webApp, type Me, type Occasion, type Song } from "./api";
import { GROUPS, occasionIcon } from "./occasions";
import { Cover, Disc, Equalizer, Lyrics, fmtTime, plural } from "./ui";

type Screen = "home" | "occasion" | "story" | "draft" | "making" | "song" | "songs" | "topup";
const BACK: Partial<Record<Screen, Screen>> = {
  occasion: "home", story: "occasion", draft: "story", songs: "home", song: "songs", topup: "home", making: "home",
};
const CUSTOM = "custom";

/** Всегда свежая ссылка на колбэк, не перезапуская эффекты при каждом рендере. */
function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}

/** Лёгкая вибрация в MAX; вне MAX мост отклоняет вызов — глушим. */
const haptic = () => {
  try {
    void Promise.resolve(window.WebApp?.HapticFeedback?.impactOccurred?.("light")).catch(() => {});
  } catch {
    /* нет моста */
  }
};

// ---------------------------------------------------------------- плеер

function usePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  const el = () => {
    if (!audio.current) {
      const a = new Audio();
      a.addEventListener("timeupdate", () => setTime(a.currentTime));
      a.addEventListener("loadedmetadata", () => setDur(a.duration));
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("ended", () => setPlaying(false));
      audio.current = a;
    }
    return audio.current;
  };

  const toggle = (s: Song) => {
    if (!s.audioUrl) return;
    const a = el();
    if (current?.id === s.id) return void (a.paused ? a.play() : a.pause());
    a.src = s.audioUrl;
    setCurrent(s);
    setTime(0);
    setDur(0);
    void a.play();
  };
  const seek = (ratio: number) => {
    const a = el();
    if (Number.isFinite(a.duration)) a.currentTime = ratio * a.duration;
  };
  useEffect(() => () => audio.current?.pause(), []);
  return { current, playing, time, dur, toggle, seek };
}
type Player = ReturnType<typeof usePlayer>;

// ---------------------------------------------------------------- приложение

export function App() {
  const [me, setMe] = useState<Me>();
  const [screen, setScreen] = useState<Screen>("home");
  const [occ, setOcc] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [story, setStory] = useState("");
  const [draft, setDraft] = useState<Song>();
  const [songId, setSongId] = useState<number>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const player = usePlayer();

  const refresh = useCallback(async () => {
    const [m, s] = await Promise.all([api.me(), api.songs()]);
    setMe(m);
    setSongs(s);
  }, []);

  useEffect(() => {
    webApp?.ready();
    refresh().catch((e) => setToast((e as Error).message));
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (s: Screen) => {
    haptic();
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "no_balance") {
        setToast("Недостаточно токенов — пополните баланс");
        go("topup");
      } else setToast(err.message || "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  };

  const occasion = useMemo(() => me?.occasions.find((o) => o.id === occ), [me, occ]);
  const occasionTitle = occ === CUSTOM ? custom.trim() : occasion?.title ?? "";

  if (!me)
    return (
      <div className="loader">
        {toast ? <p className="lead">{toast}</p> : <div className="spinner" />}
      </div>
    );

  if (!me.subscribed) return <Gate channels={me.channels} onCheck={() => run(refresh)} busy={busy} />;

  const back = BACK[screen];

  return (
    <div className="app">
      {toast && (
        <div className="toast" role="alert">
          <X size={18} /> {toast}
        </div>
      )}

      <div className="topbar">
        {back ? (
          <button className="icon-btn" aria-label="Назад" onClick={() => go(back)}>
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span className="eyebrow">Песня в подарок</span>
        )}
        <button className="balance" onClick={() => go("topup")}>
          <span className="coin"><Coins size={15} /></span>
          {me.balance.toLocaleString("ru-RU")} <small>токенов</small>
          <Plus size={16} className="plus" />
        </button>
      </div>

      {screen === "home" && <Home me={me} songs={songs} go={go} />}

      {screen === "occasion" && (
        <OccasionStep
          occasions={me.occasions} value={occ} custom={custom} onCustom={setCustom}
          onPick={(id) => { haptic(); setOcc(id); }}
        />
      )}

      {screen === "story" && (
        <StoryStep occasion={occasion} occasionTitle={occasionTitle} occId={occ} value={story} onChange={setStory} />
      )}

      {screen === "draft" && draft && (
        <DraftStep
          song={draft} occId={occ} occasionTitle={occasionTitle} busy={busy}
          onRevise={(fb) => run(async () => setDraft(await api.revise(draft.id, fb)))}
        />
      )}

      {screen === "making" && songId && (
        <Making songId={songId} onDone={async () => { await refresh(); go("song"); }} />
      )}

      {screen === "song" && songId && <SongScreen song={songs.find((s) => s.id === songId)} player={player} />}

      {screen === "songs" && (
        <Songs songs={songs} player={player} onOpen={(id) => { setSongId(id); go("song"); }} onRefresh={() => run(refresh)} />
      )}

      {screen === "topup" && (
        <Topup me={me} busy={busy} onBuy={(packId) => run(async () => {
          const { url } = await api.pay(packId);
          if (isDemo) return void (await refresh());
          if (webApp) webApp.openLink(url);
          else window.open(url, "_blank");
        })} onRefresh={() => run(refresh)} />
      )}

      {/* ---------- нижняя панель действий ---------- */}
      {screen === "home" && (
        <ActionBar>
          <button className="btn btn-primary" onClick={() => go("occasion")}>
            <WandSparkles size={20} /> Создать песню
          </button>
        </ActionBar>
      )}
      {screen === "occasion" && (
        <ActionBar>
          <button className="btn btn-primary" disabled={!occasionTitle} onClick={() => go("story")}>
            Дальше <ChevronRight size={20} />
          </button>
        </ActionBar>
      )}
      {screen === "story" && (
        <ActionBar>
          <button className="btn btn-primary" disabled={busy || story.trim().length < 10}
            onClick={() => run(async () => { setDraft(await api.create(story, occ, custom)); go("draft"); })}>
            {busy ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Пишем текст…</>
              : <><Sparkles size={20} /> Написать текст</>}
          </button>
        </ActionBar>
      )}
      {screen === "draft" && draft && (
        <ActionBar>
          <button className="btn btn-primary" disabled={busy}
            onClick={() => run(async () => {
              await api.confirm(draft.id);
              setSongId(draft.id);
              setStory("");
              setOcc("");
              await refresh();
              go("making");
            })}>
            <Music2 size={20} /> Сделать хит · {me.songCost} токенов
          </button>
        </ActionBar>
      )}
    </div>
  );
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="action-bar"><div className="action-bar-inner">{children}</div></div>;
}

function Progress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="progress" aria-label={`Шаг ${step} из 3`}>
      {[1, 2, 3].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}
    </div>
  );
}

// ---------------------------------------------------------------- экраны

function Home({ me, songs, go }: { me: Me; songs: Song[]; go: (s: Screen) => void }) {
  const ready = songs.filter((s) => s.status === "done").length;
  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-art"><Disc /></div>
        <h1>Песня, которую <span className="grad-text">запомнят</span></h1>
        <p className="lead">Расскажите о человеке — мы напишем текст и превратим его в настоящий трек с вокалом.</p>
      </div>

      <div className="section-title" />
      <div className="tiles">
        <button className="tile" onClick={() => go("songs")}>
          <span className="tile-icon"><Headphones size={20} /></span>
          <div><b>Мои песни</b><span>{ready ? `${ready} ${plural(ready, "трек", "трека", "треков")}` : "Пока пусто"}</span></div>
        </button>
        <button className="tile" onClick={() => go("topup")}>
          <span className="tile-icon"><CreditCard size={20} /></span>
          <div><b>Пополнить</b><span>от {Math.min(...me.packs.map((p) => p.priceRub))} ₽</span></div>
        </button>
      </div>

      <div className="section-title"><h3>Как это работает</h3><span className="eyebrow">3 шага</span></div>
      <div className="steps">
        {[
          ["Выберите повод", "День рождения, свадьба или просто так"],
          ["Расскажите историю", "Имя, привычки, смешные случаи"],
          ["Получите трек", "Готовая песня за 2–3 минуты"],
        ].map(([t, d], i) => (
          <div className="step-row" key={t}>
            <span className="step-num">{i + 1}</span>
            <div><b>{t}</b><span>{d}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OccasionStep({ occasions, value, custom, onPick, onCustom }: {
  occasions: Occasion[]; value: string; custom: string; onPick: (id: string) => void; onCustom: (s: string) => void;
}) {
  const [tab, setTab] = useState("top");
  const group = GROUPS.find((g) => g.id === tab)!;
  const list = group.ids === "top"
    ? (tab === "all" ? occasions : occasions.slice(0, 11))
    : group.ids.map((id) => occasions.find((o) => o.id === id)).filter((o): o is Occasion => !!o);
  const items = [...list, { id: CUSTOM, title: "Свой вариант", emoji: "" }];

  return (
    <div className="screen">
      <Progress step={1} />
      <span className="eyebrow">Шаг 1 из 3</span>
      <h2 style={{ marginTop: 6 }}>Для кого песня?</h2>
      <p className="lead">Выберите повод — от него зависит настроение трека.</p>

      <div className="tabs" role="tablist">
        {GROUPS.map((g) => (
          <button key={g.id} role="tab" aria-selected={tab === g.id} className={`tab${tab === g.id ? " on" : ""}`} onClick={() => setTab(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      <div className="occ-grid">
        {items.map((o) => {
          const Icon = occasionIcon(o.id);
          return (
            <button key={o.id} className={`occ${value === o.id ? " on" : ""}`} onClick={() => onPick(o.id)} aria-pressed={value === o.id}>
              <span className="ico"><Icon size={19} strokeWidth={2} /></span>
              <span>{o.title}</span>
              <span className="check"><Check size={13} strokeWidth={3} /></span>
            </button>
          );
        })}
      </div>

      {value === CUSTOM && (
        <input
          className="field" style={{ marginTop: 12 }} autoFocus maxLength={100} value={custom}
          onChange={(e) => onCustom(e.target.value)} placeholder="Например: проводы коллеги в декрет"
        />
      )}
    </div>
  );
}

const HINTS = ["Имя героя: ", "Чем запомнился: ", "Любимая фраза: ", "Смешная история: ", "Что хочу сказать: "];

function StoryStep({ occId, occasionTitle, value, onChange }: {
  occasion?: Occasion; occId: string; occasionTitle: string; value: string; onChange: (s: string) => void;
}) {
  const Icon = occasionIcon(occId);
  const ref = useRef<HTMLTextAreaElement>(null);
  const add = (h: string) => {
    onChange((value.trim() ? `${value.trimEnd()}\n` : "") + h);
    requestAnimationFrame(() => ref.current?.focus());
  };
  return (
    <div className="screen">
      <Progress step={2} />
      <span className="eyebrow">Шаг 2 из 3</span>
      <h2 style={{ marginTop: 6 }}>Сделаем песню личной</h2>
      <span className="selected-occ"><span className="ico"><Icon size={14} /></span>{occasionTitle}</span>
      <p className="lead">Чем больше деталей — тем точнее попадём. Имена, привычки, шутки, которые понятны только вам.</p>

      <div className="hints">
        {HINTS.map((h) => (
          <button key={h} className="hint" onClick={() => add(h)}><Plus size={14} />{h.replace(": ", "")}</button>
        ))}
      </div>

      <div className="field-wrap">
        <textarea
          ref={ref} className="field" rows={9} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={"Например: Маше 30 лет, она обожает кофе и своего кота Пирожка, каждое утро опаздывает, но всегда с улыбкой…"}
        />
        <span className="counter">{value.length}/2000</span>
      </div>
    </div>
  );
}

const QUICK_EDITS = ["Сделай короче", "Добавь юмора", "Более трогательно", "Имя — в припев", "Проще слова"];

function DraftStep({ song, occId, occasionTitle, busy, onRevise }: {
  song: Song; occId: string; occasionTitle: string; busy: boolean; onRevise: (fb: string) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [fb, setFb] = useState("");
  const Icon = occasionIcon(occId);
  const submit = (text: string) => {
    if (!text.trim()) return;
    setSheet(false);
    setFb("");
    onRevise(text);
  };
  return (
    <div className="screen">
      <Progress step={3} />
      <span className="eyebrow">Шаг 3 из 3</span>
      <h2 style={{ marginTop: 6 }}>Текст готов</h2>
      <p className="lead">Прочитайте и поправьте, если нужно — это бесплатно.</p>

      <div className="lyrics-card" style={{ opacity: busy ? 0.5 : 1, transition: "opacity .3s" }}>
        <div className="lyrics-head">
          <Cover seed={song.title + song.id} size={60} />
          <div className="meta">
            <h3>{song.title}</h3>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={13} />{occasionTitle || song.occasion}</span>
          </div>
        </div>
        <Lyrics text={song.lyrics} />
      </div>

      <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={busy} onClick={() => setSheet(true)}>
        {busy ? <><RefreshCw size={18} className="spin" /> Переписываем…</> : <><Pencil size={18} /> Изменить текст</>}
      </button>

      {sheet && (
        <div className="sheet" onClick={() => setSheet(false)}>
          <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <h3>Что поменять?</h3>
            <div className="hints" style={{ margin: 0 }}>
              {QUICK_EDITS.map((q) => <button key={q} className="hint" onClick={() => submit(q)}>{q}</button>)}
            </div>
            <textarea className="field" rows={3} autoFocus value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Или опишите своими словами" />
            <button className="btn btn-primary" disabled={!fb.trim()} onClick={() => submit(fb)}>
              <RefreshCw size={18} /> Переписать
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MAKING_STEPS = ["Текст утверждён", "Сочиняем мелодию", "Записываем вокал", "Сводим трек"];

function Making({ songId, onDone }: { songId: number; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const done = useLatest(onDone);
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    const poll = setInterval(async () => {
      const s = await api.song(songId).catch(() => null);
      if (s?.status === "done") { clearInterval(poll); done.current(); }
      if (s?.status === "failed") setFailed(true);
    }, 3000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [songId, done]);

  const active = Math.min(1 + Math.floor(elapsed / 25), MAKING_STEPS.length - 1);
  if (failed)
    return (
      <div className="screen making">
        <div className="empty"><div className="ico"><X size={28} /></div>
          <h2>Не получилось</h2>
          <p className="lead">Генерация не удалась, токены уже вернулись на баланс. Попробуйте ещё раз.</p>
        </div>
      </div>
    );
  return (
    <div className="screen making">
      <Equalizer />
      <h2>Песня в работе</h2>
      <p className="lead">Обычно это занимает 2–3 минуты. Можно закрыть приложение — пришлём трек в чат.</p>
      <div className="making-steps">
        {MAKING_STEPS.map((t, i) => (
          <div key={t} className={`mstep${i < active ? " done" : i === active ? " active" : ""}`}>
            <span className="dot">{i < active && <Check size={14} strokeWidth={3} />}</span>{t}
          </div>
        ))}
      </div>
    </div>
  );
}

function SongScreen({ song, player }: { song?: Song; player: Player }) {
  if (!song) return null;
  const isCur = player.current?.id === song.id;
  const ratio = isCur && player.dur ? player.time / player.dur : 0;
  return (
    <div className="screen">
      <div className="player-card">
        <Cover seed={song.title + song.id} size={220} />
        <h2>{song.title}</h2>
        <p className="lead" style={{ marginTop: 6 }}>{song.occasion || "Ваш трек"}</p>
        <div className="seek" onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          if (isCur) player.seek((e.clientX - r.left) / r.width);
        }}>
          <i style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="times"><span>{fmtTime(isCur ? player.time : 0)}</span><span>{fmtTime(isCur ? player.dur : NaN)}</span></div>
        <div className="player-ctrls">
          <a className="icon-btn" href={song.audioUrl ?? "#"} download target="_blank" rel="noreferrer" aria-label="Скачать"><Download size={20} /></a>
          <button className="play big" aria-label={isCur && player.playing ? "Пауза" : "Играть"} onClick={() => player.toggle(song)}>
            {isCur && player.playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />}
          </button>
          <a className="icon-btn" href={song.audioUrl ?? "#"} target="_blank" rel="noreferrer" aria-label="Открыть"><ExternalLink size={20} /></a>
        </div>
      </div>
      <div className="lyrics-card"><Lyrics text={song.lyrics} /></div>
    </div>
  );
}

function Songs({ songs, player, onOpen, onRefresh }: {
  songs: Song[]; player: Player; onOpen: (id: number) => void; onRefresh: () => void;
}) {
  const generating = songs.some((s) => s.status === "generating");
  const refresh = useLatest(onRefresh);
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => refresh.current(), 5000);
    return () => clearInterval(t);
  }, [generating, refresh]);

  return (
    <div className="screen">
      <h2>Мои песни</h2>
      <p className="lead">{songs.length ? `${songs.length} ${plural(songs.length, "трек", "трека", "треков")}` : "Здесь появятся ваши треки"}</p>
      {!songs.length ? (
        <div className="empty"><div className="ico"><Music2 size={28} /></div>Создайте первую песню — это займёт пару минут.</div>
      ) : (
        <div style={{ marginTop: 18 }}>
          {songs.map((s) => {
            const isCur = player.current?.id === s.id && player.playing;
            return (
              <div key={s.id} className={`song${isCur ? " playing" : ""}`}>
                <button onClick={() => s.status === "done" && onOpen(s.id)} style={{ display: "contents" }}>
                  <Cover seed={s.title + s.id} size={52} />
                  <div className="info">
                    <b>{s.title || "Песня"}</b>
                    {s.status === "done" && <span>{s.occasion || "Готово"}</span>}
                    {s.status === "generating" && <span className="badge wait"><RefreshCw size={12} /> Генерируется…</span>}
                    {s.status === "failed" && <span className="badge fail"><X size={12} /> Ошибка, токены возвращены</span>}
                  </div>
                </button>
                {s.status === "done" && (
                  <button className="play" aria-label={isCur ? "Пауза" : "Играть"} onClick={() => player.toggle(s)}>
                    {isCur ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Topup({ me, busy, onBuy, onRefresh }: { me: Me; busy: boolean; onBuy: (id: string) => void; onRefresh: () => void }) {
  const bestDiscount = Math.max(...me.packs.map((p) => 1 - p.priceRub / p.tokens));
  return (
    <div className="screen">
      <h2>Пополнить баланс</h2>
      <p className="lead">Одна песня — {me.songCost} токенов. Чем больше пакет, тем выгоднее.</p>
      <div className="packs">
        {me.packs.map((p) => {
          const discount = 1 - p.priceRub / p.tokens;
          const songsN = Math.floor(p.tokens / me.songCost);
          const best = discount > 0 && discount === bestDiscount;
          return (
            <button key={p.id} className={`pack${best ? " best" : ""}`} disabled={busy} onClick={() => onBuy(p.id)}>
              {best && <span className="ribbon">Выгодно −{Math.round(discount * 100)}%</span>}
              {!best && discount > 0 && <span className="ribbon" style={{ background: "var(--surface-2)" }}>−{Math.round(discount * 100)}%</span>}
              <div>
                <div className="tok">{p.tokens.toLocaleString("ru-RU")}</div>
                <div className="sub">{songsN} {plural(songsN, "песня", "песни", "песен")}</div>
              </div>
              <div className="price">
                <b>{p.priceRub.toLocaleString("ru-RU")} ₽</b>
                {discount > 0 && <s>{p.tokens.toLocaleString("ru-RU")} ₽</s>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="secure"><Lock size={14} /> Оплата через Робокассу · карты и СБП</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} onClick={onRefresh}>
        <RefreshCw size={16} /> Я оплатил — обновить баланс
      </button>
    </div>
  );
}

function Gate({ channels, onCheck, busy }: { channels: string[]; onCheck: () => void; busy: boolean }) {
  return (
    <div className="app">
      <div className="screen gate">
        <div className="ico"><Sparkles size={34} /></div>
        <h2>Почти готово</h2>
        <p className="lead">Подпишитесь на наши каналы — так мы можем делать больше песен.</p>
        <div style={{ marginTop: 26, textAlign: "left" }}>
          {channels.map((url, i) => (
            <a key={url} className="channel" href={url} target="_blank" rel="noreferrer" onClick={(e) => {
              if (webApp) { e.preventDefault(); webApp.openLink(url); }
            }}>
              <span className="n">{i + 1}</span> Подписаться на канал <ExternalLink size={18} />
            </a>
          ))}
        </div>
      </div>
      <ActionBar>
        <button className="btn btn-primary" disabled={busy} onClick={onCheck}><Check size={20} /> Проверить подписку</button>
      </ActionBar>
    </div>
  );
}
