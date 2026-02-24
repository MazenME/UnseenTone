import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/navbar";
import NovelFavouriteButton from "@/components/novel-favourite-button";
import NovelRating from "@/components/novel-rating";
import { getNovelFavouriteState, getNovelRatingState } from "@/app/novel/actions";

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  word_count: number;
  reads: number;
  created_at: string;
}

interface Novel {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  created_at: string;
}

async function getNovelBySlug(slug: string) {
  const supabase = await createClient();

  const { data: novel } = await supabase
    .from("novels")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!novel) return null;

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, word_count, reads, created_at")
    .eq("novel_id", novel.id)
    .eq("is_published", true)
    .order("chapter_number", { ascending: true });

  return { novel: novel as Novel, chapters: (chapters as Chapter[]) || [] };
}

export default async function NovelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getNovelBySlug(slug);

  if (!result) notFound();

  const { novel, chapters } = result;

  const supabase2 = await createClient();
  const { data: { user } } = await supabase2.auth.getUser();
  const userId = user?.id ?? null;
  const [{ favourited, count }, ratingState] = await Promise.all([
    getNovelFavouriteState(novel.id),
    getNovelRatingState(novel.id),
  ]);

  // Aggregate chapter ratings for this novel (total + per-chapter)
  const chapterIds = chapters.map((c) => c.id);
  let chapterRatingAvg = 0;
  let chapterRatingCount = 0;
  const perChapterRating: Record<string, { avg: number; count: number }> = {};
  if (chapterIds.length > 0) {
    const { data: crRaw } = await supabase2
      .from("chapter_ratings")
      .select("chapter_id, rating")
      .in("chapter_id", chapterIds);
    const crAll = crRaw || [];
    chapterRatingCount = crAll.length;
    chapterRatingAvg = chapterRatingCount > 0
      ? Math.round((crAll.reduce((s, r) => s + r.rating, 0) / chapterRatingCount) * 10) / 10
      : 0;
    // Per-chapter aggregation
    const byChapter: Record<string, number[]> = {};
    for (const r of crAll) {
      if (!byChapter[r.chapter_id]) byChapter[r.chapter_id] = [];
      byChapter[r.chapter_id].push(r.rating);
    }
    for (const [cid, ratings] of Object.entries(byChapter)) {
      const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
      perChapterRating[cid] = { avg: Math.round(avg * 10) / 10, count: ratings.length };
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero Banner */}
        <section className="relative">
          {novel.cover_url && (
            <div className="fixed inset-x-0 top-0 h-screen -z-10">
              <img
                src={novel.cover_url}
                alt=""
                className="w-full h-full object-fill object-center "
              />
              <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg" />
            </div>
          )}

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-32 pb-8">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              {/* Cover Thumbnail */}
              {novel.cover_url && (
                <div className="w-40 sm:w-52 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border border-border">
                  <img
                    src={novel.cover_url}
                    alt={novel.title}
                    className="w-full aspect-[2/3] object-cover"
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                      novel.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : novel.status === "hiatus"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-accent/20 text-accent"
                    }`}
                  >
                    {novel.status}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-fg mb-3">
                  {novel.title}
                </h1>
                {novel.synopsis && (
                  <p className="text-fg-muted leading-relaxed mb-4 max-w-2xl">
                    {novel.synopsis}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {novel.total_reads.toLocaleString()} reads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(novel.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Start Reading CTA + Favourite */}
                <div className="flex flex-wrap items-center gap-4 mt-6">
                  {chapters.length > 0 && (
                    <Link
                      href={`/read/${chapters[0].id}`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
                    >
                      Start Reading
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  )}
                  <NovelFavouriteButton
                    novelId={novel.id}
                    userId={userId}
                    initialFavourited={favourited}
                    initialCount={count}
                  />
                </div>

                {/* Novel Rating */}
                <NovelRating
                  novelId={novel.id}
                  userId={userId}
                  initialAverage={ratingState.average}
                  initialCount={ratingState.count}
                  initialUserRating={ratingState.userRating}
                />

                {/* Chapter Ratings Aggregate */}
                {chapterRatingCount > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-fg-muted uppercase tracking-wider">Chapters Rating</span>
                    <div className="flex items-center gap-1.5 text-sm">
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
                      </svg>
                      <span className="font-semibold text-amber-400">{chapterRatingAvg.toFixed(1)}</span>
                      <span className="text-fg-muted text-xs">/10 &middot; {chapterRatingCount} {chapterRatingCount === 1 ? "rating" : "ratings"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Chapters List */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
          <h2 className="text-xl font-bold text-fg mb-6">Chapters</h2>

          {chapters.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl px-6 py-12 text-center">
              <p className="text-fg-muted">No chapters published yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((chapter, index) => (
                <Link
                  key={chapter.id}
                  href={`/read/${chapter.id}`}
                  className="group flex items-center gap-4 p-4 bg-surface border border-border rounded-xl hover:border-accent/50 hover:bg-surface/80 transition-all"
                >
                  {/* Chapter Number */}
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-accent">{chapter.chapter_number}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-fg group-hover:text-accent transition-colors truncate">
                      {chapter.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-fg-muted flex-wrap">
                      <span>{chapter.word_count.toLocaleString()} words</span>
                      <span>&middot;</span>
                      <span>{chapter.reads.toLocaleString()} reads</span>
                      {perChapterRating[chapter.id] && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
                            </svg>
                            <span className="text-amber-400 font-medium">{perChapterRating[chapter.id].avg.toFixed(1)}</span>/10
                            <span className="text-fg-muted/50">({perChapterRating[chapter.id].count})</span>
                          </span>
                        </>
                      )}
                      <span>&middot;</span>
                      <span>{new Date(chapter.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-fg-muted group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}

          {/* Back link */}
          <div className="mt-8">
            <Link href="/" className="text-sm text-fg-muted hover:text-accent transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Library
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
