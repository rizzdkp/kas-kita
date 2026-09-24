"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { formatDateWithYear, parseDateKey } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { controlBase } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/components/ui/cn";
import {
  AccountFilter,
  CategoryFilter,
  DateRangeFilter,
  KindFilter,
  RecorderFilter,
  TagFilter,
  type FilterKey,
  type FilterOptions,
} from "./filter-controls";
import { EMPTY_QUERY, type TransactionQuery } from "./filter-params";
import { KIND_LABEL } from "./labels";

type FiltersProps = {
  query: TransactionQuery;
  onChange: (patch: Partial<TransactionQuery>) => void;
  options: FilterOptions;
};

function SearchBox({ query, onChange }: Pick<FiltersProps, "query" | "onChange">) {
  const [text, setText] = useState(query.q);
  const committed = useRef(query.q);
  useEffect(() => {
    if (query.q !== committed.current) {
      committed.current = query.q;
      setText(query.q);
    }
  }, [query.q]);
  useEffect(() => {
    if (text === committed.current) return;
    // debounce supaya URL dan query server tidak berganti di setiap ketukan
    const timer = window.setTimeout(() => {
      committed.current = text;
      onChange({ q: text });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text, onChange]);
  return (
    <div className="relative min-w-0 flex-1 sm:min-w-56">
      <Icon icon={Search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
      <label htmlFor="cari-transaksi" className="sr-only">
        Cari transaksi
      </label>
      <input
        id="cari-transaksi"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cari transaksi"
        autoComplete="off"
        className={cn(controlBase, "h-11 pl-10 pr-3 sm:h-10")}
      />
    </div>
  );
}

const MORE_KEYS: FilterKey[] = ["from", "to", "createdBy", "tag"];

function countActive(query: TransactionQuery, keys: FilterKey[]): number {
  return keys.filter((k) => query[k]).length;
}

/** Bar filter di atas daftar (desktop) atau Sheet (mobile), plus chips filter aktif. */
export function TransactionFilters({ query, onChange, options }: FiltersProps) {
  const moreCount = countActive(query, MORE_KEYS);
  const allCount = countActive(query, ["kind", "accountId", "categoryId", ...MORE_KEYS]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 sm:flex-wrap">
        <SearchBox query={query} onChange={onChange} />
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <KindFilter query={query} onChange={onChange} options={options} compact className="w-40" />
          <AccountFilter query={query} onChange={onChange} options={options} compact className="w-48" />
          <CategoryFilter query={query} onChange={onChange} options={options} compact className="w-52" />
          <Popover>
            <PopoverTrigger asChild>
              <Button icon={ListFilter}>{moreCount ? `Lainnya (${moreCount})` : "Lainnya"}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-80 flex-col gap-4">
              <DateRangeFilter query={query} onChange={onChange} options={options} />
              <RecorderFilter query={query} onChange={onChange} options={options} />
              <TagFilter query={query} onChange={onChange} options={options} />
            </PopoverContent>
          </Popover>
        </div>
        <Sheet>
          <SheetFilterTrigger count={allCount} />
          <SheetContent title="Filter transaksi">
            <div className="flex flex-col gap-4">
              <KindFilter query={query} onChange={onChange} options={options} />
              <AccountFilter query={query} onChange={onChange} options={options} />
              <CategoryFilter query={query} onChange={onChange} options={options} />
              <DateRangeFilter query={query} onChange={onChange} options={options} />
              <RecorderFilter query={query} onChange={onChange} options={options} />
              <TagFilter query={query} onChange={onChange} options={options} />
              <SheetClose asChild>
                <Button variant="primary" className="mt-2">
                  Tampilkan hasil
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <ActiveChips query={query} onChange={onChange} options={options} />
    </div>
  );
}

function SheetFilterTrigger({ count }: { count: number }) {
  return (
    <SheetTrigger asChild>
      <Button icon={ListFilter} className="sm:hidden">
        {count ? `Filter (${count})` : "Filter"}
      </Button>
    </SheetTrigger>
  );
}

function dateLabel(key: string): string {
  const d = parseDateKey(key);
  return d ? formatDateWithYear(d) : key;
}

function ActiveChips({ query, onChange, options }: FiltersProps) {
  const chips: Array<{ key: string; label: string; clear: Partial<TransactionQuery> }> = [];
  if (query.q.trim()) chips.push({ key: "q", label: `“${query.q.trim()}”`, clear: { q: "" } });
  if (query.kind) chips.push({ key: "kind", label: KIND_LABEL[query.kind], clear: { kind: null } });
  if (query.accountId) {
    const a = options.accounts.find((x) => x.id === query.accountId);
    chips.push({ key: "account", label: a?.name ?? "Akun", clear: { accountId: null } });
  }
  if (query.categoryId) {
    const all = [...options.categories.expense, ...options.categories.income];
    const name = all.flatMap((g) => [g, ...g.children]).find((c) => c.id === query.categoryId)?.name;
    chips.push({ key: "category", label: name ?? "Kategori", clear: { categoryId: null } });
  }
  if (query.from) chips.push({ key: "from", label: `Dari ${dateLabel(query.from)}`, clear: { from: null } });
  if (query.to) chips.push({ key: "to", label: `Sampai ${dateLabel(query.to)}`, clear: { to: null } });
  if (query.createdBy) {
    const who = [options.people.me, options.people.partner].find((p) => p?.id === query.createdBy);
    chips.push({ key: "by", label: `Diisi oleh ${who?.name ?? "orang lain"}`, clear: { createdBy: null } });
  }
  if (query.tag) {
    const tag = options.tags.find((t) => t.id === query.tag || t.name === query.tag);
    chips.push({ key: "tag", label: `Tag ${tag?.name ?? query.tag}`, clear: { tag: null } });
  }
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filter aktif" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <li key={c.key} className="inline-flex h-8 items-center gap-1 rounded-pill border border-border bg-surface pl-3 pr-1 text-small text-primary">
          <span className="max-w-[24ch] truncate">{c.label}</span>
          <button
            type="button"
            aria-label={`Hapus filter ${c.label}`}
            onClick={() => onChange(c.clear)}
            className="relative inline-flex size-7 items-center justify-center rounded-pill text-secondary after:absolute after:-inset-2 after:content-[''] transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-surface-sunken hover:text-primary"
          >
            <Icon icon={X} size={16} />
          </button>
        </li>
      ))}
      {chips.length > 1 ? (
        <li>
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_QUERY, view: query.view })}
            className="h-11 rounded-md px-2 text-small text-accent sm:h-8 underline-offset-2 hover:underline"
          >
            Hapus semua filter
          </button>
        </li>
      ) : null}
    </ul>
  );
}
