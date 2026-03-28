import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Image from "next/image";
import Link from "next/link";
import { formatDateShort } from "@/lib/date";
import ChapterPaginationHotkeys from "@/components/dashboard/chapter-pagination-hotkeys";

interface NovelAnalytics {
  id: string;
  title: string;
  slug: string;
  status: string;
  total_reads: number;
  created_at: string;
  cover_url: string | null;
  chapter_count: number;
  total_words: number;
  total_comments: number;
  novel_avg_rating: number;
  novel_rating_count: number;
  chapter_avg_rating: number;
  chapter_rating_count: number;
  recent_novel_raters?: {
    user_id: string;
    display_name: string;
    rating: number;
    created_at: string;
  }[];
  recent_readers?: {
    user_id: string;
    display_name: string;
    progress_percent: number;
    last_read_at: string;
  }[];
  chapters: {
    id: string;
    chapter_number: number;
    title: string;
    reads: number;
    word_count: number;
    comment_count: number;
    created_at: string;
    avg_rating: number;
    rating_count: number;
  }[];
}

interface NovelAdminRow {
  novel_id: string;
}

interface DashboardAnalyticsPayload {
  totalUsers: number;
  totalNovels: number;
  totalReads: number;
  totalComments: number;
  novelAnalytics: NovelAnalytics[];
}

interface NovelRatingRow {
  novel_id: string;
  user_id: string;
  rating: number;
  created_at: string;
}

interface ReadingProgressRow {
  novel_id: string;
  user_id: string;
  progress_percent: number;
  last_read_at: string;
}

interface UserProfileLite {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface DashboardSearchParams {
  novelsPage?: string;
  novelsPerPage?: string;
  chaptersPage?: string;
  chaptersPerPage?: string;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

async function getAnalytics() {
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

  const role = profile?.role === "admin" ? "super_admin" : profile?.role || "reader";

  let allowedNovelIds: string[] | null = null;
  if (role === "novel_admin" && user?.id) {
    const { data: rows } = await admin.from("novel_admins").select("novel_id").eq("admin_id", user.id);
    allowedNovelIds = ((rows || []) as NovelAdminRow[]).map((r) => r.novel_id);
    if (!allowedNovelIds.length) {
      return {
        role,
        totalUsers: 0,
        totalNovels: 0,
        totalReads: 0,
        totalComments: 0,
        novelAnalytics: [],
      };
    }
  }

  const { data: rpcPayload, error: rpcError } = await admin.rpc("get_dashboard_analytics", {
    p_role: role,
    p_allowed_novel_ids: role === "novel_admin" ? allowedNovelIds : null,
  });

  if (rpcError || !rpcPayload) {
    return {
      role,
      totalUsers: 0,
      totalNovels: 0,
      totalReads: 0,
      totalComments: 0,
      novelAnalytics: [],
    };
  }

  const payload = rpcPayload as DashboardAnalyticsPayload;

  const novelAnalyticsBase = payload.novelAnalytics || [];
  const novelIds = novelAnalyticsBase.map((n) => n.id);

  let novelAnalytics = novelAnalyticsBase;

  if (novelIds.length > 0) {
    const [{ data: ratingRows }, { data: readingRows }] = await Promise.all([
      admin
        .from("novel_ratings")
        .select("novel_id, user_id, rating, created_at")
        .in("novel_id", novelIds)
        .order("created_at", { ascending: false })
        .limit(2000),
      admin
        .from("reading_progress")
        .select("novel_id, user_id, progress_percent, last_read_at")
        .in("novel_id", novelIds)
        .order("last_read_at", { ascending: false })
        .limit(3000),
    ]);

    const safeRatingRows = (ratingRows || []) as NovelRatingRow[];
    const safeReadingRows = (readingRows || []) as ReadingProgressRow[];

    const userIds = Array.from(
      new Set([
        ...safeRatingRows.map((r) => r.user_id),
        ...safeReadingRows.map((r) => r.user_id),
      ])
    );

    let userMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profileRows } = await admin
        .from("users_profile")
        .select("id, display_name, email")
        .in("id", userIds);

      userMap = new Map(
        ((profileRows || []) as UserProfileLite[]).map((u) => {
          const fallback = u.email?.split("@")[0] || "Reader";
          return [u.id, u.display_name || fallback];
        })
      );
    }

