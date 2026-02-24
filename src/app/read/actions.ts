"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { commentRateLimit, likeRateLimit, bookmarkRateLimit } from "@/lib/redis";

// ── Helpers ──────────────────────────────────────────────────

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
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

// ── Comments ─────────────────────────────────────────────────

export interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  likes: number;
  dislikes: number;
  user_reaction: "like" | "dislike" | null;
  users_profile: {
    id: string;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  replies?: CommentRow[];
}

export async function getChapterComments(chapterId: string): Promise<CommentRow[]> {
  const { supabase, user } = await getUser();
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, user_id, parent_id, users_profile(id, display_name, email, avatar_url)")
    .eq("chapter_id", chapterId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getChapterComments:", error.message);
    return [];
  }

  const raw = (data as unknown as any[]) || [];

  // Fetch reaction counts for all comment IDs
  const commentIds = raw.map((c) => c.id);
  let reactionCounts: Record<string, { likes: number; dislikes: number }> = {};
  let userReactions: Record<string, "like" | "dislike"> = {};

  if (commentIds.length > 0) {
    const { data: reactions } = await supabase
      .from("comment_reactions")
      .select("comment_id, reaction_type")
      .in("comment_id", commentIds);

    for (const r of reactions || []) {
      if (!reactionCounts[r.comment_id]) reactionCounts[r.comment_id] = { likes: 0, dislikes: 0 };
      if (r.reaction_type === "like") reactionCounts[r.comment_id].likes++;
      else reactionCounts[r.comment_id].dislikes++;
    }

    if (user) {
      const { data: myReactions } = await supabase
        .from("comment_reactions")
        .select("comment_id, reaction_type")
        .in("comment_id", commentIds)
        .eq("user_id", user.id);

      for (const r of myReactions || []) {
        userReactions[r.comment_id] = r.reaction_type as "like" | "dislike";
      }
    }
  }

  const enriched: CommentRow[] = raw.map((c) => ({
    ...c,
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

  return topLevel;
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

  // 6. Insert
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

  // Get updated counts
  const { count: likes } = await supabase
    .from("comment_reactions")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("reaction_type", "like");

  const { count: dislikes } = await supabase
    .from("comment_reactions")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("reaction_type", "dislike");

  return { likes: likes ?? 0, dislikes: dislikes ?? 0, user_reaction: newReaction };
}

// ── Likes ────────────────────────────────────────────────────

export async function getChapterLikeState(
  chapterId: string
): Promise<{ count: number; liked: boolean }> {
  const { supabase, user } = await getUser();

  const { count } = await supabase
    .from("chapter_likes")
    .select("*", { count: "exact", head: true })
    .eq("chapter_id", chapterId);

  let liked = false;
  if (user) {
    const { data } = await supabase
      .from("chapter_likes")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("user_id", user.id)
      .maybeSingle();
    liked = !!data;
  }

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
    .select("*", { count: "exact", head: true })
    .eq("chapter_id", chapterId);

  return { liked: !existing, count: count ?? 0 };
}

// ── Bookmarks ────────────────────────────────────────────────

export async function getBookmarkState(
  chapterId: string
): Promise<{ bookmarked: boolean }> {
  const { supabase, user } = await getUser();
  if (!user) return { bookmarked: false };

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) console.error("getBookmarkState:", error.message);
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
    console.error("toggleBookmark select:", selectErr.message);
    return { error: selectErr.message };
  }

  if (existing) {
    const { error: delErr } = await supabase.from("bookmarks").delete().eq("id", existing.id);
    if (delErr) {
      console.error("toggleBookmark delete:", delErr.message);
      return { error: delErr.message };
    }
  } else {
    const { error: insErr } = await supabase.from("bookmarks").insert({
      chapter_id: chapterId,
      user_id: user.id,
    });
    if (insErr) {
      console.error("toggleBookmark insert:", insErr.message);
      return { error: insErr.message };
    }
  }

  return { bookmarked: !existing };
}

// ── Chapter Ratings ──────────────────────────────────────────

export async function getChapterRatingState(
  chapterId: string
): Promise<{ average: number; count: number; userRating: number | null }> {
  const { supabase, user } = await getUser();

  const { data: ratings } = await supabase
    .from("chapter_ratings")
    .select("rating")
    .eq("chapter_id", chapterId);

  const all = ratings || [];
  const count = all.length;
  const average = count > 0 ? all.reduce((s, r) => s + r.rating, 0) / count : 0;

  let userRating: number | null = null;
  if (user) {
    const { data } = await supabase
      .from("chapter_ratings")
      .select("rating")
      .eq("chapter_id", chapterId)
      .eq("user_id", user.id)
      .maybeSingle();
    userRating = data?.rating ?? null;
  }

  return { average: Math.round(average * 10) / 10, count, userRating };
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
