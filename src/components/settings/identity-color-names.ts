import type { IdentityColor } from "@/server/db/schema/users";

// nama warna ditulis supaya pilihan tidak hanya dibawa warna (DESIGN 10)
export const IDENTITY_COLOR_NAMES: Record<IdentityColor, string> = {
  violet: "Violet",
  rose: "Mawar",
  gold: "Emas",
  ocean: "Biru laut",
  plum: "Plum",
  slate: "Kelabu",
};
