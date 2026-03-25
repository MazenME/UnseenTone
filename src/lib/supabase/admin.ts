import { createClient } from "@supabase/supabase-js";

// Admin client bypasses RLS — use only in server-side code (API routes, server actions)
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient can only be used on the server");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin environment variables");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
