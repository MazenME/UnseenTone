"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { toggleBookmark } from "@/app/read/actions";

interface Props {
  chapterId: string;
  initialBookmarked: boolean;
  userId: string | null;
}

export default function BookmarkButton({ chapterId, initialBookmarked, userId }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleToggle = () => {
    if (!userId) return;
    setError("");

    // Optimistic update
    const was = bookmarked;
    setBookmarked(!was);

    startTransition(async () => {
      const res = await toggleBookmark(chapterId);
      if (res.error) {
        console.error("Bookmark error:", res.error);
        setError(res.error);
        setBookmarked(was);
        return;
      }
      if (res.bookmarked !== undefined) setBookmarked(res.bookmarked);
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleToggle}
        disabled={isPending || !userId}
        title={userId ? (bookmarked ? "Remove bookmark" : "Bookmark this chapter") : "Log in to bookmark"}
        className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
          bookmarked
            ? "bg-accent/10 border-accent/30 text-accent"
            : "bg-surface border-border text-fg-muted hover:text-fg hover:border-accent/30"
        } ${!userId ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <motion.svg
          key={bookmarked ? "filled" : "outline"}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="w-5 h-5"
          fill={bookmarked ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={bookmarked ? 0 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
          />
        </motion.svg>
        <span className="text-sm font-medium">
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </span>
      </button>
      {error && <p className="text-xs text-red-400 max-w-[200px] text-center">{error}</p>}
    </div>
  );
}
