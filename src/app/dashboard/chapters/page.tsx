import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ChapterList from "@/components/dashboard/chapter-list";

type ChapterRow = {
  id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  word_count: number;
  is_published: boolean;
  reads: number;
  text_direction: "ltr" | "rtl";
  created_at: string;
  novels: { title: string }[] | { title: string } | null;
};

type ChapterListRow = Omit<ChapterRow, "novels"> & { novels: { title: string } | null };

type NovelRow = {
  id: string;
  title: string;
};

export default async function ChaptersPage() {
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
    allowedNovelIds = (rows || []).map((r: { novel_id: string }) => r.novel_id);
    if (!allowedNovelIds.length) return <ChapterList initialChapters={[]} novels={[]} />;
  }

  const chaptersQuery = supabase
    .from("chapters")
    .select("id, novel_id, chapter_number, title, word_count, is_published, reads, text_direction, created_at, novels(title)")
    .order("created_at", { ascending: false });
  const novelsQuery = supabase.from("novels").select("id, title").order("title");

  const [{ data: chapters }, { data: novels }] = await Promise.all([
    role === "novel_admin" && allowedNovelIds ? chaptersQuery.in("novel_id", allowedNovelIds) : chaptersQuery,
    role === "novel_admin" && allowedNovelIds ? novelsQuery.in("id", allowedNovelIds) : novelsQuery,
  ]);

  const normalizedChapters: ChapterListRow[] = ((chapters || []) as ChapterRow[]).map((chapter) => ({
    ...chapter,
    novels: Array.isArray(chapter.novels) ? chapter.novels[0] ?? null : chapter.novels,
  }));

  return <ChapterList initialChapters={normalizedChapters} novels={(novels || []) as NovelRow[]} />;
}
