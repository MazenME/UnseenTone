-- Performance optimizations for analytics, interactions, and comment/reaction reads
-- Run in Supabase SQL Editor.

-- Indexes for common filters/sorts
CREATE INDEX IF NOT EXISTS idx_comments_chapter_deleted_created
  ON public.comments(chapter_id, is_deleted, created_at);

CREATE INDEX IF NOT EXISTS idx_chapter_ratings_chapter
  ON public.chapter_ratings(chapter_id);

CREATE INDEX IF NOT EXISTS idx_novel_ratings_novel
  ON public.novel_ratings(novel_id);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_type
  ON public.comment_reactions(comment_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_chapter_likes_chapter
  ON public.chapter_likes(chapter_id);

CREATE INDEX IF NOT EXISTS idx_novel_favourites_novel
  ON public.novel_favourites(novel_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created
  ON public.bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chapter_likes_user_created
  ON public.chapter_likes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_novel_favourites_user_created
  ON public.novel_favourites(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chapters_novel_published_number
  ON public.chapters(novel_id, is_published, chapter_number);

-- Aggregate views to avoid full table scans in app code
DROP VIEW IF EXISTS public.v_novel_rating_stats;
CREATE VIEW public.v_novel_rating_stats
WITH (security_invoker = true) AS
SELECT
  novel_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*)::int AS rating_count
FROM public.novel_ratings
GROUP BY novel_id;

DROP VIEW IF EXISTS public.v_chapter_rating_stats;
CREATE VIEW public.v_chapter_rating_stats
WITH (security_invoker = true) AS
SELECT
  chapter_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*)::int AS rating_count
FROM public.chapter_ratings
GROUP BY chapter_id;

DROP VIEW IF EXISTS public.v_novel_chapter_rating_stats;
CREATE VIEW public.v_novel_chapter_rating_stats
WITH (security_invoker = true) AS
SELECT
  c.novel_id,
  ROUND(AVG(cr.rating)::numeric, 1) AS avg_rating,
  COUNT(*)::int AS rating_count
FROM public.chapter_ratings cr
JOIN public.chapters c ON c.id = cr.chapter_id
GROUP BY c.novel_id;

DROP VIEW IF EXISTS public.v_comment_reaction_counts;
CREATE VIEW public.v_comment_reaction_counts
WITH (security_invoker = true) AS
SELECT
  comment_id,
  COUNT(*) FILTER (WHERE reaction_type = 'like')::int AS likes,
  COUNT(*) FILTER (WHERE reaction_type = 'dislike')::int AS dislikes
FROM public.comment_reactions
GROUP BY comment_id;

DROP VIEW IF EXISTS public.v_chapter_comment_counts;
CREATE VIEW public.v_chapter_comment_counts
WITH (security_invoker = true) AS
SELECT
  chapter_id,
  COUNT(*)::int AS comment_count
FROM public.comments
WHERE is_deleted = false
GROUP BY chapter_id;

GRANT SELECT ON public.v_novel_rating_stats TO anon, authenticated;
GRANT SELECT ON public.v_chapter_rating_stats TO anon, authenticated;
GRANT SELECT ON public.v_novel_chapter_rating_stats TO anon, authenticated;
GRANT SELECT ON public.v_comment_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.v_chapter_comment_counts TO anon, authenticated;
