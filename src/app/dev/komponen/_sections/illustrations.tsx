import type { ComponentType } from "react";
import {
  AllBillsPaid,
  EmptyAccounts,
  EmptyBills,
  EmptyBudgets,
  EmptyGoals,
  EmptyImports,
  EmptyInvestments,
  EmptyNotifications,
  EmptyTransactions,
  GoalReached,
  HouseholdHero,
  Offline,
  type IllustrationProps,
} from "@/components/illustrations";
import { Section } from "./section";

const SPOTS: [string, ComponentType<IllustrationProps>][] = [
  ["EmptyAccounts", EmptyAccounts],
  ["EmptyTransactions", EmptyTransactions],
  ["EmptyBudgets", EmptyBudgets],
  ["EmptyBills", EmptyBills],
  ["AllBillsPaid", AllBillsPaid],
  ["EmptyGoals", EmptyGoals],
  ["GoalReached", GoalReached],
  ["EmptyInvestments", EmptyInvestments],
  ["EmptyImports", EmptyImports],
  ["EmptyNotifications", EmptyNotifications],
  ["Offline", Offline],
];

// mode terang dan gelap mengikuti tema halaman; snapshot galeri memotret keduanya
export function IllustrationsSection() {
  // warna sama dengan CONTOH di gallery.tsx; tidak diimpor supaya tidak ada impor melingkar
  const colors = { meColor: "ocean", partnerColor: "rose" } as const;
  return (
    <Section id="ilustrasi" title="Ilustrasi">
      <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-4 sm:p-(--space-card)">
        <HouseholdHero {...colors} className="w-full max-w-[480px]" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {SPOTS.map(([name, Spot]) => (
            <li key={name} className="flex flex-col items-start gap-1">
              <Spot {...colors} eager className="w-full max-w-[160px]" />
              <span className="text-caption text-secondary">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
