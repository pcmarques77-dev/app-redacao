-- Formatos de multimídia escolhidos no formulário da pauta.
alter table public.pautas
  add column if not exists tipos_multimidia text[] not null default '{}';

alter table public.pautas
  drop constraint if exists pautas_tipos_multimidia_check;

alter table public.pautas
  add constraint pautas_tipos_multimidia_check
  check (
    tipos_multimidia <@ array[
      'Viva Entrevista',
      'Viva Compartilha',
      'Viva Responde',
      'Carrossel'
    ]::text[]
  );

comment on column public.pautas.tipos_multimidia is
  'Formatos pedidos quando a pauta tem demanda de multimídia. Vazio quando não há demanda.';
