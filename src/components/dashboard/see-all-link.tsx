import type { ReactNode } from "react";
import Link from "next/link";

/** Tautan kepala kartu ke halaman lengkapnya. */
export function SeeAllLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-2 text-small text-accent hover:underline sm:min-h-8"
    >
      {children}
    </Link>
  );
}
