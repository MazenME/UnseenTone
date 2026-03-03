import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users_profile")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const isAdmin = role === "admin" || role === "super_admin" || role === "novel_admin";
  if (!isAdmin) redirect("/");

  return <DashboardShell>{children}</DashboardShell>;
}
