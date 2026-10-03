"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  getReducedTransparency,
  setReducedTransparency,
  setThemePreference,
  type ThemePreference,
} from "@/styles/preferences";

export function PreferencesBar() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    setTheme(attr === "light" || attr === "dark" ? attr : "system");
    setReduced(getReducedTransparency());
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-card border border-border bg-surface p-4">
      <SegmentedControl<ThemePreference>
        label="Tema"
        value={theme}
        onValueChange={(next) => {
          setTheme(next);
          setThemePreference(next);
        }}
        options={[
          { value: "system", label: "Sistem" },
          { value: "light", label: "Terang" },
          { value: "dark", label: "Gelap" },
        ]}
      />
      <Switch
        className="min-w-64"
        label="Kurangi transparansi"
        checked={reduced}
        onCheckedChange={(next) => {
          setReduced(next);
          setReducedTransparency(next);
        }}
      />
    </div>
  );
}
