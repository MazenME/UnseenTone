"use client";

import RatingStars from "@/components/rating-stars";
import { rateNovel } from "@/app/novel/actions";

interface Props {
  novelId: string;
  userId: string | null;
  initialAverage: number;
  initialCount: number;
  initialUserRating: number | null;
}

export default function NovelRating({
  novelId,
  userId,
  initialAverage,
  initialCount,
  initialUserRating,
}: Props) {
  return (
    <div className="flex flex-col items-start gap-1.5 mt-4">
      <span className="text-xs text-fg-muted uppercase tracking-wider">Rate this novel</span>
      <RatingStars
        type="novel"
        targetId={novelId}
        userId={userId}
        initialAverage={initialAverage}
        initialCount={initialCount}
        initialUserRating={initialUserRating}
        onRate={rateNovel}
      />
    </div>
  );
}
