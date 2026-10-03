import {
  Apple, Armchair, Backpack, Baby, Bell, Bird, BookOpen, Briefcase, Building2, Cake, CalendarHeart, Church, Crown,
  Flame, Flower, Flower2, Gem, Gift, Glasses, GraduationCap, Handshake, HandHeart, Heart, HeartHandshake, HeartPulse,
  House, Landmark, Laugh, Mail, Medal, Moon, Music, Palmtree, PartyPopper, PawPrint, PenLine, Plane, Rocket, Shield,
  Sparkles, TreePine, Trophy, Users, UsersRound, Wine, type LucideIcon,
} from "lucide-react";

/** Иконка для каждого повода (id из server/src/occasions.ts). Новый повод без иконки получит ноту. */
const ICONS: Record<string, LucideIcon> = {
  birthday: Cake, jubilee: PartyPopper, wedding: Church, anniversary: CalendarHeart, love: Heart, sorry: HandHeart,
  support: HeartHandshake, motivation: Flame, friend: Handshake, colleagues: Building2, prank: Laugh, newborn: Baby,
  graduation: GraduationCap, mom: Flower, dad: Glasses, grandparents: Armchair, son: Rocket, daughter: Crown,
  husband: HeartPulse, wife: Flower2, sister: UsersRound, brother: Users, engagement: Gem, gold_wedding: Medal,
  march8: Flower2, feb23: Shield, newyear: TreePine, valentine: Mail, housewarming: House, army_send: Backpack,
  army_back: Plane, retirement: Palmtree, school_bell: Bell, university: BookOpen, new_job: Briefcase, baptism: Bird,
  thanks: Gift, miss: Moon, toast: Wine, teacher: Apple, pet: PawPrint, team: Trophy, company: Landmark,
  self: Sparkles, none: Music, custom: PenLine,
};

export const occasionIcon = (id: string): LucideIcon => ICONS[id] ?? Music;

/** Вкладки выбора повода. Повод может быть в нескольких вкладках. */
export const GROUPS: { id: string; title: string; ids: string[] | "top" }[] = [
  { id: "top", title: "Популярное", ids: "top" },
  { id: "family", title: "Близким", ids: ["mom", "dad", "husband", "wife", "son", "daughter", "grandparents", "sister", "brother", "friend", "teacher", "pet", "self"] },
  { id: "holidays", title: "Праздники", ids: ["birthday", "jubilee", "newyear", "march8", "feb23", "valentine", "wedding", "anniversary", "gold_wedding", "engagement"] },
  { id: "events", title: "События", ids: ["newborn", "graduation", "school_bell", "university", "new_job", "retirement", "housewarming", "army_send", "army_back", "baptism"] },
  { id: "feelings", title: "Чувства", ids: ["love", "sorry", "support", "motivation", "thanks", "miss", "prank", "toast"] },
  { id: "work", title: "Работа", ids: ["colleagues", "team", "company", "new_job", "retirement", "teacher"] },
  { id: "all", title: "Все", ids: "top" },
];
