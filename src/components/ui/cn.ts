import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// ukuran teks dan radius dari token harus dikenali, kalau tidak text-hero dianggap warna dan bentrok dengan text-primary
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["hero", "hero-sm", "large", "title", "section", "card", "body", "small", "control", "caption"],
      radius: ["xs", "sm", "md", "card", "glass-bar", "pill"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
