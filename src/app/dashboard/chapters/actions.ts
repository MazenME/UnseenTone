"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type AdminRole = "super_admin" | "novel_admin" | "reader";

async function getAdminScope() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role")
    .eq("id", user.id)
    .single();

  let role: AdminRole = "reader";
  if (profile?.role === "admin" || profile?.role === "super_admin") role = "super_admin";
  else if (profile?.role === "novel_admin") role = "novel_admin";

  if (role === "reader") return { error: "Forbidden" as const };

  const admin = createAdminClient();
  let allowedNovelIds: string[] = [];
  if (role === "novel_admin") {
    const { data: rows } = await admin
      .from("novel_admins")
      .select("novel_id")
      .eq("admin_id", user.id);
    allowedNovelIds = (rows || []).map((r: any) => r.novel_id);
  }

  return { user, role, allowedNovelIds };
}

function isSuper(role: AdminRole) {
  return role === "super_admin";
}

async function ensureChapterAllowed(chapterId: string, role: AdminRole, allowedNovelIds: string[]) {
  if (isSuper(role)) return;
  const admin = createAdminClient();
  const { data: chapter } = await admin.from("chapters").select("novel_id").eq("id", chapterId).single();
  const novelId = (chapter as any)?.novel_id;
  if (!novelId || !allowedNovelIds.includes(novelId)) throw new Error("Forbidden");
}

export async function createChapter(data: {
  novel_id: string;
  chapter_number: number;
  title: string;
  content: string;
  is_published: boolean;
}) {
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  if (!isSuper(scope.role) && !scope.allowedNovelIds.includes(data.novel_id)) return { error: "Forbidden" };
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
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  try {
    await ensureChapterAllowed(chapterId, scope.role, scope.allowedNovelIds);
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
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  try {
    await ensureChapterAllowed(chapterId, scope.role, scope.allowedNovelIds);
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
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  try {
    await ensureChapterAllowed(chapterId, scope.role, scope.allowedNovelIds);
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
