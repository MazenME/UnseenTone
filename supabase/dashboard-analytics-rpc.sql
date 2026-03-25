-- Dashboard analytics RPC returning a pre-shaped payload

create or replace function public.get_dashboard_analytics(
  p_role text,
  p_allowed_novel_ids uuid[] default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
with scoped_novels as (
  select n.id, n.title, n.slug, n.status, n.total_reads, n.created_at, n.cover_url
  from public.novels n
  where p_role <> 'novel_admin'
     or (p_allowed_novel_ids is not null and n.id = any(p_allowed_novel_ids))
),
scoped_chapters as (
  select c.id, c.novel_id, c.chapter_number, c.title, c.reads, c.word_count, c.created_at
  from public.chapters c
  where c.is_published = true
    and c.novel_id in (select id from scoped_novels)
),
comment_counts as (
  select chapter_id, comment_count
  from public.v_chapter_comment_counts
  where chapter_id in (select id from scoped_chapters)
),
chapter_rating_stats as (
  select chapter_id, avg_rating, rating_count
  from public.v_chapter_rating_stats
  where chapter_id in (select id from scoped_chapters)
),
novel_rating_stats as (
  select novel_id, avg_rating, rating_count
  from public.v_novel_rating_stats
  where novel_id in (select id from scoped_novels)
),
novel_chapter_rating_stats as (
  select novel_id, avg_rating, rating_count
  from public.v_novel_chapter_rating_stats
  where novel_id in (select id from scoped_novels)
),
chapter_payload as (
  select
    c.novel_id,
    count(*)::int as chapter_count,
    coalesce(sum(c.word_count), 0)::int as total_words,
    coalesce(sum(coalesce(cc.comment_count, 0)), 0)::int as total_comments,
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'chapter_number', c.chapter_number,
        'title', c.title,
        'reads', c.reads,
        'word_count', c.word_count,
        'comment_count', coalesce(cc.comment_count, 0),
        'created_at', c.created_at,
        'avg_rating', coalesce(cr.avg_rating, 0),
        'rating_count', coalesce(cr.rating_count, 0)
      )
      order by c.chapter_number asc
    ) as chapters
  from scoped_chapters c
  left join comment_counts cc on cc.chapter_id = c.id
  left join chapter_rating_stats cr on cr.chapter_id = c.id
  group by c.novel_id
),
novel_payload as (
  select
    n.id,
    n.title,
    n.slug,
    n.status,
    n.total_reads,
    n.created_at,
    n.cover_url,
    coalesce(cp.chapter_count, 0) as chapter_count,
    coalesce(cp.total_words, 0) as total_words,
    coalesce(cp.total_comments, 0) as total_comments,
    coalesce(nr.avg_rating, 0)::numeric as novel_avg_rating,
    coalesce(nr.rating_count, 0)::int as novel_rating_count,
    coalesce(ncr.avg_rating, 0)::numeric as chapter_avg_rating,
    coalesce(ncr.rating_count, 0)::int as chapter_rating_count,
    coalesce(cp.chapters, '[]'::jsonb) as chapters
  from scoped_novels n
  left join chapter_payload cp on cp.novel_id = n.id
  left join novel_rating_stats nr on nr.novel_id = n.id
  left join novel_chapter_rating_stats ncr on ncr.novel_id = n.id
),
rollup as (
  select
    case when p_role = 'novel_admin' then 0 else (select count(*) from public.users_profile)::int end as total_users,
    (select count(*) from scoped_novels)::int as total_novels,
    coalesce((select sum(total_reads) from scoped_novels), 0)::bigint as total_reads,
    coalesce((select sum(total_comments) from novel_payload), 0)::bigint as total_comments
)
select jsonb_build_object(
  'totalUsers', r.total_users,
  'totalNovels', r.total_novels,
  'totalReads', r.total_reads,
  'totalComments', r.total_comments,
  'novelAnalytics', coalesce((select jsonb_agg(to_jsonb(np) order by np.created_at desc) from novel_payload np), '[]'::jsonb)
)
from rollup r;
$$;

grant execute on function public.get_dashboard_analytics(text, uuid[]) to authenticated;
grant execute on function public.get_dashboard_analytics(text, uuid[]) to service_role;
