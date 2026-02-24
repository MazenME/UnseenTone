import { createClient } from "@/lib/supabase/server";
import ChapterList from "@/components/dashboard/chapter-list";

export default async function ChaptersPage() {
  const supabase = await createClient();

  const [{ data: chapters }, { data: novels }] = await Promise.all([
    supabase
      .from("chapters")
      .select("*, novels(title)")
      .order("created_at", { ascending: false }),
    supabase.from("novels").select("id, title").order("title"),
  ]);

  return <ChapterList initialChapters={chapters || []} novels={novels || []} />;
}
