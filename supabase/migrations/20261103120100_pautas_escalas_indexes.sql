-- Consultas do calendário e das chaves estrangeiras que o linter apontou.
-- Tabelas pequenas hoje; os índices evitam varredura quando o histórico crescer.

create index if not exists pautas_calendario_deadline_idx
  on public.pautas (deadline)
  where hard_news = false;

create index if not exists pautas_reporter_id_idx
  on public.pautas (reporter_id);

create index if not exists pautas_editor_id_idx
  on public.pautas (editor_id);

create index if not exists escalas_intervalo_idx
  on public.escalas (data_inicio, data_fim);

create index if not exists escalas_usuario_id_idx
  on public.escalas (usuario_id);

create index if not exists demandas_multimidia_pauta_id_idx
  on public.demandas_multimidia (pauta_id);

create index if not exists fontes_pauta_id_idx
  on public.fontes (pauta_id);
