-- Permite tirar uma conta dos seletores de jornalista sem apagar o histórico.
alter table public.usuarios
  add column if not exists oculto_lista_jornalistas boolean not null default false;

comment on column public.usuarios.oculto_lista_jornalistas is
  'Quando true, a conta não entra na lista de jornalistas. Pautas e escalas já atribuídas continuam com o nome.';
