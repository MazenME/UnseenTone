"use server";

import { createClient } from "@/lib/supabase/server";

type QueryResult = { data?: unknown; count?: number | null };
type NovelRatingStatsRow = { avg_rating: number | null; rating_count: number };
type UserRatingRow = { rating: number };

// ── Novel Favourites ─────────────────────────────────────────

export async function getNovelFavouriteState(
  novelId: string
): Promise<{ favourited: boolean; count: number }> {
  const supabase = await createClient();
  // Fast path: read session from cookie (no network call) for read-only operation
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Parallelize count + user check
  const queries: PromiseLike<QueryResult>[] = [
    supabase
      .from("novel_favourites")
      .select("id", { count: "exact", head: true })
      .eq("novel_id", novelId),
  ];
  if (user) {
    queries.push(
      supabase
        .from("novel_favourites")
        .select("id")
        .eq("novel_id", novelId)
        .eq("user_id", user.id)
        .maybeSingle()
    );
  }

  const results = await Promise.all(queries);
  const count = results[0].count ?? 0;
  const favourited = user ? !!results[1].data : false;

  return { favourited, count };
}

export async function toggleNovelFavourite(
  novelId: string
): Promise<{ error?: string; favourited?: boolean; count?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to favourite novels." };

  const { data: existing, error: selectErr } = await supabase
    .from("novel_favourites")
    .select("id")
    .eq("novel_id", novelId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectErr) {
    console.error("toggleNovelFavourite select:", selectErr.message);
    return { error: selectErr.message };
  }

  if (existing) {
    const { error: delErr } = await supabase.from("novel_favourites").delete().eq("id", existing.id);
    if (delErr) {
      console.error("toggleNovelFavourite delete:", delErr.message);
      return { error: delErr.message };
    }
  } else {
    const { error: insErr } = await supabase.from("novel_favourites").insert({
      novel_id: novelId,
      user_id: user.id,
    });
    if (insErr) {
      console.error("toggleNovelFavourite insert:", insErr.message);
      return { error: insErr.message };
    }
  }

  const { count } = await supabase
    .from("novel_favourites")
    .select("id", { count: "exact", head: true })
    .eq("novel_id", novelId);

  return { favourited: !existing, count: count ?? 0 };
}

// ── Novel Ratings ────────────────────────────────────────────

export async function getNovelRatingState(
  novelId: string
): Promise<{ average: number; count: number; userRating: number | null }> {
  const supabase = await createClient();
  // Fast path: read session from cookie (no network call) for read-only operation
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Parallelize aggregate rating fetch + user rating check
  const queries: PromiseLike<QueryResult>[] = [
    supabase
      .from("v_novel_rating_stats")
      .select("avg_rating, rating_count")
      .eq("novel_id", novelId)
      .maybeSingle(),
  ];
  if (user) {
    queries.push(
      supabase
        .from("novel_ratings")
        .select("rating")
        .eq("novel_id", novelId)
        .eq("user_id", user.id)
        .maybeSingle()
    );
  }

  const results = await Promise.all(queries);
  const ratingStats = (results[0].data as NovelRatingStatsRow | null) ?? null;
  const userRatingRow = user ? ((results[1].data as UserRatingRow | null) ?? null) : null;
  const count = ratingStats?.rating_count || 0;
  const average = Number(ratingStats?.avg_rating || 0);
  const userRating = user ? (userRatingRow?.rating ?? null) : null;

  return { average, count, userRating };
}

export async function rateNovel(
  novelId: string,
  rating: number
): Promise<{ error?: string; average?: number; count?: number; userRating?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to rate." };
  if (rating < 1 || rating > 10) return { error: "Rating must be between 1 and 10." };

  const { data: existing } = await supabase
    .from("novel_ratings")
    .select("id")
    .eq("novel_id", novelId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("novel_ratings")
      .update({ rating, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("novel_ratings").insert({
      novel_id: novelId,
      user_id: user.id,
      rating,
    });
    if (error) return { error: error.message };
  }

  const { data: all } = await supabase
    .from("novel_ratings")
    .select("rating")
    .eq("novel_id", novelId);

  const list = all || [];
  const avg = list.length > 0 ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { average: Math.round(avg * 10) / 10, count: list.length, userRating: rating };
}

// ── Batch interaction state (single client, parallel queries) ──

export async function getNovelInteractionState(
  novelId: string,
  userId: string | null
): Promise<{
  favourited: boolean;
  favouriteCount: number;
  ratingAverage: number;
  ratingCount: number;
  userRating: number | null;
}> {
  const supabase = await createClient();

  const queries: PromiseLike<QueryResult>[] = [
    // 0 – favourite count
    supabase
      .from("novel_favourites")
      .select("id", { count: "exact", head: true })
      .eq("novel_id", novelId),
    // 1 – rating aggregate
    supabase
      .from("v_novel_rating_stats")
      .select("avg_rating, rating_count")
      .eq("novel_id", novelId)
      .maybeSingle(),
  ];

  if (userId) {
    // 2 – user favourited?
    queries.push(
      supabase
        .from("novel_favourites")
        .select("id")
        .eq("novel_id", novelId)
        .eq("user_id", userId)
        .maybeSingle()
    );
    // 3 – user rating
    queries.push(
      supabase
        .from("novel_ratings")
        .select("rating")
        .eq("novel_id", novelId)
        .eq("user_id", userId)
        .maybeSingle()
    );
  }

  const results = await Promise.all(queries);

  const favouriteCount = results[0].count ?? 0;
  const ratingStats = (results[1].data as NovelRatingStatsRow | null) ?? null;
  const ratingCount = ratingStats?.rating_count || 0;
  const ratingAverage = Number(ratingStats?.avg_rating || 0);

  let favourited = false;
  let userRating: number | null = null;

  if (userId) {
    favourited = !!results[2].data;
    userRating = ((results[3].data as UserRatingRow | null) ?? null)?.rating ?? null;
  }

  return { favourited, favouriteCount, ratingAverage, ratingCount, userRating };
}
