-- Com RLS ativo e sem política, o anon não grava; o service_role costuma bypassar,
-- mas em alguns casos o PostgREST só passa com política explícita.
-- Também cobre confirmação de que o JWT é mesmo service_role (não anon).

drop policy if exists "ronda_rss_snapshot_service_role_all" on public.ronda_rss_snapshot;

create policy "ronda_rss_snapshot_service_role_all"
on public.ronda_rss_snapshot
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
