"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminScopeOrError } from "@/lib/admin-scope";
import { revalidatePath } from "next/cache";
async function ensureChapterAllowed(
  admin: ReturnType<typeof createAdminClient>,
  chapterId: string,
  isSuperAdmin: boolean,
  allowedNovelIds: string[]
) {
  if (isSuperAdmin) return;
  const { data: chapter } = await admin.from("chapters").select("novel_id").eq("id", chapterId).single();
  const novelId = (chapter as { novel_id: string } | null)?.novel_id;
  if (!novelId || !allowedNovelIds.includes(novelId)) throw new Error("Forbidden");
}

export async function createChapter(data: {
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string;
  is_published: boolean;
}) {
  const scope = await getAdminScopeOrError();
  if ("error" in scope) return { error: scope.error };
  if (!scope.isSuperAdmin && !scope.allowedNovelIds.includes(data.novel_id)) return { error: "Forbidden" };
  const supabase = await createClient();

  const wordCount = data.content
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  const { error } = await supabase.from("chapters").insert({
    novel_id: data.novel_id,
    chapter_number: data.chapter_number,
    title: data.title.trim(),
    content: data.content,
    word_count: wordCount,
    is_published: data.is_published,
  });

  if (error) {
    if (error.code === "23505")
      return { error: `Chapter ${data.chapter_number} already exists for this novel` };
    return { error: error.message };
  }

  revalidatePath("/dashboard/chapters");
  return { success: true };
}

export async function updateChapter(
  chapterId: string,
  data: {
    chapter_number: number;
    title: string;
    content: string;
    is_published: boolean;
  }
) {
  const scope = await getAdminScopeOrError();
  if ("error" in scope) return { error: scope.error };
  try {
    await ensureChapterAllowed(scope.admin, chapterId, scope.isSuperAdmin, scope.allowedNovelIds);
  } catch {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();

  const wordCount = data.content
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  const { error } = await supabase
    .from("chapters")
    .update({
      chapter_number: data.chapter_number,
      title: data.title.trim(),
      content: data.content,
      word_count: wordCount,
      is_published: data.is_published,
    })
    .eq("id", chapterId);

  if (error) {
    if (error.code === "23505")
      return { error: `Chapter ${data.chapter_number} already exists for this novel` };
    return { error: error.message };
  }

  revalidatePath("/dashboard/chapters");
  return { success: true };
}

export async function deleteChapter(chapterId: string) {
  const scope = await getAdminScopeOrError();
  if ("error" in scope) return { error: scope.error };
  try {
    await ensureChapterAllowed(scope.admin, chapterId, scope.isSuperAdmin, scope.allowedNovelIds);
  } catch {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();

  const { error } = await supabase.from("chapters").delete().eq("id", chapterId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/chapters");
  return { success: true };
}

export async function toggleChapterDirection(chapterId: string) {
  const scope = await getAdminScopeOrError();
  if ("error" in scope) return { error: scope.error };
  try {
    await ensureChapterAllowed(scope.admin, chapterId, scope.isSuperAdmin, scope.allowedNovelIds);
  } catch {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();

  // Fetch current direction
  const { data: chapter } = await supabase
    .from("chapters")
    .select("text_direction")
    .eq("id", chapterId)
    .single();

  const newDir = chapter?.text_direction === "rtl" ? "ltr" : "rtl";

  const { error } = await supabase
    .from("chapters")
    .update({ text_direction: newDir })
    .eq("id", chapterId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/chapters");
  revalidatePath(`/read/${chapterId}`);
  return { success: true, direction: newDir };
}
