-- Segundo snapshot: Ronda Tech (id=2). id=1 permanece Ronda Gov.

alter table public.ronda_rss_snapshot
  drop constraint if exists ronda_rss_snapshot_singleton;

alter table public.ronda_rss_snapshot
  add constraint ronda_rss_snapshot_ids check (id in (1, 2));

comment on table public.ronda_rss_snapshot is
  'Agregados RSS do Radar de Pautas (evita fetch na Vercel). id 1 = Ronda Gov, id 2 = Ronda Tech.';

comment on column public.ronda_rss_snapshot.id is
  '1 = Ronda Gov, 2 = Ronda Tech';

insert into public.ronda_rss_snapshot (id, payload)
values (2, '{"ok":true,"noticias":[],"total":0}'::jsonb)
on conflict (id) do nothing;
