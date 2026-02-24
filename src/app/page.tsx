import Navbar from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";

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

async function getNovels(): Promise<Novel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("novels")
    .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
    .order("created_at", { ascending: false });
  return (data as Novel[]) || [];
}

export default async function Home() {
  const novels = await getNovels();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center relative">
            <h1 className="text-5xl sm:text-7xl font-extrabold text-fg tracking-tight mb-6">
              Unseen<span className="text-accent">Tone</span>
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
                <Link
                  key={novel.id}
                  href={`/novel/${novel.slug}`}
                  className="group bg-surface border border-border rounded-2xl overflow-hidden hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
                >
                  {/* Cover */}
                  <div className="h-56 bg-bg-secondary relative overflow-hidden">
                    {novel.cover_url ? (
                      <img
                        src={novel.cover_url}
                        alt={novel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-fg-muted/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize backdrop-blur-sm ${
                          novel.status === "completed"
                            ? "bg-green-500/20 text-green-300 border border-green-500/30"
                            : novel.status === "hiatus"
                            ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                            : "bg-accent/20 text-accent border border-accent/30"
                        }`}
                      >
                        {novel.status}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-fg group-hover:text-accent transition-colors line-clamp-1">
                      {novel.title}
                    </h3>
                    {novel.synopsis && (
                      <p className="text-sm text-fg-muted mt-2 line-clamp-2 leading-relaxed">
                        {novel.synopsis}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-4 text-xs text-fg-muted">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {novel.total_reads.toLocaleString()} reads
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-fg-muted">
            <p>&copy; {new Date().getFullYear()} UnseenTone. All worlds reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
