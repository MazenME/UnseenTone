import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChapterEditor from "@/components/dashboard/chapter-editor";

export default async function NewChapterPage() {
  const supabase = await createClient();

  const { data: novels } = await supabase
    .from("novels")
    .select("id, title")
    .order("title");

  if (!novels || novels.length === 0) {
    redirect("/dashboard/novels");
  }

  return <ChapterEditor novels={novels} />;
}
