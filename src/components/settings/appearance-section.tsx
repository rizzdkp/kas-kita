"use client";

import { useEffect, useState } from "react";
import { getReducedTransparency, setReducedTransparency, setThemePreference, type ThemePreference } from "@/styles/preferences";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";

const THEMES = [
  { value: "system", label: "Ikuti sistem" },
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

function readTheme(): ThemePreference {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : "system";
}

/** Preferensi per perangkat: disimpan di browser, bukan di server, jadi tanpa toast. */
export function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [reduced, setReduced] = useState(false);

  // atribut <html> sudah dipasang skrip preferensi sebelum paint; state mengikutinya setelah hydrate
  useEffect(() => {
    setTheme(readTheme());
    setReduced(getReducedTransparency());
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-small font-medium text-primary">
          Tema
        </span>
        <SegmentedControl
          label="Tema"
          value={theme}
          options={THEMES}
          onValueChange={(next) => {
            setTheme(next);
            setThemePreference(next);
          }}
          className="w-full sm:w-auto sm:self-start"
        />
      </div>
      <Switch
        label="Kurangi transparansi"
        description="Navigasi, menu, dan panel memakai latar solid, bukan kaca buram."
        checked={reduced}
        onCheckedChange={(next) => {
          setReduced(next);
          setReducedTransparency(next);
        }}
        className="border-t border-border pt-4"
      />
      <p className="text-small text-secondary">Tema dan transparansi berlaku di perangkat ini saja.</p>
    </div>
  );
}
