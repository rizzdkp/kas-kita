"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

export interface AttentionItem {
  key: string;
  text: string;
  status: string;
  tone: BadgeTone;
  href: string;
}

const VISIBLE = 3;

/** "Perlu perhatian": hanya dirender kalau ada isi, maksimal tiga baris lalu "Lihat semua". */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, VISIBLE);
  return (
    <section aria-labelledby="perlu-perhatian" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2">
      <h2 id="perlu-perhatian" className="px-2 pt-2 text-card text-primary">
        Perlu perhatian
      </h2>
      <ul id="perlu-perhatian-daftar" className="flex flex-col">
        {shown.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 text-body text-primary hover:bg-surface-sunken"
            >
              <Badge tone={item.tone}>{item.status}</Badge>
              <span className="min-w-0 flex-1">{item.text}</span>
              <Icon icon={ChevronRight} size={16} className="shrink-0 text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > VISIBLE ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="perlu-perhatian-daftar"
          onClick={() => setExpanded((v) => !v)}
          className="min-h-11 self-start rounded-md px-2 text-small text-accent hover:underline sm:min-h-8"
        >
          {expanded ? "Tampilkan lebih sedikit" : `Lihat semua (${items.length})`}
        </button>
      ) : null}
    </section>
  );
}
