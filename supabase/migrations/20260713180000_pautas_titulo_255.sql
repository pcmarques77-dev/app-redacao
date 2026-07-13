-- Amplia título provisório para acomodar pautas importadas do CSV.
ALTER TABLE public.pautas
  ALTER COLUMN titulo_provisorio TYPE varchar(255);
