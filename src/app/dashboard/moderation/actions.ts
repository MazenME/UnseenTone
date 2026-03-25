"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminScope, requireSuperAdminScope } from "@/lib/admin-scope";
import { revalidatePath } from "next/cache";

async function ensureCommentInScope(commentId: string, allowedNovelIds: string[]) {
  if (!allowedNovelIds.length) throw new Error("Forbidden");
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("id, chapter_id, chapters!inner(novel_id)")
    .eq("id", commentId)
    .single();

  const novelId = (
    comment as { chapters?: { novel_id?: string } | Array<{ novel_id?: string }> } | null
  )?.chapters;
  const scopedNovelId = Array.isArray(novelId) ? novelId[0]?.novel_id : novelId?.novel_id;
  if (!scopedNovelId || !allowedNovelIds.includes(scopedNovelId)) throw new Error("Forbidden");
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
  const { isSuperAdmin, allowedNovelIds, admin } = await requireAdminScope();

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
  } else if (!isSuperAdmin) {
    if (!allowedNovelIds.length) return { comments: [], total: 0 };
    query = query.in("chapters.novel_id", allowedNovelIds);
  }

  const { data, count, error } = await query;

  if (error) return { comments: [], total: 0, error: error.message };
  return { comments: data || [], total: count || 0 };
}

// ── Fetch novels with their chapters (for filter dropdowns) ──
export async function getNovelsWithChapters(): Promise<
  { id: string; title: string; chapters: { id: string; title: string; chapter_number: number }[] }[]
> {
  const { isSuperAdmin, allowedNovelIds, admin } = await requireAdminScope();

  let novelsQuery = admin
    .from("novels")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(300);
  let chaptersQuery = admin
    .from("chapters")
    .select("id, title, chapter_number, novel_id")
    .order("chapter_number", { ascending: true })
    .limit(1000);

  if (!isSuperAdmin) {
    if (!allowedNovelIds.length) return [];
    novelsQuery = novelsQuery.in("id", allowedNovelIds);
    chaptersQuery = chaptersQuery.in("novel_id", allowedNovelIds);
  }

  const [{ data: novels }, { data: allChapters }] = await Promise.all([novelsQuery, chaptersQuery]);
  if (!novels || novels.length === 0) return [];

  // Group chapters by novel_id in JS
  const chaptersByNovel: Record<string, { id: string; title: string; chapter_number: number }[]> = {};
  for (const ch of allChapters || []) {
    if (!chaptersByNovel[ch.novel_id]) chaptersByNovel[ch.novel_id] = [];
    chaptersByNovel[ch.novel_id].push({ id: ch.id, title: ch.title, chapter_number: ch.chapter_number });
  }

  return novels.map((n) => ({ ...n, chapters: chaptersByNovel[n.id] || [] }));
}

// ── Delete a comment (soft-delete) ───────────────────────────
export async function deleteComment(commentId: string) {
  const { isSuperAdmin, allowedNovelIds, admin } = await requireAdminScope();
  if (!isSuperAdmin) await ensureCommentInScope(commentId, allowedNovelIds);

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
  const { isSuperAdmin, allowedNovelIds, admin } = await requireAdminScope();
  if (!isSuperAdmin) await ensureCommentInScope(commentId, allowedNovelIds);

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
  const { isSuperAdmin, allowedNovelIds, admin } = await requireAdminScope();
  if (!isSuperAdmin) await ensureCommentInScope(commentId, allowedNovelIds);

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
  const { admin } = await requireSuperAdminScope();

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
  const { admin } = await requireSuperAdminScope();

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
  const { admin } = await requireSuperAdminScope();

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
    query = query.in("role", ["super_admin", "novel_admin", "admin"]);
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
  const { admin } = await requireSuperAdminScope();

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
  const { admin } = await requireSuperAdminScope();

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
    .select("id, name, label, bg, bg_secondary, fg, fg_muted, accent, accent_hover, border_color, surface, content_text, content_heading, content_link, color_scheme, created_at")
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
  await requireSuperAdminScope();
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
  await requireSuperAdminScope();
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
    .select("id, name, font_family, font_url, created_at")
    .order("created_at", { ascending: true });
  if (error) { console.error("getCustomFonts:", error.message); return []; }
  return (data as CustomFont[]) || [];
}

export async function createCustomFont(font: { name: string; font_family: string; font_url?: string }) {
  await requireSuperAdminScope();
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
  await requireSuperAdminScope();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_fonts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/moderation");
  return { success: true };
}

// ── Admin role & scope management (super-admin only) ──────────
export async function listNovels() {
  await requireSuperAdminScope();
  const admin = createAdminClient();
  const { data, error } = await admin.from("novels").select("id, title").order("title", { ascending: true });
  if (error) return { novels: [], error: error.message };
  return { novels: data || [] };
}

export async function getNovelAssignments(userId: string) {
  await requireSuperAdminScope();
  const admin = createAdminClient();
  const { data, error } = await admin.from("novel_admins").select("novel_id").eq("admin_id", userId);
  if (error) return { novelIds: [], error: error.message };
  return { novelIds: (data || []).map((r: { novel_id: string }) => r.novel_id) };
}

export async function setAdminRole(params: {
  userId: string;
  role: "super_admin" | "novel_admin" | "reader";
  novelIds?: string[];
}) {
  const { user: actingUser } = await requireSuperAdminScope();
  const admin = createAdminClient();

  if (params.userId === actingUser.id && params.role !== "super_admin") {
    return { error: "You cannot demote yourself" };
  }

  const roleValue = params.role;

  // Update profile role
  const { error: updateError } = await admin
    .from("users_profile")
    .update({ role: roleValue })
    .eq("id", params.userId);
  if (updateError) return { error: updateError.message };

  // Reset novel assignments then re-insert if limited admin
  await admin.from("novel_admins").delete().eq("admin_id", params.userId);

  if (roleValue === "novel_admin") {
    const novelIds = params.novelIds || [];
    if (!novelIds.length) return { error: "Select at least one novel" };
    const rows = novelIds.map((nid) => ({ admin_id: params.userId, novel_id: nid }));
    const { error: insertError } = await admin.from("novel_admins").upsert(rows, { onConflict: "admin_id,novel_id" });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/dashboard/moderation");
  return { success: true };
}
