-- Terceiro snapshot: Ronda INSS (id=3). ids 1 e 2 permanecem Gov e Tech.

alter table public.ronda_rss_snapshot
  drop constraint if exists ronda_rss_snapshot_ids;

alter table public.ronda_rss_snapshot
  add constraint ronda_rss_snapshot_ids check (id in (1, 2, 3));

comment on table public.ronda_rss_snapshot is
  'Agregados RSS do Radar de Pautas (evita fetch na Vercel). id 1 = Ronda Gov, id 2 = Ronda Tech, id 3 = Ronda INSS.';

comment on column public.ronda_rss_snapshot.id is
  '1 = Ronda Gov, 2 = Ronda Tech, 3 = Ronda INSS';

insert into public.ronda_rss_snapshot (id, payload)
values (3, '{"ok":true,"noticias":[],"total":0}'::jsonb)
on conflict (id) do nothing;
