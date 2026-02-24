import { createClient } from "@/lib/supabase/server";
import NovelManager from "@/components/dashboard/novel-manager";

export default async function NovelsPage() {
  const supabase = await createClient();

  const [{ data: novels }, { data: novelRatings }, { data: chapterRatings }] = await Promise.all([
    supabase.from("novels").select("*").order("created_at", { ascending: false }),
    supabase.from("novel_ratings").select("novel_id, rating"),
    supabase.from("chapter_ratings").select("rating, chapters(novel_id)"),
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
