import {
  ArrowLeftRight,
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Car,
  Circle,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  CreditCard,
  Droplet,
  Dumbbell,
  FileText,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Scale,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  SquareParking,
  Store,
  Tag,
  TrendingUp,
  Undo2,
  Users,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

// peta statis supaya bundle tidak memuat seluruh set Lucide; nama tak dikenal jatuh ke Circle
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "arrow-left-right": ArrowLeftRight,
  baby: Baby,
  banknote: Banknote,
  bike: Bike,
  "book-open": BookOpen,
  briefcase: Briefcase,
  car: Car,
  circle: Circle,
  "circle-ellipsis": CircleEllipsis,
  clapperboard: Clapperboard,
  coffee: Coffee,
  "credit-card": CreditCard,
  droplet: Droplet,
  dumbbell: Dumbbell,
  "file-text": FileText,
  fuel: Fuel,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  house: House,
  "key-round": KeyRound,
  landmark: Landmark,
  music: Music,
  "paw-print": PawPrint,
  "piggy-bank": PiggyBank,
  pill: Pill,
  plane: Plane,
  receipt: Receipt,
  scale: Scale,
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  "shopping-basket": ShoppingBasket,
  smartphone: Smartphone,
  sparkles: Sparkles,
  "square-parking": SquareParking,
  store: Store,
  tag: Tag,
  "trending-up": TrendingUp,
  "undo-2": Undo2,
  users: Users,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
  wallet: Wallet,
  wifi: Wifi,
  zap: Zap,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Circle;
}

/** Ikon kategori dalam lingkaran surface-sunken; `size` 32 untuk baris transaksi (DESIGN 8). */
export function CategoryIconCircle({
  icon,
  className,
  children,
}: {
  icon: string | null | undefined;
  className?: string;
  /** Titik identitas di sudut kanan bawah. */
  children?: React.ReactNode;
}) {
  return (
    <span className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-secondary", className)}>
      <Icon icon={categoryIcon(icon)} size={16} />
      {children ? <span className="absolute -bottom-0.5 -right-0.5 inline-flex">{children}</span> : null}
    </span>
  );
}
