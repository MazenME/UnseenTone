-- Full-text ranked search path for Explore

create index if not exists idx_novels_search_tsv
  on public.novels
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(synopsis, '')));

create or replace function public.search_novels(
  p_query text default '',
  p_limit int default 60
)
returns table (
  id uuid,
  title text,
  slug text,
  synopsis text,
  cover_url text,
  status text,
  total_reads bigint,
  created_at timestamptz,
  last_read_progress int,
  rank real
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  q text := trim(coalesce(p_query, ''));
  lim int := greatest(1, least(coalesce(p_limit, 60), 100));
begin
  return query
  with base as (
    select
      n.id,
      n.title,
      n.slug,
      n.synopsis,
      n.cover_url,
      n.status,
      n.total_reads::bigint,
      n.created_at,
      case
        when q = '' then 0::real
        else ts_rank_cd(
          to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.synopsis, '')),
          plainto_tsquery('simple', q)
        )::real
      end as fts_rank
    from public.novels n
    where
      q = ''
      or to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.synopsis, '')) @@ plainto_tsquery('simple', q)
      or n.title ilike ('%' || q || '%')
      or n.synopsis ilike ('%' || q || '%')
  ),
  scored as (
    select
      b.*,
      (
        case when q <> '' and lower(b.title) like lower(q) || '%' then 3 else 0 end +
        case when q <> '' and lower(b.title) like '%' || lower(q) || '%' then 2 else 0 end +
        case when q <> '' and lower(coalesce(b.synopsis, '')) like '%' || lower(q) || '%' then 1 else 0 end
      )::real as heuristic,
      rp.progress_percent as last_read_progress
    from base b
    left join public.reading_progress rp
      on rp.novel_id = b.id
     and rp.user_id = auth.uid()
  )
  select
    s.id,
    s.title,
    s.slug,
    s.synopsis,
    s.cover_url,
    s.status,
    s.total_reads,
    s.created_at,
    s.last_read_progress,
    (s.fts_rank * 10 + s.heuristic)::real as rank
  from scored s
  order by
    (s.fts_rank * 10 + s.heuristic) desc,
    s.total_reads desc,
    s.created_at desc
  limit lim;
end;
$$;

grant execute on function public.search_novels(text, int) to authenticated;
grant execute on function public.search_novels(text, int) to anon;
