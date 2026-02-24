-- ═══════════════════════════════════════════════════════════════
-- PHASE 6: Reader Interactions — bookmarks & chapter_likes
-- Run this in the Supabase SQL Editor.
-- The comments table already exists from Phase 1.
-- ═══════════════════════════════════════════════════════════════

-- ── Bookmarks ────────────────────────────────────────────────
-- Drop and recreate to fix schema mismatches from earlier migrations
DROP TABLE IF EXISTS public.bookmarks CASCADE;

CREATE TABLE public.bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can read own bookmarks"
  ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can insert own bookmarks"
  ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete own bookmarks"
  ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ── Chapter Likes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chapter_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

ALTER TABLE public.chapter_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can count chapter likes" ON public.chapter_likes;
CREATE POLICY "Anyone can count chapter likes"
  ON public.chapter_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert likes" ON public.chapter_likes;
CREATE POLICY "Authenticated users can insert likes"
  ON public.chapter_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON public.chapter_likes;
CREATE POLICY "Users can delete own likes"
  ON public.chapter_likes FOR DELETE USING (auth.uid() = user_id);

-- ── Novel Favourites ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.novel_favourites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, novel_id)
);

ALTER TABLE public.novel_favourites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can count novel favourites" ON public.novel_favourites;
CREATE POLICY "Anyone can count novel favourites"
  ON public.novel_favourites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert novel favourites" ON public.novel_favourites;
CREATE POLICY "Authenticated users can insert novel favourites"
  ON public.novel_favourites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own novel favourites" ON public.novel_favourites;
CREATE POLICY "Users can delete own novel favourites"
  ON public.novel_favourites FOR DELETE USING (auth.uid() = user_id);
