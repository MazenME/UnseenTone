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

  return { user, role, allowedNovelIds, admin };
}

function isSuper(role: AdminRole) {
  return role === "super_admin";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function createNovel(formData: FormData) {
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  const supabase = await createClient();

  const title = formData.get("title") as string;
  const synopsis = formData.get("synopsis") as string;
  const status = formData.get("status") as string;
  const coverFile = formData.get("cover") as File | null;

  if (!title?.trim()) return { error: "Title is required" };

  const slug = slugify(title);

  let cover_url: string | null = null;

  if (coverFile && coverFile.size > 0) {
    const admin = scope.admin;
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

  const { data: inserted, error } = await supabase
    .from("novels")
    .insert({
      title: title.trim(),
      slug,
      synopsis: synopsis?.trim() || null,
      status: status || "ongoing",
      cover_url,
    })
    .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A novel with this title/slug already exists" };
    return { error: error.message };
  }

  if (scope.role === "novel_admin") {
    await scope.admin
      .from("novel_admins")
      .upsert({ admin_id: scope.user.id, novel_id: inserted!.id }, { onConflict: "admin_id,novel_id" });
  }

  revalidatePath("/dashboard/novels");
  return { success: true, novel: inserted };
}

export async function updateNovel(novelId: string, formData: FormData) {
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  if (!isSuper(scope.role) && !scope.allowedNovelIds.includes(novelId)) return { error: "Forbidden" };
  const supabase = await createClient();

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
    const admin = scope.admin;
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

  const { data: updated, error } = await supabase
    .from("novels")
    .update(updates)
    .eq("id", novelId)
    .select("id, title, slug, synopsis, cover_url, status, total_reads, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A novel with this title/slug already exists" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/novels");
  return { success: true, novel: updated };
}

export async function deleteNovel(novelId: string) {
  const scope = await getAdminScope();
  if ("error" in scope) return { error: scope.error };
  if (!isSuper(scope.role) && !scope.allowedNovelIds.includes(novelId)) return { error: "Forbidden" };
  const supabase = await createClient();

  const { error } = await supabase.from("novels").delete().eq("id", novelId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/novels");
  return { success: true };
}
