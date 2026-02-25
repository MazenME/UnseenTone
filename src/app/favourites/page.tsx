import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/navbar";
import Link from "next/link";

interface LikeRow {
  id: string;
  created_at: string;
  chapters: {
    id: string;
    title: string;
    chapter_number: number;
    word_count: number;
    novels: {
      title: string;
      slug: string;
    };
  };
}

interface NovelFavRow {
  id: string;
  created_at: string;
  novels: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    status: string;
    total_reads: number;
  };
}

export default async function FavouritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/favourites");

  const { data, error } = await supabase
    .from("chapter_likes")
    .select("id, created_at, chapters(id, title, chapter_number, word_count, novels(title, slug))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favourites = (error ? [] : (data as unknown as LikeRow[])) || [];

  const { data: novelData, error: novelErr } = await supabase
    .from("novel_favourites")
    .select("id, created_at, novels(id, title, slug, cover_url, status, total_reads)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const novelFavourites = (novelErr ? [] : (novelData as unknown as NovelFavRow[])) || [];

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <div>
            <h1 className="text-2xl font-bold text-fg">Favourites</h1>
            <p className="text-sm text-fg-muted">Chapters you&apos;ve liked</p>
          </div>
        </div>

        {/* Novel Favourites */}
        <h2 className="text-lg font-bold text-fg mb-4">Favourite Novels</h2>
        {novelFavourites.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl px-6 py-10 text-center mb-10">
            <p className="text-fg-muted text-sm">No favourite novels yet.</p>
            <p className="text-fg-muted/60 text-xs mt-1">
              Favourite a novel on its page and it&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {novelFavourites.map((nf) => (
              <Link
                key={nf.id}
                href={`/novel/${nf.novels.slug}`}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-all group"
              >
                {nf.novels.cover_url ? (
                  <img
                    src={nf.novels.cover_url}
                    alt={nf.novels.title}
                    className="w-12 h-16 rounded-lg object-cover flex-shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-12 h-16 rounded-lg bg-accent/10 border border-border flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg group-hover:text-accent transition-colors truncate">
                    {nf.novels.title}
                  </p>
                  <p className="text-xs text-fg-muted capitalize">{nf.novels.status}</p>
                  <p className="text-xs text-fg-muted">{nf.novels.total_reads.toLocaleString()} reads</p>
                </div>
                <svg className="w-4 h-4 text-fg-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Chapter Favourites */}
        <h2 className="text-lg font-bold text-fg mb-4">Favourite Chapters</h2>
        {/* List */}
        {favourites.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
            <svg className="w-12 h-12 text-fg-muted/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <p className="text-fg-muted text-sm">No favourite chapters yet.</p>
            <p className="text-fg-muted/60 text-xs mt-1">
              Like chapters while reading and they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {favourites.map((f) => (
              <Link
                key={f.id}
                href={`/read/${f.chapters.id}`}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-all group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg group-hover:text-accent transition-colors truncate">
                    {f.chapters.title}
                  </p>
                  <p className="text-xs text-fg-muted truncate">
                    {f.chapters.novels.title} &middot; Chapter {f.chapters.chapter_number}
                    {f.chapters.word_count > 0 && ` · ${f.chapters.word_count.toLocaleString()} words`}
                  </p>
                </div>

                {/* Date */}
                <span className="text-xs text-fg-muted flex-shrink-0 hidden sm:block">
                  {new Date(f.created_at).toLocaleDateString()}
                </span>

                {/* Arrow */}
                <svg className="w-4 h-4 text-fg-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
