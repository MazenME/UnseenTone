import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ChapterReaderClient from "@/components/chapter-reader-client";
import { getChapterLikeState, getBookmarkState, getChapterRatingState } from "@/app/read/actions";

interface Chapter {
  id: string;
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  reads: number;
  created_at: string;
}

interface Novel {
  id: string;
  title: string;
  slug: string;
}

interface SiblingChapter {
  id: string;
  chapter_number: number;
  title: string;
}

async function getChapterData(chapterId: string) {
  const supabase = await createClient();

  // Fetch the chapter
  const { data: chapter } = await supabase
    .from("chapters")
    .select("*")
    .eq("id", chapterId)
    .eq("is_published", true)
    .single();

  if (!chapter) return null;

  // Fetch novel
  const { data: novel } = await supabase
    .from("novels")
    .select("id, title, slug")
    .eq("id", chapter.novel_id)
    .single();

  // Fetch previous and next chapters
  const [{ data: prevChapters }, { data: nextChapters }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, chapter_number, title")
      .eq("novel_id", chapter.novel_id)
      .eq("is_published", true)
      .lt("chapter_number", chapter.chapter_number)
      .order("chapter_number", { ascending: false })
      .limit(1),
    supabase
      .from("chapters")
      .select("id, chapter_number, title")
      .eq("novel_id", chapter.novel_id)
      .eq("is_published", true)
      .gt("chapter_number", chapter.chapter_number)
      .order("chapter_number", { ascending: true })
      .limit(1),
  ]);

  // Increment reads via RPC (fire-and-forget)
  supabase.rpc("increment_chapter_reads", { p_chapter_id: chapterId }).then(() => {});

  return {
    chapter: chapter as Chapter,
    novel: novel as Novel,
    prevChapter: (prevChapters?.[0] as SiblingChapter) || null,
    nextChapter: (nextChapters?.[0] as SiblingChapter) || null,
  };
}

export default async function ReadChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const data = await getChapterData(chapterId);

  if (!data) notFound();

  // Fetch user + interaction state in parallel
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const [likeState, bookmarkState, ratingState] = await Promise.all([
    getChapterLikeState(chapterId),
    getBookmarkState(chapterId),
    getChapterRatingState(chapterId),
  ]);

  return (
    <ChapterReaderClient
      chapter={data.chapter}
      novel={data.novel}
      prevChapter={data.prevChapter}
      nextChapter={data.nextChapter}
      userId={userId}
      initialLikeCount={likeState.count}
      initialLiked={likeState.liked}
      initialBookmarked={bookmarkState.bookmarked}
      initialRatingAverage={ratingState.average}
      initialRatingCount={ratingState.count}
      initialUserRating={ratingState.userRating}
    />
  );
}
