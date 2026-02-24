import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ChapterEditor from "@/components/dashboard/chapter-editor";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: chapter }, { data: novels }] = await Promise.all([
    supabase.from("chapters").select("*").eq("id", id).single(),
    supabase.from("novels").select("id, title").order("title"),
  ]);

  if (!chapter) notFound();
  if (!novels || novels.length === 0) redirect("/dashboard/novels");

  return <ChapterEditor novels={novels} existingChapter={chapter} />;
}
