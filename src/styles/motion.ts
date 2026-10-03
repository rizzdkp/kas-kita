/** Token gerak untuk komponen yang memakai `motion`; nilainya sama dengan tokens.css. */

export const SPRING_GLASS = { type: "spring", stiffness: 420, damping: 32, mass: 1 } as const;

// crossfade pengganti pegas saat prefers-reduced-motion
export const REDUCED_FADE = { duration: 0.12, ease: "linear" } as const;

export const DUR_HERO_COUNT_MS = 400;
