"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { toggleLike } from "@/app/read/actions";

interface Props {
  chapterId: string;
  initialCount: number;
  initialLiked: boolean;
  userId: string | null;
}

export default function LikeButton({ chapterId, initialCount, initialLiked, userId }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!userId) return;

    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? c - 1 : c + 1));

    startTransition(async () => {
      const res = await toggleLike(chapterId);
      if (res.error) {
        // Revert
        setLiked(wasLiked);
        setCount((c) => (wasLiked ? c + 1 : c - 1));
        return;
      }
      if (res.liked !== undefined) setLiked(res.liked);
      if (res.count !== undefined) setCount(res.count);
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending || !userId}
      title={userId ? (liked ? "Unlike this chapter" : "Like this chapter") : "Log in to like"}
      className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
        liked
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : "bg-surface border-border text-fg-muted hover:text-fg hover:border-accent/30"
      } ${!userId ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <motion.svg
        key={liked ? "filled" : "outline"}
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="w-5 h-5"
        fill={liked ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={liked ? 0 : 1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </motion.svg>
      <span className="text-sm font-medium tabular-nums">{count}</span>
    </button>
  );
}
