"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { DashboardPeriod } from "@/server/queries/dashboard";

/** Bulan lalu / Bulan ini; pilihan hidup di URL (?periode=lalu) supaya bisa dibagikan seperti cakupan. */
export function PeriodToggle({ period, noun }: { period: DashboardPeriod; noun: "bulan" | "periode" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  // pilihan langsung berpindah; angka menyusul saat server selesai merender ulang
  const [shown, setShown] = useOptimistic(period);
  const title = noun === "bulan" ? "Bulan" : "Periode";
  return (
    <SegmentedControl<DashboardPeriod>
      label="Periode arus"
      value={shown}
      className="w-full sm:w-auto"
      options={[
        { value: "previous", label: `${title} lalu` },
        { value: "current", label: `${title} ini` },
      ]}
      onValueChange={(next) => {
        const search = new URLSearchParams(params.toString());
        if (next === "previous") search.set("periode", "lalu");
        else search.delete("periode");
        const query = search.toString();
        startTransition(() => {
          setShown(next);
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        });
      }}
    />
  );
}
