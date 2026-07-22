-- Habilita postgres_changes do Supabase Realtime para o calendário.
alter publication supabase_realtime add table public.pautas;
alter publication supabase_realtime add table public.escalas;
