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
  users_profile: {
    id: string;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export async function getChapterComments(chapterId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, user_id, users_profile(id, display_name, email, avatar_url)")
    .eq("chapter_id", chapterId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getChapterComments:", error.message);
    return [];
  }
  return (data as unknown as CommentRow[]) || [];
}

export async function submitComment(
  chapterId: string,
  body: string,
  turnstileToken: string
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
  });

  if (error) return { error: error.message };
  return { success: true };
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
