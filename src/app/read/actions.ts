"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { commentRateLimit, likeRateLimit, bookmarkRateLimit } from "@/lib/redis";
import { logger } from "@/lib/logger";

// ── Helpers ──────────────────────────────────────────────────

/** Secure auth check — validates JWT against Supabase server. Use for mutations. */
async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Fast auth check — reads session from cookie only (no network call). Use for read-only actions. */
async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, user: session?.user ?? null };
}

async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  return (
    hdrs.get("cf-connecting-ip") ??
    hdrs.get("x-real-ip") ??
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // skip in dev if not configured

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });

  const json = await res.json();
  return json.success === true;
}

const MAX_COMMENT_REPLY_DEPTH = 3;

// ── Comments ─────────────────────────────────────────────────

export interface CommentRow {
  id: string;
  chapter_id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  depth: number;
  likes: number;
  dislikes: number;
  user_reaction: "like" | "dislike" | null;
  users_profile: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  replies?: CommentRow[];
}

type RawComment = Omit<CommentRow, "likes" | "dislikes" | "user_reaction" | "replies" | "depth">;
type RawProfile = {
  id?: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};
type RawCommentDbRow = Omit<RawComment, "users_profile"> & {
  users_profile: RawProfile | RawProfile[] | null;
};

function normalizeProfile(profile: RawProfile | RawProfile[] | null, fallbackUserId: string): CommentRow["users_profile"] {
  const value = Array.isArray(profile) ? (profile[0] ?? null) : profile;
  if (!value) return null;
  return {
    id: value.id ?? fallbackUserId,
    display_name: value.display_name ?? null,
    email: value.email ?? null,
    avatar_url: value.avatar_url ?? null,
  };
}

export async function getChapterComments(chapterId: string): Promise<CommentRow[]> {
  const { supabase, user } = await getSessionUser();
  const { data, error } = await supabase
    .from("comments")
    .select("id, chapter_id, body, created_at, user_id, parent_id, users_profile(id, display_name, email, avatar_url)")
    .eq("chapter_id", chapterId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("getChapterComments failed", { chapterId, error: error.message });
    return [];
  }

  const raw: RawComment[] = ((data || []) as RawCommentDbRow[]).map((row) => ({
    ...row,
    users_profile: normalizeProfile(row.users_profile, row.user_id),
  }));

  // Fetch reaction counts for all comment IDs
  const commentIds = raw.map((c) => c.id);
  const reactionCounts: Record<string, { likes: number; dislikes: number }> = {};
  const userReactions: Record<string, "like" | "dislike"> = {};

  if (commentIds.length > 0) {
    // Parallelize aggregate reaction counts + current user reaction lookup
    const [{ data: reactions }, { data: myReactions }] = await Promise.all([
      supabase
        .from("v_comment_reaction_counts")
        .select("comment_id, likes, dislikes")
        .in("comment_id", commentIds),
      user
        ? supabase
            .from("comment_reactions")
            .select("comment_id, reaction_type")
            .in("comment_id", commentIds)
            .eq("user_id", user.id)
        : Promise.resolve({ data: null }),
    ]);

    for (const r of reactions || []) {
      reactionCounts[r.comment_id] = {
        likes: r.likes || 0,
        dislikes: r.dislikes || 0,
      };
    }

    for (const r of myReactions || []) {
      userReactions[r.comment_id] = r.reaction_type as "like" | "dislike";
    }
  }

  const enriched: CommentRow[] = raw.map((c) => ({
    ...c,
    depth: 0,
    likes: reactionCounts[c.id]?.likes ?? 0,
    dislikes: reactionCounts[c.id]?.dislikes ?? 0,
    user_reaction: userReactions[c.id] ?? null,
  }));

  // Build tree: recursive nesting at any depth
  const topLevel: CommentRow[] = [];
  const byId: Record<string, CommentRow> = {};

  for (const c of enriched) {
    c.replies = [];
    byId[c.id] = c;
  }

  for (const c of enriched) {
    if (c.parent_id && byId[c.parent_id]) {
      byId[c.parent_id].replies!.push(c);
    } else {
      topLevel.push(c);
    }
  }

  const applyDepth = (list: CommentRow[], depth: number) => {
    for (const item of list) {
      item.depth = depth;
      if (item.replies?.length) applyDepth(item.replies, depth + 1);
    }
  };
  applyDepth(topLevel, 0);

  return topLevel;
}

