-- Hard news production queue: flag on pautas (excluded from calendar).
alter table public.pautas
  add column if not exists hard_news boolean not null default false;

create index if not exists pautas_hard_news_status_idx
  on public.pautas (status, data_criacao desc)
  where hard_news = true;

comment on column public.pautas.hard_news is
  'Quando true, item da fila de hard news (só editores; fora do calendário).';
