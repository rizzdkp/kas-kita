import type { Viewer } from "@/server/auth/viewer";
import type { PlanningPeople } from "./owner";

/** Dipanggil di server component; hanya nama, warna, dan id yang dikirim ke klien. */
export function planningPeople(viewer: Viewer): PlanningPeople {
  return {
    me: { id: viewer.user.id, name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner
      ? { id: viewer.partner.id, name: viewer.partner.displayName, color: viewer.partner.identityColor }
      : null,
  };
}
