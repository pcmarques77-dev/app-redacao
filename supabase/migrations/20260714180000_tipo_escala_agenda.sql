-- Eventos de agenda no calendário (título + editoria na tabela `escalas`).
ALTER TYPE public.tipo_escala ADD VALUE IF NOT EXISTS 'Agenda';
