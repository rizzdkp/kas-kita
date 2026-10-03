import type { CSSProperties } from "react";
import type { Scope } from "@/lib/scope";
import { identityColorVar, type IdentityColor } from "@/components/identity/identity-colors";

type AmbientFieldProps = {
  scope: Scope;
  meColor: IdentityColor;
  /** Tanpa partner, cakupan Partner dan Gabungan jatuh ke warna sendiri. */
  partnerColor?: IdentityColor | null;
};

type Light = { color: IdentityColor; position: CSSProperties };

// dua posisi tetap: kiri atas dan kanan bawah, sebagian keluar layar supaya hanya tepinya yang terasa
const TOP_LEFT: CSSProperties = { left: "-18vmax", top: "-26vmax" };
const BOTTOM_RIGHT: CSSProperties = { right: "-22vmax", bottom: "-30vmax" };

/**
 * Medan ambien di belakang app (DESIGN 6). Tetap, tidak bergerak sendiri; ganti cakupan = crossfade 480ms.
 * Mati di G0 lewat glass.css.
 */
export function AmbientField({ scope, meColor, partnerColor }: AmbientFieldProps) {
  const partner = partnerColor ?? meColor;
  const layers: Record<Scope, Light[]> = {
    me: [
      { color: meColor, position: TOP_LEFT },
      { color: meColor, position: BOTTOM_RIGHT },
    ],
    partner: [
      { color: partner, position: TOP_LEFT },
      { color: partner, position: BOTTOM_RIGHT },
    ],
    all: [
      { color: meColor, position: TOP_LEFT },
      { color: partner, position: BOTTOM_RIGHT },
    ],
  };

  return (
    <div aria-hidden className="ambient-field" data-scope={scope}>
      {(Object.keys(layers) as Scope[]).map((key) => (
        <div key={key} className="ambient-field__layer" data-active={key === scope}>
          {layers[key].map((light, i) => (
            <span
              key={i}
              className="ambient-field__light"
              style={{ ...light.position, ["--ambient-color" as string]: identityColorVar(light.color) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
