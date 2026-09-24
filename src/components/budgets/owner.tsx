import type { IdentityColor } from "@/components/identity/identity-colors";
import { IdentityDot } from "@/components/identity/identity-dot";

export type PlanningPerson = { id: string; name: string; color: IdentityColor };

/** Orang yang login dan partnernya; dipakai halaman Anggaran, Tagihan, dan Target untuk label pemilik. */
export type PlanningPeople = { me: PlanningPerson; partner: PlanningPerson | null };

export function ownerName(ownerId: string | null, people: PlanningPeople): string {
  if (ownerId === null) return "Bersama";
  if (ownerId === people.me.id) return people.me.name;
  if (people.partner && ownerId === people.partner.id) return people.partner.name;
  return "Pemilik lain";
}

/** Titik pemilik; Bersama memakai dua setengah lingkaran (DESIGN 2.2). */
export function OwnerDot({ ownerId, people, className }: { ownerId: string | null; people: PlanningPeople; className?: string }) {
  const label = ownerId === null ? "Milik Bersama" : `Milik ${ownerName(ownerId, people)}`;
  if (ownerId === null) {
    const shared: readonly [IdentityColor, IdentityColor] = [people.me.color, people.partner?.color ?? people.me.color];
    return <IdentityDot shared={shared} label={label} className={className} />;
  }
  const color = ownerId === people.partner?.id ? people.partner.color : people.me.color;
  return <IdentityDot color={color} label={label} className={className} />;
}

export type OwnerChoice = "me" | "partner" | "shared";

export function ownerChoiceOptions(people: PlanningPeople): Array<{ value: OwnerChoice; label: string }> {
  return [
    { value: "me", label: "Kamu" },
    ...(people.partner ? [{ value: "partner" as const, label: people.partner.name }] : []),
    { value: "shared", label: "Bersama" },
  ];
}

export function ownerIdFromChoice(choice: OwnerChoice, people: PlanningPeople): string | null {
  if (choice === "shared") return null;
  if (choice === "partner" && people.partner) return people.partner.id;
  return people.me.id;
}

export function choiceFromOwnerId(ownerId: string | null, people: PlanningPeople): OwnerChoice {
  if (ownerId === null) return "shared";
  return ownerId === people.partner?.id ? "partner" : "me";
}

/** Pilihan awal pemilik dari cakupan aktif. */
export function choiceFromScope(scope: "me" | "partner" | "all", people: PlanningPeople): OwnerChoice {
  return scope === "partner" && people.partner ? "partner" : "me";
}
