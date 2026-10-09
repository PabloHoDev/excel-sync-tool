# excel-sync-web

Demonstração web do **excel-sync-tool**: o mesmo algoritmo da CLI Python,
portado para TypeScript, rodando em Next.js na Vercel, com o histórico das
execuções no Supabase.

| Rota | O que faz |
|---|---|
| `/` | Apresentação do problema e da solução |
| `/demo` | Roda a sincronização num cenário fictício (ou com os seus arquivos), mostra cada célula alterada e permite baixar o `.xlsx` atualizado e o log |
| `/painel` | Histórico das execuções: volume conferido, atualizações por aba, tempo manual evitado |
| `POST /api/sync` | Executa a sincronização (JSON `{ day }` para o cenário, ou `multipart/form-data` com arquivos) |
| `GET /api/demo-files` | Baixa a planilha de controle e a exportação de um dia do cenário |

## Arquitetura

```
navegador ──► Route Handler /api/sync (Node.js, Vercel Function)
                 │  exceljs + papaparse
                 ├─► src/lib/engine   motor de sincronização (puro, testado com Vitest)
                 └─► src/lib/db.ts    supabase-js com secret key (server-only)
                                         │
                                         ▼
                                  Supabase Postgres
                                  sync_runs · sync_changes (RLS ligado, sem policies públicas)
```

- **O navegador nunca fala com o banco.** A secret key só existe no servidor
  (`import "server-only"`); as tabelas têm RLS ligado e nenhuma policy pública.
- **Arquivos enviados não são armazenados.** São processados em memória; só
  as contagens vão para `sync_runs`. O detalhe célula a célula (`sync_changes`)
  só é gravado para o cenário fictício.
- **Sem banco configurado, o app continua funcionando:** a demo roda
  normalmente e o painel mostra 30 dias ilustrativos gerados pelo mesmo
  cenário do seed.

## O cenário fictício

A *Nimbus Serviços* controla 160 processos em 4 abas (uma por equipe), com
cabeçalho na linha 4, aba protegida por senha e uma aba de resumo que deve
ser ignorada. A exportação de cada "dia" é gerada por um PRNG com semente,
então o mesmo dia produz sempre o mesmo resultado. Cerca de 20% dos
processos mudam de status, ~5% trocam de equipe e de 1 a 4 códigos novos
aparecem (os "não encontrados").

O tempo manual evitado usa uma premissa explícita e exibida na interface:
**20 segundos por registro conferido à mão** (`src/lib/metrics.ts`).

## Rodando localmente

```bash
cd web
npm install
npm run dev          # http://localhost:3000 (modo ilustrativo, sem banco)
npm test             # testes do motor (Vitest)
npm run lint && npm run typecheck && npm run build
```

Para ligar o Supabase localmente, copie `.env.example` para `.env.local` e
preencha as variáveis.

## Deploy (Supabase + Vercel)

1. **Supabase:** crie um projeto e, no *SQL Editor*, rode em ordem
   `supabase/migrations/20261009000000_create_sync_runs.sql` e
   `supabase/seed.sql` (30 dias de histórico ilustrativo). Com a CLI:
   `supabase link` + `supabase db push`.
2. **Vercel:** importe o repositório e defina **Root Directory = `web`**.
3. Em *Environment Variables*, defina `SUPABASE_URL` e `SUPABASE_SECRET_KEY`
   (Project Settings → API do Supabase).
4. Deploy. Cada execução feita em `/demo` aparece em `/painel`.

Para regenerar o seed depois de mudar o cenário: `npm run db:seed:generate`.

## Limites da demo pública

- Até 2 MB por arquivo (o limite de body das Functions da Vercel é 4,5 MB) e
  20 mil linhas na fonte.
- Limite de 20 execuções por minuto por IP, em memória (melhor esforço em
  serverless; para algo mais forte, use Vercel Firewall ou Upstash).
- O histórico de execuções da demo é podado para as 500 mais recentes.
- Estilos, larguras, mesclagens e proteção de aba são preservados. Gráficos e
  imagens embutidas, não: tanto o exceljs (web) quanto o openpyxl (CLI)
  descartam esses objetos ao regravar o arquivo. Planilhas de controle com
  gráficos devem mantê-los numa pasta de trabalho separada.
