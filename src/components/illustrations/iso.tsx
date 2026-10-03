import type { CSSProperties, ReactNode } from "react";
import { identityColorVar, type IdentityColor } from "@/components/identity/identity-colors";
import { cn } from "@/components/ui/cn";
import "./illustrations.css";

/*
 * Primitif isometrik 30°: sumbu x ke kanan-bawah, y ke kiri-bawah, z ke atas.
 * Permukaan yang terlihat: atas, kiri (bidang y terbesar), kanan (bidang x terbesar).
 */

export type P3 = readonly [number, number, number];
export type Tone = "accent" | "me" | "partner" | "coin" | "steel" | "positive" | "paper" | "ground" | "glass";
type Face = "t" | "l" | "r";

const COS30 = Math.sqrt(3) / 2;
// lingkaran berjari-jari r di bidang datar menjadi elips dengan sumbu ini
const ELLIPSE_X = Math.SQRT2 * COS30;
const ELLIPSE_Y = Math.SQRT2 * 0.5;

const round = (v: number) => Math.round(v * 10) / 10;

export function project([x, y, z]: P3): [number, number] {
  return [round((x - y) * COS30), round((x + y) * 0.5 - z)];
}

export function points(list: readonly P3[]): string {
  return list.map((p) => project(p).join(",")).join(" ");
}

const cls = (tone: Tone, face: Face) => `${tone}-${face}`;

export function Poly({ pts, tone, face }: { pts: readonly P3[]; tone: Tone; face: Face }) {
  return <polygon points={points(pts)} className={cls(tone, face)} />;
}

export function Line({ pts, kind = "ink" }: { pts: readonly P3[]; kind?: "ink" | "check" | "accent-line" | "edge" }) {
  return <polyline points={points(pts)} className={`il-${kind}`} />;
}

type BoxProps = { at: P3; size: P3; tone: Tone; top?: Tone; edge?: boolean };

/** Balok dengan tiga permukaan terlihat. */
export function Box({ at: [x, y, z], size: [w, d, h], tone, top, edge }: BoxProps) {
  const X = x + w;
  const Y = y + d;
  const Z = z + h;
  const topPts: P3[] = [
    [x, y, Z],
    [X, y, Z],
    [X, Y, Z],
    [x, Y, Z],
  ];
  return (
    <g>
      <Poly tone={tone} face="l" pts={[[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]]} />
      <Poly tone={tone} face="r" pts={[[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]]} />
      <Poly tone={top ?? tone} face="t" pts={topPts} />
      {edge ? <polygon points={points(topPts)} className="il-edge" /> : null}
    </g>
  );
}

/** Tabung tegak (koin, pot, kaki). */
export function Cylinder({ at: [x, y, z], r, h, tone, ring }: { at: P3; r: number; h: number; tone: Tone; ring?: boolean }) {
  const [bx, by] = project([x, y, z]);
  const [tx, ty] = project([x, y, z + h]);
  const rx = round(r * ELLIPSE_X);
  const ry = round(r * ELLIPSE_Y);
  const arc = `A${rx} ${ry} 0 0 0`;
  return (
    <g>
      <path d={`M${tx - rx} ${ty}L${bx - rx} ${by}${arc} ${bx + rx} ${by}L${tx + rx} ${ty}Z`} className={cls(tone, "l")} />
      <path d={`M${bx} ${by + ry}${arc} ${bx + rx} ${by}L${tx + rx} ${ty}A${rx} ${ry} 0 0 1 ${tx} ${ty + ry}Z`} className={cls(tone, "r")} />
      <ellipse cx={tx} cy={ty} rx={rx} ry={ry} className={cls(tone, "t")} />
      {ring ? <ellipse cx={tx} cy={ty} rx={round(rx * 0.62)} ry={round(ry * 0.62)} className="il-edge" /> : null}
    </g>
  );
}

/** Tumpukan koin; jumlah koin = tinggi tumpukan. */
export function CoinStack({ at: [x, y, z], count, tone = "coin", r = 9 }: { at: P3; count: number; tone?: Tone; r?: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <Cylinder key={i} at={[x + (i % 2) * 0.6, y, z + i * 4]} r={r} h={3.4} tone={tone} ring={i === count - 1} />
      ))}
    </g>
  );
}

/** Lingkaran pada bidang tegak atau datar, didekati poligon. */
export function Disc({ center: [x, y, z], r, plane, tone, face }: { center: P3; r: number; plane: "x" | "y" | "z"; tone: Tone; face: Face }) {
  const pts: P3[] = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const u = Math.cos(a) * r;
    const v = Math.sin(a) * r;
    if (plane === "x") return [x, y + u, z + v];
    if (plane === "y") return [x + u, y, z + v];
    return [x + u, y + v, z];
  });
  return <Poly pts={pts} tone={tone} face={face} />;
}

/** Bayangan lembut: dua elips berlapis di lantai. */
export function Shadow({ at, rx, ry }: { at: P3; rx: number; ry: number }) {
  const [cx, cy] = project(at);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className="il-shadow" />
      <ellipse cx={cx} cy={cy} rx={round(rx * 0.72)} ry={round(ry * 0.72)} className="il-shadow" />
    </g>
  );
}

/** Persegi pada bidang tegak menghadap kiri (y tetap). */
export function rectY(y: number, x0: number, x1: number, z0: number, z1: number): P3[] {
  return [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
}

/** Persegi pada bidang tegak menghadap kanan (x tetap). */
export function rectX(x: number, y0: number, y1: number, z0: number, z1: number): P3[] {
  return [
    [x, y0, z0],
    [x, y1, z0],
    [x, y1, z1],
    [x, y0, z1],
  ];
}

/** Persegi pada bidang datar (z tetap). */
export function rectZ(z: number, x0: number, x1: number, y0: number, y1: number): P3[] {
  return [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
}

export type IllustrationProps = {
  className?: string;
  /** Ganti label bawaan; diabaikan kalau dekoratif. */
  label?: string;
  /** Benar bila teks di sampingnya sudah menjelaskan; gambar disembunyikan dari pembaca layar. */
  decorative?: boolean;
  meColor?: IdentityColor | null | undefined;
  partnerColor?: IdentityColor | null | undefined;
};

type FrameProps = IllustrationProps & { viewBox: string; width: number; height: number; defaultLabel: string; children: ReactNode };

export function IsoFrame({ viewBox, width, height, defaultLabel, label, decorative, meColor, partnerColor, className, children }: FrameProps) {
  const style: Record<string, string> = {};
  if (meColor) style["--il-me-src"] = identityColorVar(meColor);
  if (partnerColor) style["--il-partner-src"] = identityColorVar(partnerColor);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={height}
      className={cn("kk-il h-auto max-w-full shrink-0", className)}
      style={style as CSSProperties}
      focusable="false"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? defaultLabel })}
    >
      {children}
    </svg>
  );
}

// ilustrasi kecil untuk state kosong; satu bingkai 160 x 160 supaya ukurannya seragam
export const SPOT_VIEWBOX = "-82 -116 164 164";

export function Spot({ defaultLabel, children, ...props }: IllustrationProps & { defaultLabel: string; children: ReactNode }) {
  return (
    <IsoFrame {...props} viewBox={SPOT_VIEWBOX} width={164} height={164} defaultLabel={defaultLabel}>
      {children}
    </IsoFrame>
  );
}

