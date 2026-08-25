# Snapshots do Radar de Pautas

Os agregados RSS (Gov, Tech, INSS, Longevidade, Jornais) e o Google Trends ficam em tabelas Supabase (`ronda_rss_snapshot`, `trends_seo_snapshot`). A app na Vercel **lê** esses snapshots; a **gravação** não depende do deploy.

## Fonte principal: crontab no servidor

No servidor (Mac Mini / Linux), um **crontab** roda **de hora em hora** e executa:

- `npm run ronda:push-snapshot`
- `npm run trends:push-snapshot`

Scripts:

- Wrapper do cron: [`scripts/linux/run-ronda-snapshot.sh`](../scripts/linux/run-ronda-snapshot.sh)
- Só ajustar o horário do cron: [`scripts/linux/ensure-hourly-cron.sh`](../scripts/linux/ensure-hourly-cron.sh)
- Setup completo (clone, deps, cron): [`scripts/linux/setup-ronda-scraper.sh`](../scripts/linux/setup-ronda-scraper.sh)

Horário padrão: `0 * * * *` (a cada hora, no minuto 0). Logs: `logs/ronda-snapshot.log` no diretório do app.

Requer `.env.local` no servidor com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

### Quando tiver acesso ao servidor de novo

O banco ainda pode estar no ritmo antigo (3×/dia: 10h, 16h, 19h BRT). Para passar a **hora em hora**:

```bash
cd ~/app-redacao   # ou o APP_DIR real
git pull --ff-only
bash scripts/linux/ensure-hourly-cron.sh
crontab -l         # deve mostrar: 0 * * * * ... run-ronda-snapshot.sh
# opcional — gravar um snapshot na hora:
npm run ronda:push-snapshot && npm run trends:push-snapshot
```

Isso **substitui** a linha antiga do cron; não precisa editar o crontab à mão.

## Contingência: GitHub Actions

O workflow [`.github/workflows/ronda-rss-snapshot.yml`](../.github/workflows/ronda-rss-snapshot.yml) existe para **indisponibilidade temporária do servidor**. Não é o caminho normal de atualização.

- Disparo manual: Actions → **Radar RSS snapshots** → *Run workflow* (`workflow_dispatch`)
- Não há schedule ativo no workflow; reative um `schedule` só se o servidor estiver fora do ar por período prolongado

Secrets necessários: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Página `/ronda-rss` (Radar de Pautas)

Ao abrir a página ou trocar de aba, o cliente **lê** o último snapshot no Supabase.

O botão **Atualizar Radar de Pautas** grava um snapshot novo (equivalente a `npm run ronda:push-snapshot` via `POST /api/ronda-rss/push-snapshot`) e depois relê a aba atual. Útil enquanto o crontab horário ainda não estiver ativo no servidor.
