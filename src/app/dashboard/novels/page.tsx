import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NovelManager from "@/components/dashboard/novel-manager";

interface NovelAdminRow {
  novel_id: string;
}

interface NovelRow {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  created_at: string;
}

interface RatingStatRow {
  novel_id: string;
  avg_rating: number | null;
  rating_count: number;
}

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
    allowedNovelIds = ((rows || []) as NovelAdminRow[]).map((r) => r.novel_id);
    if (!allowedNovelIds.length) return <NovelManager initialNovels={[]} />;
  }

  const novelQuery = supabase
    .from("novels")
    .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
    .order("created_at", { ascending: false });

  const { data: novels } =
    role === "novel_admin" && allowedNovelIds ? await novelQuery.in("id", allowedNovelIds) : await novelQuery;

  const novelRows = (novels || []) as NovelRow[];
  const novelIds = novelRows.map((n) => n.id);
  let nrMap: Record<string, { avg: number; count: number }> = {};
  let crMap: Record<string, { avg: number; count: number }> = {};

  if (novelIds.length > 0) {
    const [{ data: novelStats }, { data: chapterStats }] = await Promise.all([
      supabase
        .from("v_novel_rating_stats")
        .select("novel_id, avg_rating, rating_count")
        .in("novel_id", novelIds),
      supabase
        .from("v_novel_chapter_rating_stats")
        .select("novel_id, avg_rating, rating_count")
        .in("novel_id", novelIds),
    ]);

    nrMap = Object.fromEntries(
      ((novelStats || []) as RatingStatRow[]).map((row) => [
        row.novel_id,
        { avg: Number(row.avg_rating || 0), count: row.rating_count || 0 },
      ])
    );

    crMap = Object.fromEntries(
      ((chapterStats || []) as RatingStatRow[]).map((row) => [
        row.novel_id,
        { avg: Number(row.avg_rating || 0), count: row.rating_count || 0 },
      ])
    );
  }

  const enriched = novelRows.map((n) => ({
    ...n,
    novel_avg_rating: nrMap[n.id]?.avg || 0,
    novel_rating_count: nrMap[n.id]?.count || 0,
    chapter_avg_rating: crMap[n.id]?.avg || 0,
    chapter_rating_count: crMap[n.id]?.count || 0,
  }));

  return <NovelManager initialNovels={enriched} />;
}
