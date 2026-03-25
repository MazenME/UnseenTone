import { NextResponse } from "next/server";
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

function normalizeQuery(query: string): string {
  return query
    .trim()
    .replace(/[%,_]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = normalizeQuery(rawQuery);

  const parsedLimit = Number(searchParams.get("limit") ?? 60);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 100))
    : 60;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc("search_novels", {
      p_query: query,
      p_limit: limit,
    });

    if (error) {
      let fallbackQuery = supabase
        .from("novels")
        .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
        .order("total_reads", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (query.length > 0) {
        fallbackQuery = fallbackQuery.or(`title.ilike.%${query}%,synopsis.ilike.%${query}%`);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        return NextResponse.json({ error: "Failed to fetch novels" }, { status: 500 });
      }

      const novelIds = (fallbackData || []).map((novel) => novel.id);
      let progressMap: Record<string, number> = {};
      if (user?.id && novelIds.length > 0) {
        const { data: progressRows } = await supabase
          .from("reading_progress")
          .select("novel_id, progress_percent")
          .eq("user_id", user.id)
          .in("novel_id", novelIds);

        progressMap = Object.fromEntries(
          (progressRows || []).map((row) => [row.novel_id, row.progress_percent])
        );
      }

      const novels = (fallbackData || []).map((novel) => ({
        ...novel,
        last_read_progress: progressMap[novel.id] ?? null,
      }));

      return NextResponse.json(
        {
          novels,
          query,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const novels = (data ?? []) as NovelResult[];

    return NextResponse.json(
      {
        novels,
        query,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
