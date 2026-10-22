-- Compromissos públicos dos ministros de Estado (e-Agendas), somente leitura no calendário.
-- Gravação só pelo service role. Linhas antigas permanecem depois da data.

create table if not exists public.agendas_ministros (
  id uuid primary key default gen_random_uuid(),
  cgu_tipo text not null,
  cgu_id text not null,
  apo_id text not null,
  ministro_nome text not null,
  cargo text,
  orgao text,
  tipo_registro text not null,
  assunto text not null,
  local text,
  participantes text,
  data_inicio date not null,
  data_fim date not null,
  hora_inicio text,
  hora_fim text,
  url text,
  updated_at timestamptz not null default now(),
  constraint agendas_ministros_cgu_unique unique (cgu_tipo, cgu_id),
  constraint agendas_ministros_tipo_check check (
    cgu_tipo in ('compromisso', 'viagem', 'afastamento')
  )
);

create index if not exists agendas_ministros_intervalo_idx
  on public.agendas_ministros (data_inicio, data_fim);

comment on table public.agendas_ministros is
  'Compromissos, viagens e afastamentos públicos dos ministros de Estado, copiados do e-Agendas.';

create table if not exists public.agendas_ministros_roster (
  id smallint primary key default 1,
  constraint agendas_ministros_roster_singleton check (id = 1),
  ministros jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

comment on table public.agendas_ministros_roster is
  'Ministros de Estado em exercício, atualizada cerca de 12 horas.';

insert into public.agendas_ministros_roster (id, ministros)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

create table if not exists public.agendas_ministros_sync (
  periodo text primary key,
  sincronizado_em timestamptz not null default now()
);

comment on table public.agendas_ministros_sync is
  'Última sincronização bem-sucedida de cada mês (YYYY-MM) com o e-Agendas.';

alter table public.agendas_ministros enable row level security;
alter table public.agendas_ministros_roster enable row level security;
alter table public.agendas_ministros_sync enable row level security;

drop policy if exists "agendas_ministros_service_role_all" on public.agendas_ministros;
create policy "agendas_ministros_service_role_all"
on public.agendas_ministros
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "agendas_ministros_roster_service_role_all" on public.agendas_ministros_roster;
create policy "agendas_ministros_roster_service_role_all"
on public.agendas_ministros_roster
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "agendas_ministros_sync_service_role_all" on public.agendas_ministros_sync;
create policy "agendas_ministros_sync_service_role_all"
on public.agendas_ministros_sync
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
