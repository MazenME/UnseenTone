import Navbar from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import NovelCard from "@/components/novel-card";

interface Novel {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  created_at: string;
  novel_avg_rating: number;
  novel_rating_count: number;
  chapter_avg_rating: number;
  chapter_rating_count: number;
  last_read_progress: number | null;
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

interface NovelRatingStatRow {
  novel_id: string;
  avg_rating: number | null;
  rating_count: number;
}

interface ReadingProgressRow {
  novel_id: string;
  progress_percent: number;
}

async function getNovels(): Promise<Novel[]> {
  const supabase = await createClient();
  const [{ data }, { data: authData }] = await Promise.all([
    supabase
      .from("novels")
      .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const novels = (data || []) as NovelRow[];
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

  const { data: novelStats } = novelIds.length
    ? await supabase
        .from("v_novel_rating_stats")
        .select("novel_id, avg_rating, rating_count")
        .in("novel_id", novelIds)
    : { data: null };

  const { data: chapterStats } = novelIds.length
    ? await supabase
        .from("v_novel_chapter_rating_stats")
        .select("novel_id, avg_rating, rating_count")
        .in("novel_id", novelIds)
    : { data: null };

  const nrMap = Object.fromEntries(
    ((novelStats || []) as NovelRatingStatRow[]).map((row) => [
      row.novel_id,
      { avg: Number(row.avg_rating || 0), count: row.rating_count || 0 },
    ])
  );

  const crMap = Object.fromEntries(
    ((chapterStats || []) as NovelRatingStatRow[]).map((row) => [
      row.novel_id,
      { avg: Number(row.avg_rating || 0), count: row.rating_count || 0 },
    ])
  );

  return novels.map((n) => ({
    ...n,
    novel_avg_rating: nrMap[n.id]?.avg || 0,
    novel_rating_count: nrMap[n.id]?.count || 0,
    chapter_avg_rating: crMap[n.id]?.avg || 0,
    chapter_rating_count: crMap[n.id]?.count || 0,
    last_read_progress: progressMap[n.id] ?? null,
  }));
}

export default async function Home() {
  const novels = await getNovels();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center relative">
            <h1 className="text-5xl sm:text-7xl font-extrabold text-fg tracking-tight mb-6">
              Kath<span className="text-accent">ion</span>
            </h1>
            <p className="text-lg sm:text-xl text-fg-muted max-w-2xl mx-auto leading-relaxed mb-10">
              Descend into a dark fantasy universe where forgotten gods whisper through
              the pages and every chapter pulls you deeper into the abyss.
            </p>
            {novels.length > 0 && (
              <a
                href="#library"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                Browse the Library
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </a>
            )}
          </div>
        </section>

        {/* Novel Library */}
        <section id="library" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-fg">Library</h2>
            <span className="text-sm text-fg-muted">
              {novels.length} novel{novels.length !== 1 ? "s" : ""}
            </span>
          </div>

          {novels.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl px-8 py-20 text-center">
              <svg className="w-16 h-16 mx-auto text-fg-muted/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <p className="text-fg-muted text-lg">The library is empty.</p>
              <p className="text-fg-muted/60 text-sm mt-1">Novels will appear here once published.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {novels.map((novel) => (
                <NovelCard key={novel.id} novel={novel} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-fg-muted">
            <p>&copy; {new Date().getFullYear()} Kathion. All worlds reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
