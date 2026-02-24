"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function createNovel(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const title = formData.get("title") as string;
  const synopsis = formData.get("synopsis") as string;
  const status = formData.get("status") as string;
  const coverFile = formData.get("cover") as File | null;

  if (!title?.trim()) return { error: "Title is required" };

  const slug = slugify(title);

  let cover_url: string | null = null;

  if (coverFile && coverFile.size > 0) {
    const admin = createAdminClient();
    const ext = coverFile.name.split(".").pop();
    const path = `novels/${slug}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("covers")
      .upload(path, coverFile, {
        contentType: coverFile.type,
        upsert: false,
      });

    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const { data: publicUrl } = admin.storage.from("covers").getPublicUrl(path);
    cover_url = publicUrl.publicUrl;
  }

  const { error } = await supabase.from("novels").insert({
    title: title.trim(),
    slug,
    synopsis: synopsis?.trim() || null,
    status: status || "ongoing",
    cover_url,
  });

  if (error) {
    if (error.code === "23505") return { error: "A novel with this title/slug already exists" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/novels");
  return { success: true };
}

export async function updateNovel(novelId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const title = formData.get("title") as string;
  const synopsis = formData.get("synopsis") as string;
  const status = formData.get("status") as string;
  const coverFile = formData.get("cover") as File | null;

  if (!title?.trim()) return { error: "Title is required" };

  const slug = slugify(title);

  const updates: Record<string, unknown> = {
    title: title.trim(),
    slug,
    synopsis: synopsis?.trim() || null,
    status: status || "ongoing",
  };

  if (coverFile && coverFile.size > 0) {
    const admin = createAdminClient();
    const ext = coverFile.name.split(".").pop();
    const path = `novels/${slug}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("covers")
      .upload(path, coverFile, {
        contentType: coverFile.type,
        upsert: false,
      });

    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    const { data: publicUrl } = admin.storage.from("covers").getPublicUrl(path);
    updates.cover_url = publicUrl.publicUrl;
  }

  const { error } = await supabase
    .from("novels")
    .update(updates)
    .eq("id", novelId);

  if (error) {
    if (error.code === "23505") return { error: "A novel with this title/slug already exists" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/novels");
  return { success: true };
}

export async function deleteNovel(novelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("novels").delete().eq("id", novelId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/novels");
  return { success: true };
}