export async function getCommentNode(commentId: string): Promise<CommentRow | null> {
  const { supabase, user } = await getSessionUser();

  const { data: comment, error } = await supabase
    .from("comments")
    .select("id, chapter_id, body, created_at, user_id, parent_id, users_profile(id, display_name, email, avatar_url)")
    .eq("id", commentId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error || !comment) return null;

  const [{ data: reaction }, { data: myReaction }] = await Promise.all([
    supabase
      .from("v_comment_reaction_counts")
      .select("comment_id, likes, dislikes")
      .eq("comment_id", commentId)
      .maybeSingle(),
    user
      ? supabase
          .from("comment_reactions")
          .select("reaction_type")
          .eq("comment_id", commentId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let depth = 0;
  let parentId = comment.parent_id as string | null;
  while (parentId) {
    depth += 1;
    const { data: parent } = await supabase
      .from("comments")
      .select("parent_id")
      .eq("id", parentId)
      .maybeSingle();
    parentId = parent?.parent_id ?? null;
    if (depth > 20) break;
  }

  const commentRow = comment as RawCommentDbRow;

  return {
    ...commentRow,
    users_profile: normalizeProfile(commentRow.users_profile, commentRow.user_id),
    depth,
    likes: reaction?.likes || 0,
    dislikes: reaction?.dislikes || 0,
    user_reaction: (myReaction?.reaction_type as "like" | "dislike" | undefined) ?? null,
    replies: [],
  };
}

export async function submitComment(
  chapterId: string,
  body: string,
  turnstileToken: string,
  parentId?: string | null
): Promise<{ error?: string; success?: boolean }> {
  // 1. Verify Turnstile
  const valid = await verifyTurnstile(turnstileToken);
  if (!valid) return { error: "Captcha verification failed. Please try again." };

  // 2. Auth check
  const { supabase, user } = await getUser();
  if (!user) return { error: "You must be logged in to comment." };

  // 3. Ban check
  const { data: profile } = await supabase
    .from("users_profile")
    .select("is_banned")
    .eq("id", user.id)
    .single();
  if (profile?.is_banned) return { error: "Your account has been suspended." };

  // 4. Rate limit (by IP)
  const ip = await getClientIp();
  if (commentRateLimit) {
    const { success } = await commentRateLimit.limit(ip);
    if (!success) return { error: "Too many comments. Please wait a moment." };
  }

  // 5. Validate body
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comment cannot be empty." };
  if (trimmed.length > 2000) return { error: "Comment is too long (max 2000 characters)." };

  // 6. Validate reply chain depth and scope when this is a reply
  if (parentId) {
    let currentParentId: string | null = parentId;
    let currentDepth = 0;

    while (currentParentId) {
      currentDepth += 1;
      if (currentDepth > MAX_COMMENT_REPLY_DEPTH) {
        return { error: `Replies can be nested up to ${MAX_COMMENT_REPLY_DEPTH} levels.` };
      }

      const parentResult = await supabase
        .from("comments")
        .select("id, chapter_id, parent_id, is_deleted")
        .eq("id", currentParentId)
        .maybeSingle();

      const parent = (parentResult.data as {
        id: string;
        chapter_id: string;
        parent_id: string | null;
        is_deleted: boolean;
      } | null);
      const parentError = parentResult.error;

      if (parentError || !parent) return { error: "The comment you are replying to no longer exists." };
      if (parent.chapter_id !== chapterId) return { error: "Invalid reply target." };
      if (parent.is_deleted) return { error: "You cannot reply to a deleted comment." };

      currentParentId = parent.parent_id;
    }
  }

  // 7. Insert
  const { error } = await supabase.from("comments").insert({
    chapter_id: chapterId,
    user_id: user.id,
    body: trimmed,
    ip_address: ip,
    parent_id: parentId || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

// ── Comment Reactions ────────────────────────────────────────

export async function toggleCommentReaction(
  commentId: string,
  reactionType: "like" | "dislike"
): Promise<{ error?: string; likes?: number; dislikes?: number; user_reaction?: "like" | "dislike" | null }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "You must be logged in." };

  // Check existing reaction
  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("id, reaction_type")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  let newReaction: "like" | "dislike" | null = null;

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // Same reaction → remove it (toggle off)
      await supabase.from("comment_reactions").delete().eq("id", existing.id);
      newReaction = null;
    } else {
      // Different reaction → update
      await supabase.from("comment_reactions").update({ reaction_type: reactionType }).eq("id", existing.id);
      newReaction = reactionType;
    }
  } else {
    // No reaction → insert
    const { error: insErr } = await supabase.from("comment_reactions").insert({
      comment_id: commentId,
      user_id: user.id,
      reaction_type: reactionType,
    });
    if (insErr) return { error: insErr.message };
    newReaction = reactionType;
  }

  // Get updated counts in parallel (instead of 2 sequential queries)
  const [{ count: likes }, { count: dislikes }] = await Promise.all([
    supabase
      .from("comment_reactions")
      .select("id", { count: "exact", head: true })
      .eq("comment_id", commentId)
      .eq("reaction_type", "like"),
    supabase
      .from("comment_reactions")
      .select("id", { count: "exact", head: true })
      .eq("comment_id", commentId)
      .eq("reaction_type", "dislike"),
  ]);

  return { likes: likes ?? 0, dislikes: dislikes ?? 0, user_reaction: newReaction };
}

// ── Likes ────────────────────────────────────────────────────

export async function getChapterLikeState(
  chapterId: string
): Promise<{ count: number; liked: boolean }> {
  const { supabase, user } = await getSessionUser();

  const countPromise = supabase
    .from("chapter_likes")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);

  const likedPromise = user
    ? supabase
        .from("chapter_likes")
        .select("id")
        .eq("chapter_id", chapterId)
        .eq("user_id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [{ count }, likedResult] = await Promise.all([countPromise, likedPromise]);
  const liked = !!likedResult.data;

  return { count: count ?? 0, liked };
}

export async function toggleLike(
  chapterId: string
): Promise<{ error?: string; liked?: boolean; count?: number }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "You must be logged in to like chapters." };

  // Rate limit
  if (likeRateLimit) {
    const { success } = await likeRateLimit.limit(user.id);
    if (!success) return { error: "Too many requests. Please wait." };
  }

  // Check existing
  const { data: existing } = await supabase
    .from("chapter_likes")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("chapter_likes").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase.from("chapter_likes").insert({
      chapter_id: chapterId,
      user_id: user.id,
    });
    if (error) return { error: error.message };
  }

  // Return new state
  const { count } = await supabase
    .from("chapter_likes")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);

  return { liked: !existing, count: count ?? 0 };
}

