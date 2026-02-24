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
