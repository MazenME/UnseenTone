"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NovelCard from "@/components/novel-card";

interface NovelResult {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  created_at: string;
  last_read_progress: number | null;
}

interface ExploreClientProps {
  initialNovels: NovelResult[];
}

const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 60;

export default function ExploreClient({ initialNovels }: ExploreClientProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [novels, setNovels] = useState<NovelResult[]>(initialNovels);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, NovelResult[]>>(new Map([["", initialNovels]]));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    const normalized = debouncedQuery;

    const cached = cacheRef.current.get(normalized);
    if (cached) {
      setNovels(cached);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function runSearch() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/explore?q=${encodeURIComponent(normalized)}&limit=${SEARCH_LIMIT}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const payload: { novels: NovelResult[] } = await response.json();
        cacheRef.current.set(normalized, payload.novels);
        setNovels(payload.novels);
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }

        setError("Could not load novels right now.");
      } finally {
        setIsLoading(false);
      }
    }

    runSearch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const countLabel = useMemo(() => {
    return `${novels.length} novel${novels.length === 1 ? "" : "s"}`;
  }, [novels.length]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg">Explore</h1>
        <p className="text-fg-muted mt-2 max-w-2xl">
          Discover every novel in the library, including new releases as they are added.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 mb-8">
        <label htmlFor="explore-search" className="block text-sm font-medium text-fg-muted mb-2">
          Search novels
        </label>
        <div className="relative">
          <input
            id="explore-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or synopsis"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 pr-11 text-sm text-fg placeholder:text-fg-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <svg
            className="w-5 h-5 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs sm:text-sm text-fg-muted">
          <span>{countLabel}</span>
          {isLoading ? <span>Searching...</span> : <span>Debounced {DEBOUNCE_MS}ms</span>}
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : novels.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl px-8 py-16 text-center">
          <p className="text-fg-muted text-lg">No novels match your search.</p>
          <p className="text-fg-muted/70 text-sm mt-1">Try a different keyword.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {novels.map((novel) => (
            <NovelCard key={novel.id} novel={novel} />
          ))}
        </div>
      )}
    </section>
  );
}
