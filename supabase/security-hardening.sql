-- Security hardening patch for Supabase lints
-- Addresses:
-- 1) v_novel_admins exposing auth.users fields
-- 2) v_novel_admins flagged as SECURITY DEFINER
-- 3) public.novel_admins missing RLS
-- 4) moddatetime extension in public schema

-- 1 + 2: Rebuild helper view without auth.users join and force invoker security.
DROP VIEW IF EXISTS public.v_novel_admins;

CREATE VIEW public.v_novel_admins
WITH (security_invoker = true) AS
SELECT
  na.admin_id,
  p.role AS profile_role,
  na.novel_id,
  na.created_at
FROM public.novel_admins na
JOIN public.users_profile p ON p.id = na.admin_id;

-- Restrict view exposure to admins only.
REVOKE ALL ON TABLE public.v_novel_admins FROM anon, authenticated;
GRANT SELECT ON TABLE public.v_novel_admins TO authenticated;

-- 3: Enable RLS and add explicit policies for mapping table.
ALTER TABLE public.novel_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_novel_admins" ON public.novel_admins;
CREATE POLICY "super_admin_manage_novel_admins"
  ON public.novel_admins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_profile p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users_profile p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "novel_admin_read_own_mappings" ON public.novel_admins;
CREATE POLICY "novel_admin_read_own_mappings"
  ON public.novel_admins
  FOR SELECT
  USING (admin_id = auth.uid());

-- 4: Move extension out of public schema if it is currently there.
-- Safe to run repeatedly; no-op when already moved.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION moddatetime SET SCHEMA extensions;