// ── Bookmarks ────────────────────────────────────────────────

export async function getBookmarkState(
  chapterId: string
): Promise<{ bookmarked: boolean }> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { bookmarked: false };

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) logger.error("getBookmarkState failed", { chapterId, error: error.message });
  return { bookmarked: !!data };
}

export async function toggleBookmark(
  chapterId: string
): Promise<{ error?: string; bookmarked?: boolean }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "You must be logged in to bookmark chapters." };

  // Rate limit
  if (bookmarkRateLimit) {
    const { success } = await bookmarkRateLimit.limit(user.id);
    if (!success) return { error: "Too many requests. Please wait." };
  }

  const { data: existing, error: selectErr } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectErr) {
    logger.error("toggleBookmark select failed", { chapterId, error: selectErr.message });
    return { error: selectErr.message };
  }

  if (existing) {
    const { error: delErr } = await supabase.from("bookmarks").delete().eq("id", existing.id);
    if (delErr) {
      logger.error("toggleBookmark delete failed", { chapterId, error: delErr.message });
      return { error: delErr.message };
    }
  } else {
    const { error: insErr } = await supabase.from("bookmarks").insert({
      chapter_id: chapterId,
      user_id: user.id,
    });
    if (insErr) {
      logger.error("toggleBookmark insert failed", { chapterId, error: insErr.message });
      return { error: insErr.message };
    }
  }

  return { bookmarked: !existing };
}

// ── Chapter Ratings ──────────────────────────────────────────

