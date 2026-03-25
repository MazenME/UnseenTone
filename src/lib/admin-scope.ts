import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminRole = "super_admin" | "novel_admin" | "reader";

type AdminScope = {
  user: User;
  role: AdminRole;
  isSuperAdmin: boolean;
  allowedNovelIds: string[];
};

const ADMIN_SCOPE_TTL_MS = 10_000;
const adminScopeCache = new Map<
  string,
  {
    role: AdminRole;
    allowedNovelIds: string[];
    expiresAt: number;
  }
>();

function normalizeRole(role?: string | null): AdminRole {
  if (role === "admin" || role === "super_admin") return "super_admin";
  if (role === "novel_admin") return "novel_admin";
  return "reader";
}

async function resolveAdminScope(): Promise<AdminScope | { error: "Unauthorized" | "Forbidden" }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const cached = adminScopeCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      user,
      role: cached.role,
      isSuperAdmin: cached.role === "super_admin",
      allowedNovelIds: cached.allowedNovelIds,
    };
  }

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = normalizeRole(profile?.role);
  if (role === "reader") return { error: "Forbidden" };

  let allowedNovelIds: string[] = [];
  if (role === "novel_admin") {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("novel_admins")
      .select("novel_id")
      .eq("admin_id", user.id);
    allowedNovelIds = (rows || []).map((row: { novel_id: string }) => row.novel_id);
  }

  adminScopeCache.set(user.id, {
    role,
    allowedNovelIds,
    expiresAt: Date.now() + ADMIN_SCOPE_TTL_MS,
  });

  return {
    user,
    role,
    isSuperAdmin: role === "super_admin",
    allowedNovelIds,
  };
}

export async function getAdminScopeOrError() {
  const scope = await resolveAdminScope();
  if ("error" in scope) return { error: scope.error };
  return {
    ...scope,
    admin: createAdminClient(),
  };
}

export async function requireAdminScope() {
  const scope = await resolveAdminScope();
  if ("error" in scope) throw new Error(scope.error);
  return {
    ...scope,
    admin: createAdminClient(),
  };
}

export async function requireSuperAdminScope() {
  const scope = await requireAdminScope();
  if (!scope.isSuperAdmin) throw new Error("Forbidden");
  return scope;
}
