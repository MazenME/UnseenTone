"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createChapter(data: {
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string;
  is_published: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("chapters").delete().eq("id", chapterId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/chapters");
  return { success: true };
}
