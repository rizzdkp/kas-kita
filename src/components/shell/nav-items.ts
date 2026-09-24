import {
  ArrowRightLeft,
  CalendarClock,
  ChartColumnBig,
  Gauge,
  House,
  PiggyBank,
  Settings,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// delapan item UX-FLOWS 1; ikon dipilih dari isi halaman, bukan dekorasi
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Ringkasan", icon: House },
  { href: "/transaksi", label: "Transaksi", icon: ArrowRightLeft },
  { href: "/akun", label: "Akun", icon: Wallet },
  { href: "/anggaran", label: "Anggaran", icon: Gauge },
  { href: "/tagihan", label: "Tagihan", icon: CalendarClock },
  { href: "/target", label: "Target", icon: PiggyBank },
  { href: "/investasi", label: "Investasi", icon: TrendingUp },
  { href: "/laporan", label: "Laporan", icon: ChartColumnBig },
];

export const SETTINGS_ITEM: NavItem = { href: "/pengaturan", label: "Pengaturan", icon: Settings };

// tab bar kecil: Ringkasan, Transaksi, (tambah), Anggaran, Lainnya
export const TAB_HREFS = ["/", "/transaksi", "/anggaran"] as const;

export const MORE_ITEMS: readonly NavItem[] = [
  ...NAV_ITEMS.filter((item) => !(TAB_HREFS as readonly string[]).includes(item.href)),
  SETTINGS_ITEM,
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleForPath(pathname: string): string {
  const all = [...NAV_ITEMS, SETTINGS_ITEM];
  return all.find((item) => isActivePath(pathname, item.href))?.label ?? "Kas Kita";
}
