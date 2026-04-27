-- Snapshot do Radar de Pautas: preenchido por job no Linux (service role).
-- Leitura na Vercel via SUPABASE_SERVICE_ROLE_KEY na rota /api/ronda-rss.

create table if not exists public.ronda_rss_snapshot (
  id smallint primary key default 1,
  constraint ronda_rss_snapshot_singleton check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.ronda_rss_snapshot is
  'Último agregado RSS do Radar de Pautas (evita fetch na Vercel).';

alter table public.ronda_rss_snapshot enable row level security;

insert into public.ronda_rss_snapshot (id, payload)
values (1, '{"ok":true,"noticias":[],"total":0}'::jsonb)
on conflict (id) do nothing;