    novelAnalytics = novelAnalyticsBase.map((novel) => {
      const recentRaters = safeRatingRows
        .filter((r) => r.novel_id === novel.id)
        .slice(0, 8)
        .map((r) => ({
          user_id: r.user_id,
          display_name: userMap.get(r.user_id) || "Reader",
          rating: r.rating,
          created_at: r.created_at,
        }));

      const recentReaders = safeReadingRows
        .filter((r) => r.novel_id === novel.id)
        .slice(0, 8)
        .map((r) => ({
          user_id: r.user_id,
          display_name: userMap.get(r.user_id) || "Reader",
          progress_percent: r.progress_percent,
          last_read_at: r.last_read_at,
        }));

      return {
        ...novel,
        recent_novel_raters: recentRaters,
        recent_readers: recentReaders,
      };
    });
  }

  return {
    role,
    totalUsers: payload.totalUsers || 0,
    totalNovels: payload.totalNovels || 0,
    totalReads: payload.totalReads || 0,
    totalComments: payload.totalComments || 0,
    novelAnalytics,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const { role, totalUsers, totalNovels, totalReads, totalComments, novelAnalytics } =
    await getAnalytics();

  const novelPerPageOptions = [3, 5, 10, 20];
  const chapterPerPageOptions = [5, 10, 20, 50];

  const novelsPerPageCandidate = parsePositiveInt(params.novelsPerPage, 5);
  const chaptersPerPageCandidate = parsePositiveInt(params.chaptersPerPage, 10);

  const novelsPerPage = novelPerPageOptions.includes(novelsPerPageCandidate)
    ? novelsPerPageCandidate
    : 5;
  const chaptersPerPage = chapterPerPageOptions.includes(chaptersPerPageCandidate)
    ? chaptersPerPageCandidate
    : 10;

  const totalNovelPages = Math.max(1, Math.ceil(novelAnalytics.length / novelsPerPage));
  const novelsPage = Math.min(
    totalNovelPages,
    parsePositiveInt(params.novelsPage, 1)
  );
  const chaptersPage = parsePositiveInt(params.chaptersPage, 1);

  const novelsFrom = (novelsPage - 1) * novelsPerPage;
  const pagedNovels = novelAnalytics.slice(novelsFrom, novelsFrom + novelsPerPage);
  const maxChapterPagesInView = Math.max(
    1,
    ...pagedNovels.map((n) => Math.max(1, Math.ceil(n.chapters.length / chaptersPerPage)))
  );
  const hasChapterPrevGlobal = chaptersPage > 1;
  const hasChapterNextGlobal = chaptersPage < maxChapterPagesInView;

  const buildHref = (updates: Partial<DashboardSearchParams>) => {
    const merged: DashboardSearchParams = {
      novelsPage: String(novelsPage),
      novelsPerPage: String(novelsPerPage),
      chaptersPage: String(chaptersPage),
      chaptersPerPage: String(chaptersPerPage),
      ...updates,
    };

    const qp = new URLSearchParams();
    if (merged.novelsPage) qp.set("novelsPage", merged.novelsPage);
    if (merged.novelsPerPage) qp.set("novelsPerPage", merged.novelsPerPage);
    if (merged.chaptersPage) qp.set("chaptersPage", merged.chaptersPage);
    if (merged.chaptersPerPage) qp.set("chaptersPerPage", merged.chaptersPerPage);

    const qs = qp.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  const chapterPrevHref = hasChapterPrevGlobal
    ? buildHref({ chaptersPage: String(chaptersPage - 1) })
    : undefined;
  const chapterNextHref = hasChapterNextGlobal
    ? buildHref({ chaptersPage: String(chaptersPage + 1) })
    : undefined;

  const stats = (
    role === "novel_admin"
      ? [
          {
            label: "Total Reads",
            value: totalReads.toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            color: "text-purple-400 bg-purple-400/10",
          },
          {
            label: "Novels",
            value: totalNovels.toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            ),
            color: "text-orange-400 bg-orange-400/10",
          },
          {
            label: "Comments",
            value: totalComments.toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            ),
            color: "text-green-400 bg-green-400/10",
          },
        ]
      : [
          {
            label: "Total Reads",
            value: totalReads.toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            color: "text-purple-400 bg-purple-400/10",
          },
          {
            label: "Total Users",
            value: (totalUsers || 0).toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            ),
            color: "text-cyan-400 bg-cyan-400/10",
          },
          {
            label: "Novels",
            value: totalNovels.toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            ),
            color: "text-orange-400 bg-orange-400/10",
          },
          {
            label: "Comments",
            value: totalComments.toLocaleString(),
            icon: (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            ),
            color: "text-green-400 bg-green-400/10",
          },
        ]
  );

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-fg">{stat.value}</p>
              <p className="text-sm text-fg-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-Novel Analytics */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-fg">Novel Analytics</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-fg-muted">Novels/page:</span>
            {novelPerPageOptions.map((size) => (
              <Link
                key={`novel-size-${size}`}
                href={buildHref({ novelsPerPage: String(size), novelsPage: "1" })}
                className={`px-2.5 py-1 rounded-md border transition-colors ${
                  novelsPerPage === size
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-fg-muted hover:border-accent/40"
                }`}
              >
                {size}
              </Link>
            ))}
            <span className="text-fg-muted ml-2">Chapters/page:</span>
            {chapterPerPageOptions.map((size) => (
              <Link
                key={`chapter-size-${size}`}
                href={buildHref({ chaptersPerPage: String(size), chaptersPage: "1" })}
                className={`px-2.5 py-1 rounded-md border transition-colors ${
                  chaptersPerPage === size
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-fg-muted hover:border-accent/40"
                }`}
              >
                {size}
              </Link>
            ))}
          </div>
        </div>

        <ChapterPaginationHotkeys prevHref={chapterPrevHref} nextHref={chapterNextHref} />

        <div className="text-xs text-fg-muted bg-surface border border-border rounded-lg px-4 py-2">
          Chapters keyboard navigation: Left Arrow / A = Previous, Right Arrow / D = Next
        </div>

        {novelAnalytics.length > 0 && (
          <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg px-4 py-2 text-sm">
            {novelsPage > 1 ? (
              <Link
                href={buildHref({ novelsPage: String(novelsPage - 1) })}
                className="px-3 py-1.5 rounded-md border border-border hover:border-accent/40 transition-colors"
              >
                Previous Novels
              </Link>
            ) : (
              <span />
            )}

            <span className="text-fg-muted">
              Novel page {novelsPage} of {totalNovelPages}
            </span>

            {novelsPage < totalNovelPages ? (
              <Link
                href={buildHref({ novelsPage: String(novelsPage + 1) })}
                className="px-3 py-1.5 rounded-md border border-border hover:border-accent/40 transition-colors"
              >
                Next Novels
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}

        {novelAnalytics.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl px-6 py-12 text-center text-fg-muted">
            No novels yet. Create one to see analytics.
          </div>
        ) : (
          pagedNovels.map((novel) => {
            const avgReadsPerChapter =
              novel.chapter_count > 0
                ? Math.round(novel.total_reads / novel.chapter_count)
                : 0;
            const topChapter = novel.chapters.reduce(
              (top, ch) => (ch.reads > (top?.reads || 0) ? ch : top),
              novel.chapters[0]
            );
            const readPercent =
              totalReads > 0 ? ((novel.total_reads / totalReads) * 100).toFixed(1) : "0";
            const chapterTotalPages = Math.max(
              1,
              Math.ceil(novel.chapters.length / chaptersPerPage)
            );
            const safeChapterPage = Math.min(chaptersPage, chapterTotalPages);
            const chapterFrom = (safeChapterPage - 1) * chaptersPerPage;
            const pagedChapters = novel.chapters.slice(
              chapterFrom,
              chapterFrom + chaptersPerPage
            );

            return (
              <div
                key={novel.id}
                className="bg-surface border border-border rounded-xl overflow-hidden"
              >
                {/* Novel Header */}
                <div className="flex items-center gap-4 p-5 border-b border-border">
                  {novel.cover_url && (
                    <Image
                      src={novel.cover_url}
                      alt=""
                      width={48}
                      height={64}
                      className="w-12 h-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-fg truncate">
                        {novel.title}
                      </h3>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
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
                    <p className="text-xs text-fg-muted mt-0.5">
                      Created {formatDateShort(novel.created_at)}
                    </p>
                  </div>
                </div>

                {/* Novel Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-px bg-border">
                  {[
                    { label: "Total Reads", value: novel.total_reads.toLocaleString() },
                    { label: "Chapters", value: novel.chapter_count.toString() },
                    { label: "Words", value: novel.total_words.toLocaleString() },
                    { label: "Comments", value: novel.total_comments.toLocaleString() },
                    { label: "Novel Rating", value: novel.novel_avg_rating > 0 ? `★ ${novel.novel_avg_rating.toFixed(1)}/10 (${novel.novel_rating_count})` : "—" },
                    { label: "Ch. Rating", value: novel.chapter_avg_rating > 0 ? `★ ${novel.chapter_avg_rating.toFixed(1)}/10 (${novel.chapter_rating_count})` : "—" },
                    { label: "Share of Traffic", value: `${readPercent}%` },
                  ].map((s) => (
                    <div key={s.label} className="bg-surface px-4 py-3 text-center">
                      <p className="text-lg font-bold text-fg">{s.value}</p>
                      <p className="text-xs text-fg-muted">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Highlight Row */}
                {topChapter && (
                  <div className="px-5 py-3 bg-accent/5 border-t border-border flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    <span className="text-fg-muted">
                      Top Chapter:{" "}
                      <span className="text-fg font-medium">
                        Ch. {topChapter.chapter_number}: {topChapter.title}
                      </span>{" "}
                      ({topChapter.reads.toLocaleString()} reads)
                    </span>
                    <span className="text-fg-muted">
                      Avg reads/chapter:{" "}
                      <span className="text-fg font-medium">
                        {avgReadsPerChapter.toLocaleString()}
                      </span>
                    </span>
                  </div>
                )}

                {/* Audience Row */}
                <div className="px-5 py-4 border-t border-border space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-fg-muted mb-2">Recent Raters</p>
                    {novel.recent_novel_raters && novel.recent_novel_raters.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {novel.recent_novel_raters.map((r) => (
                          <span
                            key={`${novel.id}-rater-${r.user_id}`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 text-amber-300 border border-amber-500/25 px-2.5 py-1 text-xs"
                            title={`Rated ${r.rating}/10 on ${formatDateShort(r.created_at)}`}
                          >
                            <span>{r.display_name}</span>
                            <span className="text-amber-200/80">({r.rating}/10)</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-fg-muted">No ratings yet.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-fg-muted mb-2">Recent Readers</p>
                    {novel.recent_readers && novel.recent_readers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {novel.recent_readers.map((r) => (
                          <span
                            key={`${novel.id}-reader-${r.user_id}`}
                            className="inline-flex items-center gap-1 rounded-full bg-cyan-500/12 text-cyan-300 border border-cyan-500/25 px-2.5 py-1 text-xs"
                            title={`Last read on ${formatDateShort(r.last_read_at)}`}
                          >
                            <span>{r.display_name}</span>
                            <span className="text-cyan-200/80">({r.progress_percent}%)</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-fg-muted">No readers tracked yet.</p>
                    )}
                  </div>
                </div>

                {/* Chapter Breakdown Table */}
                {novel.chapters.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="px-5 py-2.5 border-t border-border text-xs text-fg-muted flex items-center justify-between gap-3">
                      <span>
                        Showing chapters {chapterFrom + 1}-
                        {Math.min(chapterFrom + chaptersPerPage, novel.chapters.length)} of {novel.chapters.length}
                      </span>
                      <span>
                        Chapter page {safeChapterPage} of {chapterTotalPages} (global)
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-border text-left text-fg-muted">
                          <th className="px-5 py-2.5 font-medium">#</th>
                          <th className="px-5 py-2.5 font-medium">Title</th>
                          <th className="px-5 py-2.5 font-medium text-right">Reads</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden sm:table-cell">Words</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden sm:table-cell">Comments</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden sm:table-cell">Rating</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden md:table-cell">Published</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pagedChapters.map((ch) => {
                          const barWidth =
                            novel.total_reads > 0
                              ? Math.max(2, (ch.reads / novel.total_reads) * 100)
                              : 0;
                          return (
                            <tr key={ch.id} className="hover:bg-bg-secondary/50 transition-colors">
                              <td className="px-5 py-2.5 text-fg-muted">{ch.chapter_number}</td>
                              <td className="px-5 py-2.5 text-fg font-medium max-w-62.5 truncate">
                                {ch.title}
                              </td>
                              <td className="px-5 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full bg-accent rounded-full ${
                                        barWidth >= 90
                                          ? "w-full"
                                          : barWidth >= 75
                                          ? "w-3/4"
                                          : barWidth >= 50
                                          ? "w-1/2"
                                          : barWidth >= 25
                                          ? "w-1/4"
                                          : barWidth > 0
                                          ? "w-2"
                                          : "w-0"
                                      }`}
                                    />
                                  </div>
                                  <span className="text-fg tabular-nums">{ch.reads.toLocaleString()}</span>
                                </div>
                              </td>
                              <td className="px-5 py-2.5 text-right text-fg-muted hidden sm:table-cell tabular-nums">
                                {ch.word_count.toLocaleString()}
                              </td>
                              <td className="px-5 py-2.5 text-right text-fg-muted hidden sm:table-cell tabular-nums">
                                {ch.comment_count}
                              </td>
                              <td className="px-5 py-2.5 text-right hidden sm:table-cell tabular-nums">
                                {ch.avg_rating > 0 ? (
                                  <span className="text-amber-400 font-medium">★ {ch.avg_rating.toFixed(1)}<span className="text-fg-muted font-normal"> ({ch.rating_count})</span></span>
                                ) : (
                                  <span className="text-fg-muted">—</span>
                                )}
                              </td>
                              <td className="px-5 py-2.5 text-right text-fg-muted hidden md:table-cell">
                                {formatDateShort(ch.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 text-sm">
                      {safeChapterPage > 1 ? (
                        <Link
                          href={buildHref({ chaptersPage: String(safeChapterPage - 1) })}
                          className="px-3 py-1.5 rounded-md border border-border hover:border-accent/40 transition-colors"
                        >
                          Previous Chapters
                        </Link>
                      ) : (
                        <span />
                      )}

                      <span className="text-fg-muted">
                        Chapter page {safeChapterPage} of {chapterTotalPages}
                      </span>

                      {safeChapterPage < chapterTotalPages ? (
                        <Link
                          href={buildHref({ chaptersPage: String(safeChapterPage + 1) })}
                          className="px-3 py-1.5 rounded-md border border-border hover:border-accent/40 transition-colors"
                        >
                          Next Chapters
                        </Link>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {novelAnalytics.length > 0 && (
          <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg px-4 py-2 text-sm">
            {novelsPage > 1 ? (
              <Link
                href={buildHref({ novelsPage: String(novelsPage - 1) })}
                className="px-3 py-1.5 rounded-md border border-border hover:border-accent/40 transition-colors"
              >
                Previous Novels
              </Link>
            ) : (
              <span />
            )}

            <span className="text-fg-muted">
              Novel page {novelsPage} of {totalNovelPages}
            </span>

            {novelsPage < totalNovelPages ? (
              <Link
                href={buildHref({ novelsPage: String(novelsPage + 1) })}
                className="px-3 py-1.5 rounded-md border border-border hover:border-accent/40 transition-colors"
              >
                Next Novels
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

