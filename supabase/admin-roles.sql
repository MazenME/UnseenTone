-- ═══════════════════════════════════════════════════════════════
-- Admin roles & scoped novel admins
-- Run this in the Supabase SQL editor.
-- IMPORTANT: Run STEP 1 (enum additions) first. Once it completes,
-- run STEP 2 (defaults/mapping/policies). They must be separate runs
-- because Postgres requires a commit between adding enum labels and
-- using them.
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Add enum values (run ALONE, then stop)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'novel_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'novel_admin';
  END IF;
END$$;

-- STEP 2: Defaults, normalization, mapping, and RLS (run AFTER STEP 1 succeeded)
-- Guard: ensure new enum labels exist before proceeding
DO $$
DECLARE
  has_super boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) INTO has_super;

  IF NOT has_super THEN
    RAISE EXCEPTION 'Missing enum label super_admin. Run STEP 1 first and rerun this block.';
  END IF;
END$$;

ALTER TABLE public.users_profile
  ALTER COLUMN role SET DEFAULT 'reader';

-- Normalize legacy "admin" rows to the new super_admin value
UPDATE public.users_profile SET role = 'super_admin' WHERE role = 'admin';

-- Constrain role values (idempotent: add only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_profile_role_check'
  ) THEN
    ALTER TABLE public.users_profile
      ADD CONSTRAINT users_profile_role_check
      CHECK (role IN ('reader', 'novel_admin', 'super_admin', 'admin'));
  END IF;
END$$;

-- ── Novel admin mapping ----------------------------------------
CREATE TABLE IF NOT EXISTS public.novel_admins (
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (admin_id, novel_id)
);

CREATE INDEX IF NOT EXISTS idx_novel_admins_admin ON public.novel_admins(admin_id);
CREATE INDEX IF NOT EXISTS idx_novel_admins_novel ON public.novel_admins(novel_id);

-- ── Optional: helper view for debugging ------------------------
-- Keep this view free of auth.users fields to avoid accidental
-- exposure of sensitive auth data via PostgREST.
CREATE OR REPLACE VIEW public.v_novel_admins AS
SELECT na.admin_id, p.role AS profile_role, na.novel_id, na.created_at
FROM public.novel_admins na
JOIN public.users_profile p ON p.id = na.admin_id;

ALTER VIEW public.v_novel_admins SET (security_invoker = true);

REVOKE ALL ON TABLE public.v_novel_admins FROM anon, authenticated;
GRANT SELECT ON TABLE public.v_novel_admins TO authenticated;

-- Enable RLS on the mapping table itself.
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

-- Note: RLS policies for novels/chapters/comments should be updated
-- to allow:
--   * super_admin : full access
--   * novel_admin : access only to rows whose novel_id appears in
--     novel_admins for that admin.
-- Service role bypasses RLS, so application code must avoid using
-- service role for scoped admins.

-- ── RLS policies (defense-in-depth for admin actions) -----------
-- These add admin allowances without removing existing reader policies.

-- Novels
ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_novels_super" ON public.novels;
CREATE POLICY "admin_novels_super"
  ON public.novels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_profile p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "admin_novels_scoped" ON public.novels;
CREATE POLICY "admin_novels_scoped"
  ON public.novels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.novel_admins na
      WHERE na.admin_id = auth.uid() AND na.novel_id = novels.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.novel_admins na
      WHERE na.admin_id = auth.uid() AND na.novel_id = novels.id
    )
  );

-- Chapters
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_chapters_super" ON public.chapters;
CREATE POLICY "admin_chapters_super"
  ON public.chapters
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_profile p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "admin_chapters_scoped" ON public.chapters;
CREATE POLICY "admin_chapters_scoped"
  ON public.chapters
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.novel_admins na
      WHERE na.admin_id = auth.uid() AND na.novel_id = chapters.novel_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.novel_admins na
      WHERE na.admin_id = auth.uid() AND na.novel_id = chapters.novel_id
    )
  );

-- Comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_comments_super" ON public.comments;
CREATE POLICY "admin_comments_super"
  ON public.comments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profile p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_profile p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "admin_comments_scoped" ON public.comments;
CREATE POLICY "admin_comments_scoped"
  ON public.comments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.novel_admins na
      JOIN public.chapters c ON c.id = public.comments.chapter_id
      WHERE na.admin_id = auth.uid() AND na.novel_id = c.novel_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.novel_admins na
      JOIN public.chapters c ON c.id = public.comments.chapter_id
      WHERE na.admin_id = auth.uid() AND na.novel_id = c.novel_id
    )
  );
