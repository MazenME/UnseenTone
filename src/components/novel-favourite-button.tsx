"use client";

import { useState } from "react";
import { toggleNovelFavourite } from "@/app/novel/actions";

interface NovelFavouriteButtonProps {
  novelId: string;
  userId: string | null;
  initialFavourited: boolean;
  initialCount: number;
}

export default function NovelFavouriteButton({
  novelId,
  userId,
  initialFavourited,
  initialCount,
}: NovelFavouriteButtonProps) {
  const [favourited, setFavourited] = useState(initialFavourited);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!userId || pending) return;
    const wasFav = favourited;
    const wasCount = count;
    setFavourited(!wasFav);
    setCount(wasFav ? wasCount - 1 : wasCount + 1);
    setError(null);
    setPending(true);

    try {
      const res = await toggleNovelFavourite(novelId);
      if (res.error) {
        setFavourited(wasFav);
        setCount(wasCount);
        setError(res.error);
        console.error("NovelFavouriteButton:", res.error);
        return;
      }
      setFavourited(res.favourited!);
      setCount(res.count!);
    } catch (e: any) {
      setFavourited(wasFav);
      setCount(wasCount);
      setError(e.message ?? "Unknown error");
      console.error("NovelFavouriteButton exception:", e);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleToggle}
        disabled={!userId || pending}
        aria-label={favourited ? "Remove from favourites" : "Add to favourites"}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all
          ${
            favourited
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-[var(--card)]/60 text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10"
          }
          ${!userId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${pending ? "animate-pulse" : ""}
          border border-[var(--border)]`}
      >
        <svg
          className={`w-4 h-4 transition-transform ${favourited ? "scale-110" : ""}`}
          fill={favourited ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={favourited ? 0 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
        <span>{count}</span>
      </button>
      {error && <p className="text-xs text-red-400 max-w-[200px] text-center">{error}</p>}
    </div>
  );
}
