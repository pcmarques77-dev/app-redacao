-- Snapshot Google Trends BR (descoberta SEO no Radar de Pautas).

create table if not exists public.trends_seo_snapshot (
  id smallint primary key default 1,
  constraint trends_seo_snapshot_singleton check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.trends_seo_snapshot is
  'Último agregado Google Trends BR (RSS Em alta). Evita depender só do fetch na Vercel.';

comment on column public.trends_seo_snapshot.id is
  'Sempre 1 (singleton).';

alter table public.trends_seo_snapshot enable row level security;

drop policy if exists "trends_seo_snapshot_service_role_all" on public.trends_seo_snapshot;

create policy "trends_seo_snapshot_service_role_all"
on public.trends_seo_snapshot
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.trends_seo_snapshot (id, payload)
values (1, '{"ok":true,"noticias":[],"total":0,"geo":"BR","fonte":"google-trends-batchexecute"}'::jsonb)
on conflict (id) do nothing;
