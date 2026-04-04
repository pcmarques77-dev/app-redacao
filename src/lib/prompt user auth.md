Segue um **prompt pronto** para você colar quando for fazer a migração (ajuste só o que for específico do seu projeto):

---

## Prompt sugerido (copiar e colar)

**Contexto:** O app Next.js usa Supabase. Hoje a página **Admin de usuários** (`/admin` e `/admin/novo-usuario`) faz CRUD na tabela **`public.usuarios`** via `SUPABASE_SERVICE_ROLE_KEY` (ver `src/app/actions/admin.ts`). O restante do site (pautas, selects de reporter, etc.) depende de **`public.usuarios`** (ex.: FKs, joins).

**Já feito manualmente:** Os e-mails da equipe foram atualizados em **`public.usuarios`**.

**Objetivos (nesta ordem):**

1. **Popular `auth.users`** a partir dos registros de `public.usuarios` que ainda não têm conta no Auth (ou estratégia equivalente definida por você), usando a **API Admin** do Supabase (`auth.admin.createUser` / batch seguro).
2. **Senha padrão:** definir uma senha inicial comum (ou por usuário) e configurar o fluxo para **obrigar redefinição no primeiro acesso** (ex.: flag/metadata + checagem no login, ou **“forced password reset”** / recovery conforme o que o Supabase permitir na versão do projeto). Documentar no código onde isso é aplicado.
3. **Alinhar IDs:** garantir que o `id` em `public.usuarios` seja o mesmo **`auth.users.id`** para cada pessoa (migrar/atualizar linhas existentes se necessário), para não quebrar FKs.
4. **Refatorar a UI Admin:** a página de admin deve passar a listar/criar/editar/excluir usuários **via Auth** (como antes era concebido com `listUsers` / `auth.admin`), **deixando de usar a tabela `public.usuarios` como fonte principal da listagem** nessa tela.
5. **Replicação automática:** sempre que um usuário for **criado no Auth** (pelo admin do app), **inserir ou atualizar automaticamente** a linha correspondente em **`public.usuarios`** (campos mínimos: `id`, `nome`, e opcionalmente `email`, `funcao`, etc., conforme schema), para **não comprometer** selects, pautas e RLS que dependem de `usuarios`.
6. **Exclusão:** definir comportamento consistente (ex.: apagar no Auth e cascatear/limpar `public.usuarios`, ou política explícita) e refletir na UI.
7. **Segurança:** manter operações sensíveis em **server actions** ou rotas server-only com sessão válida; continuar usando service role só no servidor; não expor `SUPABASE_SERVICE_ROLE_KEY` ao cliente.

**Arquivos prováveis:** `src/app/actions/admin.ts`, `src/app/admin/page.tsx`, `src/app/admin/novo-usuario/page.tsx`, possivelmente `middleware.ts` e fluxo de login para “primeiro acesso / trocar senha”.

**Critério de sucesso:** Admin opera **Auth** como fonte de verdade para contas; `public.usuarios` permanece **sincronizado** para o restante do app; primeiro login força (ou orienta de forma inequívoca) **redefinição de senha**; nada quebre em `nova-pauta`, `pauta/[id]` ou dashboards que leem `usuarios`.

---

Se quiser deixar ainda mais objetivo para o assistente, acrescente uma linha com: **quantidade aproximada de usuários**, se **`public.usuarios.id` já é UUID igual ao futuro `auth.users.id`**, e se existe **trigger** no Supabase hoje entre Auth e `usuarios`.