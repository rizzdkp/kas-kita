"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Amount } from "@/components/money/amount";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

export interface AttentionItem {
  key: string;
  text: string;
  /** Nominal di kanan supaya tidak ikut terpotong saat nama panjang. */
  amount?: bigint;
  status: string;
  tone: BadgeTone;
  href: string;
}

const VISIBLE = 3;

/** "Perlu perhatian": strip ringkas, hanya kalau ada isi; satu baris per item, maksimal tiga lalu "Lihat semua". */
export function AttentionList({ items, className }: { items: AttentionItem[]; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, VISIBLE);
  return (
    <section aria-labelledby="perlu-perhatian" className={cn("flex flex-col rounded-card border border-border bg-surface px-2 py-2", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3 px-2">
        <h2 id="perlu-perhatian" className="text-small font-medium text-primary">
          Perlu perhatian
        </h2>
        {items.length > VISIBLE ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="perlu-perhatian-daftar"
            onClick={() => setExpanded((v) => !v)}
            className="-mr-1 inline-flex min-h-11 items-center rounded-sm px-1 text-small text-accent hover:underline sm:min-h-8"
          >
            {expanded ? "Tampilkan lebih sedikit" : `Lihat semua (${items.length})`}
          </button>
        ) : null}
      </div>
      <ul id="perlu-perhatian-daftar" className="flex flex-col">
        {shown.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-small text-primary hover:bg-surface-sunken sm:min-h-9"
            >
              <Badge tone={item.tone}>{item.status}</Badge>
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              {item.amount !== undefined ? <Amount value={item.amount} className="shrink-0 text-small text-primary" /> : null}
              <Icon icon={ChevronRight} size={16} className="shrink-0 text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
