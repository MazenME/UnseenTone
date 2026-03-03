import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NovelManager from "@/components/dashboard/novel-manager";

export default async function NovelsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role")
    .eq("id", user?.id)
    .single();

  const role = profile?.role === "admin" ? "super_admin" : profile?.role;
  let allowedNovelIds: string[] | null = null;

  if (role === "novel_admin" && user?.id) {
    const { data: rows } = await admin.from("novel_admins").select("novel_id").eq("admin_id", user.id);
    allowedNovelIds = (rows || []).map((r: any) => r.novel_id);
    if (!allowedNovelIds.length) return <NovelManager initialNovels={[]} />;
  }

  const novelQuery = supabase.from("novels").select("*").order("created_at", { ascending: false });
  const novelRatingsQuery = supabase.from("novel_ratings").select("novel_id, rating");
  const chapterRatingsQuery = supabase.from("chapter_ratings").select("rating, chapters(novel_id)");

  const [{ data: novels }, { data: novelRatings }, { data: chapterRatings }] = await Promise.all([
    role === "novel_admin" && allowedNovelIds ? novelQuery.in("id", allowedNovelIds) : novelQuery,
    role === "novel_admin" && allowedNovelIds ? novelRatingsQuery.in("novel_id", allowedNovelIds) : novelRatingsQuery,
    role === "novel_admin" && allowedNovelIds
      ? chapterRatingsQuery.in("chapters.novel_id", allowedNovelIds)
      : chapterRatingsQuery,
  ]);

  // Aggregate novel ratings
  const nrMap: Record<string, { sum: number; count: number }> = {};
  for (const r of (novelRatings || []) as any[]) {
    if (!nrMap[r.novel_id]) nrMap[r.novel_id] = { sum: 0, count: 0 };
    nrMap[r.novel_id].sum += r.rating;
    nrMap[r.novel_id].count += 1;
  }

  // Aggregate chapter ratings by novel
  const crMap: Record<string, { sum: number; count: number }> = {};
  for (const r of (chapterRatings || []) as any[]) {
    const nid = r.chapters?.novel_id;
    if (!nid) continue;
    if (!crMap[nid]) crMap[nid] = { sum: 0, count: 0 };
    crMap[nid].sum += r.rating;
    crMap[nid].count += 1;
  }

  const enriched = (novels || []).map((n: any) => ({
    ...n,
    novel_avg_rating: nrMap[n.id] ? Math.round((nrMap[n.id].sum / nrMap[n.id].count) * 10) / 10 : 0,
    novel_rating_count: nrMap[n.id]?.count || 0,
    chapter_avg_rating: crMap[n.id] ? Math.round((crMap[n.id].sum / crMap[n.id].count) * 10) / 10 : 0,
    chapter_rating_count: crMap[n.id]?.count || 0,
  }));

  return <NovelManager initialNovels={enriched} />;
}
