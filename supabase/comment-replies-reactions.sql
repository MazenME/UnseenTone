-- ═══════════════════════════════════════════════════════════════
-- Comment Replies & Reactions
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── Add parent_id to comments for replies ────────────────────
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Index for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

-- ── Comment Reactions (like / dislike) ───────────────────────
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, comment_id)
);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read comment reactions" ON public.comment_reactions;
CREATE POLICY "Anyone can read comment reactions"
  ON public.comment_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert reactions" ON public.comment_reactions;
CREATE POLICY "Auth users can insert reactions"
  ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reactions" ON public.comment_reactions;
CREATE POLICY "Users can update own reactions"
  ON public.comment_reactions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.comment_reactions;
CREATE POLICY "Users can delete own reactions"
  ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);
