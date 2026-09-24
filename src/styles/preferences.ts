/**
 * Preferensi tampilan per perangkat. Dibaca script inline di root layout sebelum paint,
 * jadi kunci dan nilai di sini harus sama dengan PREFERENCES_SCRIPT.
 */

export const TRANSPARENCY_KEY = "kaskita:transparency";
export const THEME_KEY = "kaskita:theme";

export type ThemePreference = "system" | "light" | "dark";

export const PREFERENCES_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${TRANSPARENCY_KEY}");if(t==="reduced")d.setAttribute("data-transparency","reduced");var m=localStorage.getItem("${THEME_KEY}");if(m==="light"||m==="dark")d.setAttribute("data-theme",m);}catch(e){}})();`;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function setReducedTransparency(reduced: boolean): void {
  const root = document.documentElement;
  if (reduced) root.setAttribute("data-transparency", "reduced");
  else root.removeAttribute("data-transparency");
  const storage = safeStorage();
  if (!storage) return;
  if (reduced) storage.setItem(TRANSPARENCY_KEY, "reduced");
  else storage.removeItem(TRANSPARENCY_KEY);
}

export function getReducedTransparency(): boolean {
  return document.documentElement.getAttribute("data-transparency") === "reduced";
}

export function setThemePreference(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const storage = safeStorage();
  if (!storage) return;
  if (theme === "system") storage.removeItem(THEME_KEY);
  else storage.setItem(THEME_KEY, theme);
}

