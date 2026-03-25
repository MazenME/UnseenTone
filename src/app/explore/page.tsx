import Navbar from "@/components/navbar";
import ExploreClient from "@/components/explore/explore-client";
import { createClient } from "@/lib/supabase/server";

interface NovelResult {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  created_at: string;
  last_read_progress: number | null;
}

interface ReadingProgressRow {
  novel_id: string;
  progress_percent: number;
}

async function getInitialNovels(): Promise<NovelResult[]> {
  const supabase = await createClient();
  const [{ data }, { data: authData }] = await Promise.all([
    supabase
      .from("novels")
      .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
      .order("total_reads", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.auth.getUser(),
  ]);

  const novels = (data ?? []) as Omit<NovelResult, "last_read_progress">[];
  const novelIds = novels.map((n) => n.id);

  let progressMap: Record<string, number> = {};
  const userId = authData.user?.id;
  if (userId && novelIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("reading_progress")
      .select("novel_id, progress_percent")
      .eq("user_id", userId)
      .in("novel_id", novelIds);

    progressMap = Object.fromEntries(
      ((progressRows || []) as ReadingProgressRow[]).map((row) => [row.novel_id, row.progress_percent])
    );
  }

  return novels.map((novel) => ({
    ...novel,
    last_read_progress: progressMap[novel.id] ?? null,
  }));
}

export default async function ExplorePage() {
  const initialNovels = await getInitialNovels();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <ExploreClient initialNovels={initialNovels} />
      </main>
    </>
  );
}
