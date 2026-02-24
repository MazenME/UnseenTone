import { createClient } from "@/lib/supabase/server";
import NovelManager from "@/components/dashboard/novel-manager";

export default async function NovelsPage() {
  const supabase = await createClient();

  const { data: novels } = await supabase
    .from("novels")
    .select("*")
    .order("created_at", { ascending: false });

  return <NovelManager initialNovels={novels || []} />;
}
