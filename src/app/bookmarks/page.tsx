import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/navbar";
import Link from "next/link";

interface BookmarkRow {
  id: string;
  created_at: string;
  chapters: {
    id: string;
    title: string;
    chapter_number: number;
    novels: {
      title: string;
      slug: string;
    };
  };
}

export default async function BookmarksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/bookmarks");

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, created_at, chapters(id, title, chapter_number, novels(title, slug))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const bookmarks = (error ? [] : (data as unknown as BookmarkRow[])) || [];

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          <div>
            <h1 className="text-2xl font-bold text-fg">Bookmarks</h1>
            <p className="text-sm text-fg-muted">Chapters you&apos;ve saved for later</p>
          </div>
        </div>

        {/* List */}
        {bookmarks.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
            <svg className="w-12 h-12 text-fg-muted/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            <p className="text-fg-muted text-sm">No bookmarks yet.</p>
            <p className="text-fg-muted/60 text-xs mt-1">
              Bookmark chapters while reading to save your place.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((b) => (
              <Link
                key={b.id}
                href={`/read/${b.chapters.id}`}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-all group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-accent">
                    {b.chapters.chapter_number}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg group-hover:text-accent transition-colors truncate">
                    {b.chapters.title}
                  </p>
                  <p className="text-xs text-fg-muted truncate">
                    {b.chapters.novels.title} &middot; Chapter {b.chapters.chapter_number}
                  </p>
                </div>

                {/* Date */}
                <span className="text-xs text-fg-muted flex-shrink-0 hidden sm:block">
                  {new Date(b.created_at).toLocaleDateString()}
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
