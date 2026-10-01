"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, formatINR } from "@/lib/utils";
import type { ApiUnlistedListing } from "@/lib/api/types";

type SortKey = "name" | "price-desc" | "price-asc";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "name", label: "A to Z" },
  { id: "price-desc", label: "Price high" },
  { id: "price-asc", label: "Price low" },
];

const PAGE = 48;

function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => w && !/^(limited|ltd|private|pvt|india)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function DirectoryView({ companies, sectors }: { companies: ApiUnlistedListing[]; sectors: string[] }) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = companies.filter(
      (c) => (!sector || c.sector === sector) && (!q || c.name.toLowerCase().includes(q)),
    );
    const priced = (c: ApiUnlistedListing, missing: number) => c.price ?? missing;
    return [...filtered].sort((a, b) => {
      if (sort === "price-desc") return priced(b, -1) - priced(a, -1);
      if (sort === "price-asc") return priced(a, Infinity) - priced(b, Infinity);
      return a.name.localeCompare(b.name);
    });
  }, [companies, query, sector, sort]);

  const label = "mb-1.5 block text-2xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4 rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="unlisted-search" className={label}>
            Company
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="unlisted-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Search by name"
              className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent/60"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="unlisted-sector" className={label}>
            Sector
          </label>
          <div className="relative">
            <select
              id="unlisted-sector"
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                setShown(PAGE);
              }}
              className="h-9 max-w-[16rem] appearance-none rounded-lg border border-border bg-surface-muted pl-3 pr-9 text-sm transition-colors hover:border-accent/50"
            >
              <option value="">All sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div>
          <span className={label}>Sort</span>
          <SegmentedControl options={SORTS} value={sort} onChange={setSort} layoutGroupId="unlisted-sort" />
        </div>
      </div>

      <p className="font-mono text-2xs text-muted-foreground">
        {rows.length} of {companies.length} companies
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          No company matches that search. Clear the sector filter or try a shorter name.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.slice(0, shown).map((c) => (
            <li key={c.id}>
              <Link
                href={`/unlisted/${c.id}`}
                className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_18px_36px_-26px_hsl(var(--accent)/0.6)]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/20 bg-gradient-to-br from-accent/15 to-accent/5 font-mono text-xs font-semibold text-accent">
                  {initials(c.name) || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold tracking-tight">{c.name}</span>
                  <span className="mt-0.5 block truncate text-2xs text-muted-foreground">{c.sector ?? "Sector not listed"}</span>
                </span>
                <span className="text-right">
                  <span className={cn("block font-mono text-sm font-semibold tabular-nums", c.price == null && "text-muted-foreground")}>
                    {c.price == null ? "n/a" : `₹${formatINR(c.price, c.price < 100 ? 2 : 0)}`}
                  </span>
                  <ArrowUpRight className="ml-auto mt-0.5 h-3.5 w-3.5 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > shown ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="btn-ghost px-5 active:scale-[0.98]"
          >
            Show {Math.min(PAGE, rows.length - shown)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
