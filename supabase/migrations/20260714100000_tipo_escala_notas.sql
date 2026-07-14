-- Marcação privada de notas pessoais na tabela `escalas` (enum `tipo_escala`).
-- Privacidade é aplicada nas Server Actions (só o dono recebe/edita essas linhas).
ALTER TYPE public.tipo_escala ADD VALUE IF NOT EXISTS 'Notas';