export async function getChapterRatingState(
  chapterId: string
): Promise<{ average: number; count: number; userRating: number | null }> {
  const { supabase, user } = await getSessionUser();

  const statsPromise = supabase
    .from("v_chapter_rating_stats")
    .select("avg_rating, rating_count")
    .eq("chapter_id", chapterId)
    .maybeSingle();

  const userRatingPromise = user
    ? supabase
        .from("chapter_ratings")
        .select("rating")
        .eq("chapter_id", chapterId)
        .eq("user_id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [statsResult, userRatingResult] = await Promise.all([statsPromise, userRatingPromise]);
  const count = statsResult.data?.rating_count || 0;
  const average = Number(statsResult.data?.avg_rating || 0);
  const userRating = userRatingResult.data?.rating ?? null;

  return { average, count, userRating };
}

export async function rateChapter(
  chapterId: string,
  rating: number
): Promise<{ error?: string; average?: number; count?: number; userRating?: number }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "You must be logged in to rate." };
  if (rating < 1 || rating > 10) return { error: "Rating must be between 1 and 10." };

  const { data: existing } = await supabase
    .from("chapter_ratings")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("chapter_ratings")
      .update({ rating, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("chapter_ratings").insert({
      chapter_id: chapterId,
      user_id: user.id,
      rating,
    });
    if (error) return { error: error.message };
  }

  // Return updated stats
  const { data: all } = await supabase
    .from("chapter_ratings")
    .select("rating")
    .eq("chapter_id", chapterId);

  const list = all || [];
  const avg = list.length > 0 ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { average: Math.round(avg * 10) / 10, count: list.length, userRating: rating };
}

// ── Batch interaction state (single auth, parallel queries) ──

export async function getChapterInteractionState(
  chapterId: string,
  userId: string | null
): Promise<{
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
  ratingAverage: number;
  ratingCount: number;
  userRating: number | null;
}> {
  const supabase = await createClient();

  const likeCountPromise = supabase
    .from("chapter_likes")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);

  const ratingStatsPromise = supabase
    .from("v_chapter_rating_stats")
    .select("avg_rating, rating_count")
    .eq("chapter_id", chapterId)
    .maybeSingle();

  const likedPromise = userId
    ? supabase
        .from("chapter_likes")
        .select("id")
        .eq("chapter_id", chapterId)
        .eq("user_id", userId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const bookmarkedPromise = userId
    ? supabase
        .from("bookmarks")
        .select("id")
        .eq("chapter_id", chapterId)
        .eq("user_id", userId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const userRatingPromise = userId
    ? supabase
        .from("chapter_ratings")
        .select("rating")
        .eq("chapter_id", chapterId)
        .eq("user_id", userId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [likeCountResult, ratingStatsResult, likedResult, bookmarkedResult, userRatingResult] = await Promise.all([
    likeCountPromise,
    ratingStatsPromise,
    likedPromise,
    bookmarkedPromise,
    userRatingPromise,
  ]);

  const likeCount = likeCountResult.count ?? 0;
  const ratingCount = ratingStatsResult.data?.rating_count || 0;
  const ratingAverage = Number(ratingStatsResult.data?.avg_rating || 0);
  const liked = !!likedResult.data;
  const bookmarked = !!bookmarkedResult.data;
  const userRating = userRatingResult.data?.rating ?? null;

  return { likeCount, liked, bookmarked, ratingAverage, ratingCount, userRating };
}

export async function syncReadingProgress(input: {
  novelId: string;
  chapterId: string;
  chapterNumber: number;
  progressPercent: number;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { success: true };

  const chapterProgressPercent = Math.max(0, Math.min(100, Math.round(input.progressPercent)));

  // Persist progress at novel level so it reflects chapter advancement, not only current-page scroll.
  const [{ count: totalPublishedChapters }, { count: completedChapters }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .eq("novel_id", input.novelId)
      .eq("is_published", true),
    supabase
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .eq("novel_id", input.novelId)
      .eq("is_published", true)
      .lt("chapter_number", input.chapterNumber),
  ]);

  const total = totalPublishedChapters ?? 0;
  const completed = completedChapters ?? 0;
  const normalizedProgressPercent =
    total > 0
      ? Math.max(0, Math.min(100, Math.round(((completed + chapterProgressPercent / 100) / total) * 100)))
      : chapterProgressPercent;

  const { error } = await supabase.from("reading_progress").upsert(
    {
      user_id: user.id,
      novel_id: input.novelId,
      chapter_id: input.chapterId,
      chapter_number: input.chapterNumber,
      progress_percent: normalizedProgressPercent,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,novel_id" }
  );

  if (error) {
    logger.error("syncReadingProgress failed", {
      userId: user.id,
      novelId: input.novelId,
      chapterId: input.chapterId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}
