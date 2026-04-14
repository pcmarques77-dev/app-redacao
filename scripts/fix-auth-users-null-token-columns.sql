-- Corrige erro do GoTrue: "Scan error ... confirmation_token: converting NULL to string is unsupported"
-- ao chamar auth.admin.deleteUser / login / getUser em utilizadores antigos ou criados fora do fluxo padrão.
--
-- Executar no Supabase Dashboard → SQL Editor (uma vez, ou sempre que o log voltar a mostrar NULL nestas colunas).
-- Requer permissões sobre auth.users (conta postgres / service role na SQL Editor).

-- Mínimo (coluna citada no teu log):
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

-- Recomendado: alinhar outras colunas de token comuns em auth.users (Supabase hosted).
-- Se o Editor acusar coluna inexistente, remove essa linha do SET e do WHERE.
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, '')
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change IS NULL
  OR email_change_token_new IS NULL;
