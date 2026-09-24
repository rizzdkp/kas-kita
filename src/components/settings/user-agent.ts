export type DeviceKind = "phone" | "tablet" | "desktop" | "unknown";

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/EdgiOS|EdgA|Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/FxiOS|Firefox\//, "Firefox"],
  [/CriOS|Chrome\/|HeadlessChrome/, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: ReadonlyArray<[RegExp, string, DeviceKind]> = [
  [/iPhone/, "iPhone", "phone"],
  [/iPad/, "iPad", "tablet"],
  [/Android.*Mobile/, "Android", "phone"],
  [/Android/, "tablet Android", "tablet"],
  [/CrOS/, "ChromeOS", "desktop"],
  [/Mac OS X|Macintosh/, "Mac", "desktop"],
  [/Windows/, "Windows", "desktop"],
  [/Linux/, "Linux", "desktop"],
];

/** "Safari di iPhone", "Chrome di Mac"; urutan pola penting karena Chrome juga menulis "Safari". */
export function describeUserAgent(userAgent: string | null): { label: string; kind: DeviceKind } {
  if (!userAgent) return { label: "Perangkat tidak dikenal", kind: "unknown" };
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent));
  if (!browser && !system) return { label: "Perangkat tidak dikenal", kind: "unknown" };
  if (!system) return { label: browser ?? "Browser", kind: "unknown" };
  return { label: browser ? `${browser} di ${system[1]}` : system[1], kind: system[2] };
}
