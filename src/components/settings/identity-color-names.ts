import type { IdentityColor } from "@/server/db/schema/users";

// salinan urutan IDENTITY_COLORS untuk klien; modul skema menarik node:crypto lewat uuidv7
export const IDENTITY_COLOR_ORDER = ["violet", "rose", "gold", "ocean", "plum", "slate"] as const satisfies readonly IdentityColor[];

// nama warna ditulis supaya pilihan tidak hanya dibawa warna (DESIGN 10)
export const IDENTITY_COLOR_NAMES: Record<IdentityColor, string> = {
  violet: "Violet",
  rose: "Mawar",
  gold: "Emas",
  ocean: "Biru laut",
  plum: "Plum",
  slate: "Kelabu",
};
