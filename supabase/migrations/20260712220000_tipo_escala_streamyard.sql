-- Permite cadastro Streamyard na tabela `escalas` (enum `tipo_escala`).
ALTER TYPE public.tipo_escala ADD VALUE IF NOT EXISTS 'Streamyard';
