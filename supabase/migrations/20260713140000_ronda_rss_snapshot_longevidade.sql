-- Quarto snapshot: Ronda Longevidade (id=4). ids 1–3 permanecem Gov, Tech e INSS.

alter table public.ronda_rss_snapshot
  drop constraint if exists ronda_rss_snapshot_ids;

alter table public.ronda_rss_snapshot
  add constraint ronda_rss_snapshot_ids check (id in (1, 2, 3, 4));

comment on table public.ronda_rss_snapshot is
  'Agregados RSS do Radar de Pautas (evita fetch na Vercel). id 1 = Ronda Gov, id 2 = Ronda Tech, id 3 = Ronda INSS, id 4 = Ronda Longevidade.';

comment on column public.ronda_rss_snapshot.id is
  '1 = Ronda Gov, 2 = Ronda Tech, 3 = Ronda INSS, 4 = Ronda Longevidade';

insert into public.ronda_rss_snapshot (id, payload)
values (4, '{"ok":true,"noticias":[],"total":0}'::jsonb)
on conflict (id) do nothing;
