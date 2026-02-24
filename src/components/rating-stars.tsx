"use client";

import { useState } from "react";

interface RatingStarsProps {
  /** "chapter" or "novel" */
  type: "chapter" | "novel";
  /** chapter or novel ID */
  targetId: string;
  userId: string | null;
  initialAverage: number;
  initialCount: number;
  initialUserRating: number | null;
  /** Server action to call */
  onRate: (id: string, rating: number) => Promise<{
    error?: string;
    average?: number;
    count?: number;
    userRating?: number;
  }>;
}

export default function RatingStars({
  type,
  targetId,
  userId,
  initialAverage,
  initialCount,
  initialUserRating,
  onRate,
}: RatingStarsProps) {
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [userRating, setUserRating] = useState<number | null>(initialUserRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRate = async (rating: number) => {
    if (!userId || pending) return;
    setPending(true);
    setError(null);

    const res = await onRate(targetId, rating);
    if (res.error) {
      setError(res.error);
    } else {
      setAverage(res.average!);
      setCount(res.count!);
      setUserRating(res.userRating!);
    }
    setPending(false);
  };

  const displayValue = hovered ?? userRating ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Stars row */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => userId && setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            disabled={!userId || pending}
            aria-label={`Rate ${star} out of 10`}
            className={`transition-all ${
              !userId ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            } ${pending ? "animate-pulse" : ""}`}
          >
            <svg
              className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${
                star <= displayValue
                  ? "text-amber-400"
                  : "text-fg-muted/20"
              } ${userId && !pending ? "hover:scale-110" : ""}`}
              fill={star <= displayValue ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={star <= displayValue ? 0 : 1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        ))}
      </div>

      {/* Info line */}
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        <span className="font-semibold text-amber-400">{average > 0 ? average.toFixed(1) : "—"}</span>
        <span>/10</span>
        <span className="text-fg-muted/50">·</span>
        <span>{count} {count === 1 ? "rating" : "ratings"}</span>
        {userRating && (
          <>
            <span className="text-fg-muted/50">·</span>
            <span>Your rating: {userRating}</span>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
