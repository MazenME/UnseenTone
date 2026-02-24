-- ═══════════════════════════════════════════════════════════════
-- Chapter & Novel Ratings (1–10)
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── Chapter Ratings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chapter_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

ALTER TABLE public.chapter_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read chapter ratings" ON public.chapter_ratings;
CREATE POLICY "Anyone can read chapter ratings"
  ON public.chapter_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert chapter ratings" ON public.chapter_ratings;
CREATE POLICY "Auth users can insert chapter ratings"
  ON public.chapter_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chapter ratings" ON public.chapter_ratings;
CREATE POLICY "Users can update own chapter ratings"
  ON public.chapter_ratings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chapter ratings" ON public.chapter_ratings;
CREATE POLICY "Users can delete own chapter ratings"
  ON public.chapter_ratings FOR DELETE USING (auth.uid() = user_id);

-- ── Novel Ratings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.novel_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, novel_id)
);

ALTER TABLE public.novel_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read novel ratings" ON public.novel_ratings;
CREATE POLICY "Anyone can read novel ratings"
  ON public.novel_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert novel ratings" ON public.novel_ratings;
CREATE POLICY "Auth users can insert novel ratings"
  ON public.novel_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own novel ratings" ON public.novel_ratings;
CREATE POLICY "Users can update own novel ratings"
  ON public.novel_ratings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own novel ratings" ON public.novel_ratings;
CREATE POLICY "Users can delete own novel ratings"
  ON public.novel_ratings FOR DELETE USING (auth.uid() = user_id);
