-- One-time repair script for stale reading_progress percentages.
-- Recomputes progress as novel-level completion based on chapter position + in-chapter remainder.

with published as (
  select
    c.novel_id,
    c.chapter_number,
    row_number() over (partition by c.novel_id order by c.chapter_number asc) - 1 as completed_before,
    count(*) over (partition by c.novel_id) as total_chapters
  from public.chapters c
  where c.is_published = true
),
normalized as (
  select
    rp.user_id,
    rp.novel_id,
    rp.chapter_id,
    rp.chapter_number,
    case
      when p.total_chapters is null or p.total_chapters <= 0 then rp.progress_percent
      else greatest(
        0,
        least(
          100,
          round(((p.completed_before + (rp.progress_percent::numeric / 100.0)) / p.total_chapters) * 100)
        )
      )::int
    end as normalized_percent
  from public.reading_progress rp
  left join published p
    on p.novel_id = rp.novel_id
   and p.chapter_number = rp.chapter_number
)
update public.reading_progress rp
set
  progress_percent = n.normalized_percent,
  updated_at = timezone('utc', now())
from normalized n
where rp.user_id = n.user_id
  and rp.novel_id = n.novel_id;
