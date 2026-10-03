import { useId } from "react";

const PALETTES = [
  ["#8b5cf6", "#ec4899"], ["#ec4899", "#f59e0b"], ["#6366f1", "#22d3ee"], ["#f43f5e", "#8b5cf6"],
  ["#14b8a6", "#6366f1"], ["#f59e0b", "#ef4444"], ["#a855f7", "#06b6d4"], ["#10b981", "#facc15"],
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Обложка трека: детерминированный градиент + винил по названию. */
export function Cover({ seed, size = 56 }: { seed: string; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const h = hash(seed);
  const [a, b] = PALETTES[h % PALETTES.length]!;
  const angle = h % 360;
  return (
    <svg className="cover" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={`g${uid}`} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <radialGradient id={`r${uid}`} cx="0.3" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#g${uid})`} />
      <circle cx={70 + (h % 20)} cy={78} r="44" fill="#0b0a12" opacity=".28" />
      {[38, 30, 22].map((r) => (
        <circle key={r} cx={70 + (h % 20)} cy={78} r={r} fill="none" stroke="#fff" strokeOpacity=".14" />
      ))}
      <circle cx={70 + (h % 20)} cy={78} r="9" fill="#fff" opacity=".85" />
      <rect width="100" height="100" fill={`url(#r${uid})`} />
    </svg>
  );
}

/** Вращающийся винил для главного экрана. */
export function Disc() {
  return (
    <svg className="disc" viewBox="0 0 200 200" aria-hidden>
      <defs>
        <linearGradient id="disc-label" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset=".55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="disc-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".1" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="#16131f" stroke="rgba(255,255,255,.08)" />
      {Array.from({ length: 11 }, (_, i) => 92 - i * 5).map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fff" strokeOpacity={r % 2 ? 0.05 : 0.08} />
      ))}
      <circle cx="100" cy="100" r="98" fill="url(#disc-sheen)" />
      <circle cx="100" cy="100" r="34" fill="url(#disc-label)" />
      <path d="M100 74 a26 26 0 0 1 26 26" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="100" r="5" fill="#0b0a12" />
    </svg>
  );
}

export function Equalizer({ bars = 9 }: { bars?: number }) {
  return (
    <div className="eq" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${800 + ((i * 211) % 600)}ms` }} />
      ))}
    </div>
  );
}

const LABELS: Record<string, string> = {
  verse: "Куплет", chorus: "Припев", bridge: "Бридж", intro: "Вступление", outro: "Финал",
  "pre-chorus": "Предприпев", prechorus: "Предприпев", hook: "Хук",
};

/** Текст песни с красивыми метками секций вместо [Verse]/[Chorus]. */
export function Lyrics({ text }: { text: string }) {
  const sections: { label: string; kind: string; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^\[(.+?)\]$/);
    if (m) {
      const [word = "", num = ""] = m[1]!.toLowerCase().split(/\s+/);
      sections.push({ label: `${LABELS[word] ?? m[1]}${num ? ` ${num}` : ""}`, kind: word, lines: [] });
    } else if (line && /[\p{L}\d]/u.test(line)) {
      if (!sections.length) sections.push({ label: "", kind: "", lines: [] });
      sections.at(-1)!.lines.push(line);
    }
  }
  return (
    <div>
      {sections.filter((s) => s.lines.length).map((s, i) => (
        <div key={i} className={`lyr-section ${s.kind}`}>
          {s.label && <span className="lyr-label">{s.label}</span>}
          {s.lines.map((l, j) => <p key={j} className="lyr-line">{l}</p>)}
        </div>
      ))}
    </div>
  );
}

export const fmtTime = (s: number) =>
  Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
