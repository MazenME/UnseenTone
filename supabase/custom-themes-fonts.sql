-- ═══════════════════════════════════════════════════════════════
-- CLEAN REBUILD: Drop and recreate custom themes & fonts tables
-- Run this ENTIRE script in Supabase SQL Editor to reset.
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.custom_themes CASCADE;
DROP TABLE IF EXISTS public.custom_fonts CASCADE;

-- ── Custom Themes ────────────────────────────────────────────
CREATE TABLE public.custom_themes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  bg text NOT NULL DEFAULT '#09090b',
  bg_secondary text NOT NULL DEFAULT '#18181b',
  fg text NOT NULL DEFAULT '#e5e5e5',
  fg_muted text NOT NULL DEFAULT '#a1a1aa',
  accent text NOT NULL DEFAULT '#7e22ce',
  accent_hover text NOT NULL DEFAULT '#9333ea',
  border_color text NOT NULL DEFAULT '#27272a',
  surface text NOT NULL DEFAULT '#13131a',
  content_text text NOT NULL DEFAULT '#e5e5e5',
  content_heading text NOT NULL DEFAULT '#ffffff',
  content_link text NOT NULL DEFAULT '#7e22ce',
  color_scheme text NOT NULL DEFAULT 'dark' CHECK (color_scheme IN ('light', 'dark')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read custom themes"
  ON public.custom_themes FOR SELECT USING (true);

CREATE POLICY "Admins can manage custom themes"
  ON public.custom_themes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users_profile WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Custom Fonts ─────────────────────────────────────────────
CREATE TABLE public.custom_fonts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  font_family text NOT NULL,
  font_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read custom fonts"
  ON public.custom_fonts FOR SELECT USING (true);

CREATE POLICY "Admins can manage custom fonts"
  ON public.custom_fonts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users_profile WHERE id = auth.uid() AND role = 'admin')
  );
