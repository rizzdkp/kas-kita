import { Asset3D } from "@/components/assets/asset-3d";
import { cn } from "@/components/ui/cn";
import type { IllustrationProps } from "./spot";

/** Komposisi halaman masuk: rumah berdua dengan kantong uang, kartu, dan koin di depannya. */
export function HouseholdHero({ className, label, decorative }: IllustrationProps) {
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? "Rumah dengan kantong uang, kartu, dan koin" })}
      data-illustration="household"
      className={cn("relative block aspect-[4/3] w-full max-w-full shrink-0", className)}
    >
      {/* rumah di tengah belakang; benda uang di depan supaya terbaca sebagai uang rumah tangga */}
      <Asset3D name="house-with-garden" size={256} sizes="(min-width: 1024px) 256px, (min-width: 600px) 160px, 96px" eager className="absolute left-1/2 top-0 h-[78%] w-auto -translate-x-1/2" />
      <Asset3D name="money-bag" size={128} sizes="(min-width: 1024px) 128px, 72px" eager className="absolute bottom-[2%] left-[10%] h-[42%] w-auto" />
      <Asset3D name="credit-card" size={128} sizes="(min-width: 1024px) 128px, 72px" eager className="absolute bottom-[12%] right-[8%] h-[30%] w-auto" />
      <Asset3D name="coin" size={64} sizes="(min-width: 1024px) 64px, 40px" eager className="absolute bottom-[2%] right-[30%] h-1/5 w-auto" />
    </span>
  );
}
