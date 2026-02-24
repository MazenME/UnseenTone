"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ── Verify the caller is an admin ────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return user;
}

// ── Fetch comments for moderation ────────────────────────────
export async function getComments(opts: {
  page?: number;
  pageSize?: number;
  showDeleted?: boolean;
  search?: string;
  novelId?: string;
  chapterId?: string;
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("comments")
    .select(
      "id, body, ip_address, is_deleted, created_at, user_id, users_profile(id, display_name, email, is_banned, avatar_url), chapters!inner(id, title, novel_id, novels(title))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!opts.showDeleted) {
    query = query.eq("is_deleted", false);
  }

  if (opts.search) {
    query = query.ilike("body", `%${opts.search}%`);
  }

  if (opts.chapterId) {
    query = query.eq("chapter_id", opts.chapterId);
  } else if (opts.novelId) {
    query = query.eq("chapters.novel_id", opts.novelId);
  }

  const { data, count, error } = await query;

  if (error) return { comments: [], total: 0, error: error.message };
  return { comments: data || [], total: count || 0 };
}

// ── Fetch novels with their chapters (for filter dropdowns) ──
export async function getNovelsWithChapters(): Promise<
  { id: string; title: string; chapters: { id: string; title: string; chapter_number: number }[] }[]
> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: novels } = await admin
    .from("novels")
    .select("id, title")
    .order("created_at", { ascending: false });

  if (!novels || novels.length === 0) return [];

  const result = [];
  for (const n of novels) {
    const { data: chapters } = await admin
      .from("chapters")
      .select("id, title, chapter_number")
      .eq("novel_id", n.id)
      .order("chapter_number", { ascending: true });
    result.push({ ...n, chapters: chapters || [] });
  }

  return result;
}

// ── Delete a comment (soft-delete) ───────────────────────────
export async function deleteComment(commentId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("comments")
    .update({ is_deleted: true })
    .eq("id", commentId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Restore a soft-deleted comment ───────────────────────────
export async function restoreComment(commentId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("comments")
    .update({ is_deleted: false })
    .eq("id", commentId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Hard-delete a comment permanently ────────────────────────
export async function hardDeleteComment(commentId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Ban a user ───────────────────────────────────────────────
export async function banUser(userId: string, reason?: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("users_profile")
    .update({
      is_banned: true,
      ban_reason: reason || "Banned by admin",
    })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Unban a user ─────────────────────────────────────────────
export async function unbanUser(userId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("users_profile")
    .update({
      is_banned: false,
      ban_reason: null,
    })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Fetch all users for user management ──────────────────────
export async function getUsers(opts: {
  page?: number;
  pageSize?: number;
  filter?: "all" | "banned" | "admin";
  search?: string;
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("users_profile")
    .select("id, email, display_name, avatar_url, role, is_banned, ban_reason, last_ip_address, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts.filter === "banned") {
    query = query.eq("is_banned", true);
  } else if (opts.filter === "admin") {
    query = query.eq("role", "admin");
  }

  if (opts.search) {
    query = query.or(`email.ilike.%${opts.search}%,display_name.ilike.%${opts.search}%`);
  }

  const { data, count, error } = await query;

  if (error) return { users: [], total: 0, error: error.message };
  return { users: data || [], total: count || 0 };
}

// ── Delete a user entirely (removes from auth.users, cascades to profile) ──
export async function deleteUser(userId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // First soft-delete all their comments
  await admin
    .from("comments")
    .update({ is_deleted: true })
    .eq("user_id", userId);

  // Delete the auth user (cascades to users_profile via FK)
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Delete all comments from a specific IP ───────────────────
export async function deleteCommentsByIp(ipAddress: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("comments")
    .update({ is_deleted: true })
    .eq("ip_address", ipAddress);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Custom Themes CRUD ───────────────────────────────────────
export interface CustomTheme {
  id: string;
  name: string;
  label: string;
  bg: string;
  bg_secondary: string;
  fg: string;
  fg_muted: string;
  accent: string;
  accent_hover: string;
  border_color: string;
  surface: string;
  content_text: string;
  content_heading: string;
  content_link: string;
  color_scheme: string;
  created_at: string;
}

export async function getCustomThemes(): Promise<CustomTheme[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_themes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("getCustomThemes:", error.message); return []; }
  return (data as CustomTheme[]) || [];
}

export async function createCustomTheme(fields: {
  label: string;
  bg: string;
  bg_secondary: string;
  fg: string;
  fg_muted: string;
  accent: string;
  accent_hover: string;
  border_color: string;
  surface: string;
  content_text: string;
  content_heading: string;
  content_link: string;
  color_scheme: string;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const name = fields.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { error } = await supabase.from("custom_themes").insert({
    name,
    label: fields.label,
    bg: fields.bg,
    bg_secondary: fields.bg_secondary,
    fg: fields.fg,
    fg_muted: fields.fg_muted,
    accent: fields.accent,
    accent_hover: fields.accent_hover,
    border_color: fields.border_color,
    surface: fields.surface,
    content_text: fields.content_text,
    content_heading: fields.content_heading,
    content_link: fields.content_link,
    color_scheme: fields.color_scheme,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

export async function deleteCustomTheme(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_themes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Custom Fonts CRUD ────────────────────────────────────────
export interface CustomFont {
  id: string;
  name: string;
  font_family: string;
  font_url: string | null;
  created_at: string;
}

export async function getCustomFonts(): Promise<CustomFont[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_fonts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("getCustomFonts:", error.message); return []; }
  return (data as CustomFont[]) || [];
}

export async function createCustomFont(font: { name: string; font_family: string; font_url?: string }) {
  await requireAdmin();
  const supabase = await createClient();

  const row: Record<string, string> = {
    name: font.name,
    font_family: font.font_family,
  };
  if (font.font_url) row.font_url = font.font_url;

  const { error } = await supabase.from("custom_fonts").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/moderation");
  return { success: true };
}

export async function deleteCustomFont(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_fonts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/moderation");
  return { success: true };
}
