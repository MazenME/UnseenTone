import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ── Redis client ─────────────────────────────────────────────
// Falls back gracefully if credentials aren't set yet.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && !process.env.UPSTASH_REDIS_REST_URL.startsWith("your_")
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

// ── Rate limiters ────────────────────────────────────────────

/** Comment rate limit: 5 comments per 60 seconds per IP */
export const commentRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: true,
      prefix: "rl:comment",
    })
  : null;

/** Like rate limit: 30 actions per 60 seconds per user */
export const likeRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "60 s"),
      analytics: true,
      prefix: "rl:like",
    })
  : null;

/** Bookmark rate limit: 30 actions per 60 seconds per user */
export const bookmarkRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "60 s"),
      analytics: true,
      prefix: "rl:bookmark",
    })
  : null;
