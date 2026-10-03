"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LENS_BLUR, LENS_SCALE, buildDisplacementMap, isG2Enabled, type G2Environment } from "./lens-map";

const RESIZE_DEBOUNCE_MS = 100;

function readEnvironment(): G2Environment {
  const nav = navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string }> }; deviceMemory?: number };
  return {
    supportsUrlBackdrop: typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "url(#x)"),
    brands: nav.userAgentData?.brands?.map((b) => b.brand) ?? [],
    deviceMemory: nav.deviceMemory,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    reducedTransparency: window.matchMedia("(prefers-reduced-transparency: reduce)").matches,
    manualReducedTransparency: document.documentElement.getAttribute("data-transparency") === "reduced",
  };
}

/** G2 aktif atau tidak, mengikuti perubahan preferensi gerak dan transparansi saat app terbuka. */
function useG2(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(isG2Enabled(readEnvironment()));
    update();
    const queries = ["(prefers-reduced-motion: reduce)", "(prefers-reduced-transparency: reduce)"].map((q) => window.matchMedia(q));
    queries.forEach((q) => q.addEventListener("change", update));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-transparency"] });
    return () => {
      queries.forEach((q) => q.removeEventListener("change", update));
      observer.disconnect();
    };
  }, []);
  return enabled;
}

type LensMap = { width: number; height: number; href: string };

function renderMap(width: number, height: number, radius: number): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(width, height);
  image.data.set(buildDisplacementMap(width, height, radius));
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * G2 refraksi (DESIGN 5.5) untuk toggle cakupan, bar quick-add, dan tombol tambah. Hanya hiasan:
 * di luar Chromium dengan memori >= 4 GB, atau saat gerak/transparansi dikurangi, anak tampil apa adanya (G1/G0).
 * Pembungkus `display: contents`, jadi tata letak anak tidak berubah.
 */
export function GlassLens({ children }: { children: ReactNode }) {
  const enabled = useG2();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<LensMap | null>(null);
  const filterId = `kk-lens-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const target = hostRef.current?.firstElementChild;
    if (!enabled || !(target instanceof HTMLElement)) {
      setMap(null);
      return;
    }
    let timer: number | undefined;
    const build = () => {
      const width = Math.round(target.offsetWidth);
      const height = Math.round(target.offsetHeight);
      if (width === 0 || height === 0) return;
      const radius = Number.parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      const href = renderMap(width, height, radius);
      setMap(href ? { width, height, href } : null);
    };
    build();
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(target);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [enabled]);

  // backdrop-filter tetap ditulis di glass.css; di sini hanya url() filter lewat custom property
  useEffect(() => {
    const target = hostRef.current?.firstElementChild;
    if (!(target instanceof HTMLElement)) return;
    if (!enabled || !map) {
      delete target.dataset.lens;
      target.style.removeProperty("--glass-lens");
      return;
    }
    target.dataset.lens = "on";
    target.style.setProperty("--glass-lens", `url(#${filterId})`);
    return () => {
      delete target.dataset.lens;
      target.style.removeProperty("--glass-lens");
    };
  }, [enabled, map, filterId]);

  const s = LENS_SCALE;
  return (
    <div ref={hostRef} className="glass-lens-host">
      {children}
      {enabled && map
        ? createPortal(
            <svg aria-hidden focusable="false" className="glass-lens-defs">
              <filter
                id={filterId}
                // region diperluas sebesar skala displacement supaya tepi tidak kosong
                x={-s}
                y={-s}
                width={map.width + 2 * s}
                height={map.height + 2 * s}
                filterUnits="userSpaceOnUse"
                primitiveUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feImage href={map.href} x={0} y={0} width={map.width} height={map.height} preserveAspectRatio="none" result="map" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={s} xChannelSelector="R" yChannelSelector="G" result="bent" />
                <feGaussianBlur in="bent" stdDeviation={LENS_BLUR} />
              </filter>
            </svg>,
            document.body,
          )
        : null}
    </div>
  );
}
