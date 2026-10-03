// Демо-режим (?demo=1): тот же интерфейс на тестовых данных, без сервера.
import { OCCASIONS } from "../../server/src/occasions";
import type { Me, Song } from "./api";

const TITLES = ["Лучшая на свете", "Наш общий припев", "Тёплые слова", "Розовый бочок"];

const LYRICS = `[Verse]
Я нашёл его в коробке под своим окном,
То ли тапок с ушами, то ли странный гном.
Он не ест сосиски, не пьёт молоко,
Зато грызёт обои очень уж легко.

[Chorus]
Оилиоп, Оилиоп, розовый бочок,
Вместо носа — кнопка, вместо глаз — крючок.
Оилиоп, Оилиоп, скачет по столу,
Снова сгрыз кроссовки в дальнем углу!`;

const me: Me = {
  id: 1,
  balance: 1000,
  songCost: 439,
  subscribed: true,
  channels: [],
  occasions: OCCASIONS,
  packs: [
    { id: "p439", tokens: 439, priceRub: 439 },
    { id: "p589", tokens: 589, priceRub: 589 },
    { id: "p1317", tokens: 1317, priceRub: 1099 },
    { id: "p4390", tokens: 4390, priceRub: 3190 },
  ],
};

const songs: Song[] = [
  { id: 1, title: "Оилиоп", lyrics: LYRICS, style: "pop", occasion: "Для питомца", status: "done", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
];
let nextId = 2;
const delay = <T,>(v: T, ms = 600) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const demoApi = {
  me: () => delay({ ...me }, 100),
  songs: () => delay([...songs].reverse(), 100),
  song: (id: number) => delay(songs.find((s) => s.id === id)!, 100),
  create: (_story: string, occasionId: string, custom: string) => {
    const occasion = occasionId === "custom" ? custom : (OCCASIONS.find((o) => o.id === occasionId)?.title ?? "");
    const s: Song = { id: nextId, title: TITLES[nextId++ % TITLES.length]!, lyrics: LYRICS, style: "pop", occasion, status: "draft", audioUrl: null };
    songs.push(s);
    return delay({ ...s }, 1200);
  },
  revise: (id: number, feedback: string) => {
    const s = songs.find((x) => x.id === id)!;
    s.lyrics = `${LYRICS}\n\n[Outro]\n(правка: ${feedback})`;
    return delay({ ...s }, 1000);
  },
  confirm: (id: number) => {
    const s = songs.find((x) => x.id === id)!;
    me.balance -= me.songCost;
    s.status = "generating";
    setTimeout(() => {
      s.status = "done";
      s.audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3";
    }, 5000);
    return delay({ ...s }, 300);
  },
  pay: async (packId: string) => {
    me.balance += me.packs.find((p) => p.id === packId)!.tokens;
    return { url: "about:blank#demo-paid" };
  },
};
