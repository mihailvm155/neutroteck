export interface Occasion {
  id: string;
  emoji: string;
  title: string;
}

/** Поводы для песни. Порядок = порядок в меню; первые — самые популярные. */
export const OCCASIONS: Occasion[] = [
  { id: "birthday", emoji: "🎂", title: "День рождения" },
  { id: "jubilee", emoji: "🎉", title: "Юбилей" },
  { id: "wedding", emoji: "💍", title: "Свадьба" },
  { id: "anniversary", emoji: "🥂", title: "Годовщина" },
  { id: "love", emoji: "💘", title: "Признание в любви" },
  { id: "sorry", emoji: "🙇", title: "Попросить прощения" },
  { id: "support", emoji: "🤗", title: "Поддержка" },
  { id: "motivation", emoji: "🔥", title: "Мотивация" },
  { id: "friend", emoji: "🤝", title: "Для друга" },
  { id: "colleagues", emoji: "🏢", title: "Коллегам" },
  { id: "prank", emoji: "😂", title: "Розыгрыш" },
  { id: "newborn", emoji: "👶", title: "Рождение ребёнка" },
  { id: "graduation", emoji: "🎓", title: "Выпускной" },
  { id: "mom", emoji: "👩", title: "Для мамы" },
  { id: "dad", emoji: "👨", title: "Для папы" },
  { id: "grandparents", emoji: "👵", title: "Бабушке или дедушке" },
  { id: "son", emoji: "👦", title: "Для сына" },
  { id: "daughter", emoji: "👧", title: "Для дочки" },
  { id: "husband", emoji: "🤵", title: "Для любимого" },
  { id: "wife", emoji: "👰", title: "Для любимой" },
  { id: "sister", emoji: "👭", title: "Сестре" },
  { id: "brother", emoji: "👬", title: "Брату" },
  { id: "engagement", emoji: "💎", title: "Предложение руки и сердца" },
  { id: "gold_wedding", emoji: "🏅", title: "Золотая свадьба" },
  { id: "march8", emoji: "🌷", title: "8 Марта" },
  { id: "feb23", emoji: "🎖️", title: "23 Февраля" },
  { id: "newyear", emoji: "🎄", title: "Новый год" },
  { id: "valentine", emoji: "💝", title: "День влюблённых" },
  { id: "housewarming", emoji: "🏠", title: "Новоселье" },
  { id: "army_send", emoji: "🪖", title: "Проводы в армию" },
  { id: "army_back", emoji: "🛬", title: "Встреча из армии" },
  { id: "retirement", emoji: "🌴", title: "Выход на пенсию" },
  { id: "school_bell", emoji: "🔔", title: "Последний звонок" },
  { id: "university", emoji: "📚", title: "Поступление в вуз" },
  { id: "new_job", emoji: "💼", title: "Новая работа" },
  { id: "baptism", emoji: "🕊️", title: "Крестины" },
  { id: "thanks", emoji: "🙏", title: "Благодарность" },
  { id: "miss", emoji: "💌", title: "Скучаю" },
  { id: "toast", emoji: "🥳", title: "Тост для застолья" },
  { id: "teacher", emoji: "🍎", title: "Учителю или наставнику" },
  { id: "pet", emoji: "🐾", title: "Для питомца" },
  { id: "team", emoji: "🏆", title: "Гимн команды" },
  { id: "company", emoji: "🏛️", title: "Гимн компании" },
  { id: "self", emoji: "✨", title: "Для себя" },
  { id: "none", emoji: "🎵", title: "Без повода" },
];

export const CUSTOM_OCCASION_ID = "custom";

export const occasionTitle = (id: string) => OCCASIONS.find((o) => o.id === id)?.title;
