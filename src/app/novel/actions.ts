"use server";

import { createClient } from "@/lib/supabase/server";

// ── Novel Favourites ─────────────────────────────────────────

export async function getNovelFavouriteState(
  novelId: string
): Promise<{ favourited: boolean; count: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = await supabase
    .from("novel_favourites")
    .select("*", { count: "exact", head: true })
    .eq("novel_id", novelId);

  let favourited = false;
  if (user) {
    const { data } = await supabase
      .from("novel_favourites")
      .select("id")
      .eq("novel_id", novelId)
      .eq("user_id", user.id)
      .maybeSingle();
    favourited = !!data;
  }

  return { favourited, count: count ?? 0 };
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
    .select("*", { count: "exact", head: true })
    .eq("novel_id", novelId);

  return { favourited: !existing, count: count ?? 0 };
}

// ── Novel Ratings ────────────────────────────────────────────

export async function getNovelRatingState(
  novelId: string
): Promise<{ average: number; count: number; userRating: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ratings } = await supabase
    .from("novel_ratings")
    .select("rating")
    .eq("novel_id", novelId);

  const all = ratings || [];
  const count = all.length;
  const average = count > 0 ? all.reduce((s, r) => s + r.rating, 0) / count : 0;

  let userRating: number | null = null;
  if (user) {
    const { data } = await supabase
      .from("novel_ratings")
      .select("rating")
      .eq("novel_id", novelId)
      .eq("user_id", user.id)
      .maybeSingle();
    userRating = data?.rating ?? null;
  }

  return { average: Math.round(average * 10) / 10, count, userRating };
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
