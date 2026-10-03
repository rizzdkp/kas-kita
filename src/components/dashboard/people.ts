import type { IdentityColor } from "@/components/identity/identity-colors";
import { identityColorVar } from "@/components/identity/identity-colors";

export interface Person {
  id: string;
  name: string;
  color: IdentityColor;
}

export interface People {
  me: Person;
  partner: Person | null;
}

export interface OwnerStyle {
  key: string;
  name: string;
  /** Latar segmen batang; Bersama berupa garis miring dua warna, sama dengan titik identitasnya. */
  background: string;
  dot: { color?: IdentityColor; shared?: readonly [IdentityColor, IdentityColor] };
}

export function ownerStyle(ownerId: string | null, people: People): OwnerStyle {
  if (ownerId === people.me.id) {
    return { key: ownerId, name: people.me.name, background: identityColorVar(people.me.color), dot: { color: people.me.color } };
  }
  if (people.partner && ownerId === people.partner.id) {
    return {
      key: ownerId,
      name: people.partner.name,
      background: identityColorVar(people.partner.color),
      dot: { color: people.partner.color },
    };
  }
  const a = people.me.color;
  const b = people.partner?.color ?? people.me.color;
  return {
    key: "shared",
    name: "Bersama",
    background: `repeating-linear-gradient(135deg, ${identityColorVar(a)} 0 4px, ${identityColorVar(b)} 4px 8px)`,
    dot: { shared: [a, b] },
  };
}

/** Urutan tetap Saya, Partner, Bersama supaya warna tidak berpindah antar batang. */
export function ownerOrder(ownerId: string | null, people: People): number {
  if (ownerId === people.me.id) return 0;
  if (people.partner && ownerId === people.partner.id) return 1;
  return 2;
}
