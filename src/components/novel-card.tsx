import Image from "next/image";
import Link from "next/link";

export interface NovelCardData {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  cover_url: string | null;
  status: string;
  total_reads: number;
  last_read_progress?: number | null;
  novel_avg_rating?: number;
  novel_rating_count?: number;
  chapter_avg_rating?: number;
  chapter_rating_count?: number;
}

export default function NovelCard({ novel }: { novel: NovelCardData }) {
  return (
    <Link
      href={`/novel/${novel.slug}`}
      className="group bg-surface border border-border rounded-2xl overflow-hidden hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
    >
      <div className="h-56 bg-bg-secondary relative overflow-hidden">
        {novel.cover_url ? (
          <Image
            src={novel.cover_url}
            alt={novel.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-fg-muted/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
        )}

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

        {novel.last_read_progress !== null && novel.last_read_progress !== undefined && (
          <div className="absolute top-3 left-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-bg/75 text-fg border border-border/80 backdrop-blur-sm">
              Last read {novel.last_read_progress}%
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-lg font-bold text-fg group-hover:text-accent transition-colors line-clamp-1">
          {novel.title}
        </h3>
        {novel.synopsis && (
          <p className="text-sm text-fg-muted mt-2 line-clamp-2 leading-relaxed">
            {novel.synopsis}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {novel.total_reads.toLocaleString()} reads
          </span>

          {Number(novel.novel_avg_rating || 0) > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
              </svg>
              <span className="text-amber-400 font-medium">{Number(novel.novel_avg_rating || 0).toFixed(1)}</span>/10
              <span className="text-fg-muted/50">({novel.novel_rating_count || 0})</span>
            </span>
          )}

          {Number(novel.chapter_avg_rating || 0) > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-amber-400/70" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
              </svg>
              <span>{Number(novel.chapter_avg_rating || 0).toFixed(1)}</span>/10 ch.
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
