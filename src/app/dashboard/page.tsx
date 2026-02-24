import { createClient } from "@/lib/supabase/server";

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
  chapters: {
    id: string;
    chapter_number: number;
    title: string;
    reads: number;
    word_count: number;
    comment_count: number;
    created_at: string;
  }[];
}

async function getAnalytics() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { data: novels },
    { count: totalComments },
    { data: bannedUsersData },
    { data: allNovelRatings },
    { data: allChapterRatings },
  ] = await Promise.all([
    supabase.from("users_profile").select("*", { count: "exact", head: true }),
    supabase.from("novels").select("id, title, slug, status, total_reads, created_at, cover_url"),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("users_profile").select("*", { count: "exact", head: true }).eq("is_banned", true),
    supabase.from("novel_ratings").select("novel_id, rating"),
    supabase.from("chapter_ratings").select("rating, chapters(novel_id)"),
  ]);

  const totalReads = (novels || []).reduce((sum, n) => sum + (n.total_reads || 0), 0);

  // Aggregate novel ratings by novel
  const nrMap: Record<string, { sum: number; count: number }> = {};
  for (const r of (allNovelRatings || []) as any[]) {
    if (!nrMap[r.novel_id]) nrMap[r.novel_id] = { sum: 0, count: 0 };
    nrMap[r.novel_id].sum += r.rating;
    nrMap[r.novel_id].count += 1;
  }

  // Aggregate chapter ratings by novel
  const crMap: Record<string, { sum: number; count: number }> = {};
  for (const r of (allChapterRatings || []) as any[]) {
    const nid = r.chapters?.novel_id;
    if (!nid) continue;
    if (!crMap[nid]) crMap[nid] = { sum: 0, count: 0 };
    crMap[nid].sum += r.rating;
    crMap[nid].count += 1;
  }

  // Get per-novel detailed analytics
  const novelAnalytics: NovelAnalytics[] = [];

  for (const novel of novels || []) {
    const [{ data: chapters }, { count: novelCommentCount }] = await Promise.all([
      supabase
        .from("chapters")
        .select("id, chapter_number, title, reads, word_count, created_at")
        .eq("novel_id", novel.id)
        .order("chapter_number", { ascending: true }),
      supabase
        .from("comments")
        .select("*, chapters!inner(novel_id)", { count: "exact", head: true })
        .eq("chapters.novel_id", novel.id)
        .eq("is_deleted", false),
    ]);

    const chapterList = chapters || [];
    const totalWords = chapterList.reduce((sum, c) => sum + (c.word_count || 0), 0);

    // Get per-chapter comment counts
    const chaptersWithComments = [];
    for (const ch of chapterList) {
      const { count } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("chapter_id", ch.id)
        .eq("is_deleted", false);

      chaptersWithComments.push({
        ...ch,
        comment_count: count || 0,
      });
    }

    novelAnalytics.push({
      ...novel,
      chapter_count: chapterList.length,
      total_words: totalWords,
      total_comments: novelCommentCount || 0,
      novel_avg_rating: nrMap[novel.id] ? Math.round((nrMap[novel.id].sum / nrMap[novel.id].count) * 10) / 10 : 0,
      novel_rating_count: nrMap[novel.id]?.count || 0,
      chapter_avg_rating: crMap[novel.id] ? Math.round((crMap[novel.id].sum / crMap[novel.id].count) * 10) / 10 : 0,
      chapter_rating_count: crMap[novel.id]?.count || 0,
      chapters: chaptersWithComments,
    });
  }

  return {
    totalUsers: totalUsers || 0,
    totalNovels: novels?.length || 0,
    totalReads,
    totalComments: totalComments || 0,
    bannedUsers: bannedUsersData || 0,
    novelAnalytics,
  };
}

export default async function DashboardPage() {
  const { totalUsers, totalNovels, totalReads, totalComments, novelAnalytics } =
    await getAnalytics();

  const stats = [
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
      value: totalUsers.toLocaleString(),
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
  ];

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
        <h2 className="text-xl font-bold text-fg">Novel Analytics</h2>

        {novelAnalytics.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl px-6 py-12 text-center text-fg-muted">
            No novels yet. Create one to see analytics.
          </div>
        ) : (
          novelAnalytics.map((novel) => {
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

            return (
              <div
                key={novel.id}
                className="bg-surface border border-border rounded-xl overflow-hidden"
              >
                {/* Novel Header */}
                <div className="flex items-center gap-4 p-5 border-b border-border">
                  {novel.cover_url && (
                    <img
                      src={novel.cover_url}
                      alt=""
                      className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
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
                      Created {new Date(novel.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Novel Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border">
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

                {/* Chapter Breakdown Table */}
                {novel.chapters.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-border text-left text-fg-muted">
                          <th className="px-5 py-2.5 font-medium">#</th>
                          <th className="px-5 py-2.5 font-medium">Title</th>
                          <th className="px-5 py-2.5 font-medium text-right">Reads</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden sm:table-cell">Words</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden sm:table-cell">Comments</th>
                          <th className="px-5 py-2.5 font-medium text-right hidden md:table-cell">Published</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {novel.chapters.map((ch) => {
                          const barWidth =
                            novel.total_reads > 0
                              ? Math.max(2, (ch.reads / novel.total_reads) * 100)
                              : 0;
                          return (
                            <tr key={ch.id} className="hover:bg-bg-secondary/50 transition-colors">
                              <td className="px-5 py-2.5 text-fg-muted">{ch.chapter_number}</td>
                              <td className="px-5 py-2.5 text-fg font-medium max-w-[250px] truncate">
                                {ch.title}
                              </td>
                              <td className="px-5 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className="h-full bg-accent rounded-full"
                                      style={{ width: `${barWidth}%` }}
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
                              <td className="px-5 py-2.5 text-right text-fg-muted hidden md:table-cell">
                                {new Date(ch.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
