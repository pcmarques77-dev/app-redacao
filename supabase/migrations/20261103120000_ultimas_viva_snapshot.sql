-- Snapshot das Últimas do Viva. A página só lê esta linha.
-- A coleta grava o payload inteiro no fim, quando a raspagem termina.

create table if not exists public.ultimas_viva_snapshot (
  id smallint primary key default 1,
  constraint ultimas_viva_snapshot_singleton check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.ultimas_viva_snapshot is
  'Último índice de reportagens do Viva. Preenchido pelo cron ou pelo botão Atualizar.';

alter table public.ultimas_viva_snapshot enable row level security;

drop policy if exists "ultimas_viva_snapshot_service_role_all" on public.ultimas_viva_snapshot;

create policy "ultimas_viva_snapshot_service_role_all"
on public.ultimas_viva_snapshot
for all
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');
