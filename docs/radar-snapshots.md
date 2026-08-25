# Snapshots do Radar de Pautas

Os agregados RSS (Gov, Tech, INSS, Longevidade, Jornais) e o Google Trends ficam em tabelas Supabase (`ronda_rss_snapshot`, `trends_seo_snapshot`). A app na Vercel **lê** esses snapshots; a **gravação** não depende do deploy.

## Fonte principal: crontab no servidor

No servidor (Mac Mini / Linux), um **crontab** roda **de hora em hora** e executa:

- `npm run ronda:push-snapshot`
- `npm run trends:push-snapshot`

Scripts:

- Wrapper do cron: [`scripts/linux/run-ronda-snapshot.sh`](../scripts/linux/run-ronda-snapshot.sh)
- Setup (clone, deps, cron): [`scripts/linux/setup-ronda-scraper.sh`](../scripts/linux/setup-ronda-scraper.sh)

Horário padrão no setup: `0 * * * *` (a cada hora, no minuto 0). Logs: `logs/ronda-snapshot.log` no diretório do app.

Requer `.env.local` no servidor com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

## Contingência: GitHub Actions

O workflow [`.github/workflows/ronda-rss-snapshot.yml`](../.github/workflows/ronda-rss-snapshot.yml) existe para **indisponibilidade temporária do servidor**. Não é o caminho normal de atualização.

- Disparo manual: Actions → **Radar RSS snapshots** → *Run workflow* (`workflow_dispatch`)
- Não há schedule ativo no workflow; reative um `schedule` só se o servidor estiver fora do ar por período prolongado

Secrets necessários: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Relação com o botão “Atualizar Radar de Pautas”

Na maior parte das abas, o botão **relê** o snapshot no Supabase (ou tenta live com salvaguardas). Ele **não** substitui o job horário do servidor. Conteúdo novo chega quando o crontab (ou a contingência no Actions) grava um snapshot fresco.
