import {
  ArrowLeftRight, Banknote, Bus, Coins, CreditCard, Gamepad2, HandCoins, Landmark, Laptop, Plane, Plus, PiggyBank, Repeat,
  Rocket, Send, Shield, ShoppingBag, Sliders, Smartphone, Tag, Ticket, Umbrella, Utensils, Wallet, Home, Gift, Car, Heart,
  Music, Briefcase, GraduationCap, Dumbbell, Camera, Star, type LucideIcon,
} from 'lucide-react';

/** Icônes sérialisables : les entités stockent une clé texte, jamais un composant. */
export const ICONS: Record<string, LucideIcon> = {
  'arrow-left-right': ArrowLeftRight,
  banknote: Banknote,
  bus: Bus,
  coins: Coins,
  'credit-card': CreditCard,
  gamepad: Gamepad2,
  'hand-coins': HandCoins,
  landmark: Landmark,
  laptop: Laptop,
  plane: Plane,
  plus: Plus,
  'piggy-bank': PiggyBank,
  repeat: Repeat,
  rocket: Rocket,
  send: Send,
  shield: Shield,
  'shopping-bag': ShoppingBag,
  sliders: Sliders,
  smartphone: Smartphone,
  tag: Tag,
  ticket: Ticket,
  umbrella: Umbrella,
  utensils: Utensils,
  wallet: Wallet,
  home: Home,
  gift: Gift,
  car: Car,
  heart: Heart,
  music: Music,
  briefcase: Briefcase,
  graduation: GraduationCap,
  dumbbell: Dumbbell,
  camera: Camera,
  star: Star,
};

export const PICKABLE_ICONS = ['wallet', 'piggy-bank', 'rocket', 'laptop', 'plane', 'home', 'car', 'gift', 'heart', 'shield', 'music', 'briefcase', 'graduation', 'dumbbell', 'camera', 'star', 'gamepad', 'shopping-bag'];

export function Icon({ name, className, size = 18 }: { name: string; className?: string; size?: number }) {
  const Cmp = ICONS[name] ?? Tag;
  return <Cmp className={className} size={size} aria-hidden />;
}

export const PALETTE = ['#7656F6', '#4930B5', '#B9A7FF', '#4285F4', '#26B879', '#F3A642', '#E44F62', '#101014', '#0EA5B7', '#D946A8'];
