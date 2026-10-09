-- Histórico de execuções da sincronização exibido no painel da demo.
--
-- Segurança: RLS ligado e nenhuma policy pública. Só o servidor (Route
-- Handler / Server Components, com a secret key) lê e grava. O navegador
-- nunca fala direto com o banco.

create table public.sync_runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  origin        text not null check (origin in ('seed', 'demo', 'upload')),
  day           integer,                       -- dia simulado (só origin = demo/seed)
  total         integer not null check (total >= 0),
  updated       integer not null check (updated >= 0),
  unchanged     integer not null check (unchanged >= 0),
  not_found     integer not null check (not_found >= 0),
  cells_changed integer not null check (cells_changed >= 0),
  duration_ms   integer not null check (duration_ms >= 0),
  by_sheet      jsonb not null default '{}'::jsonb
);

create index sync_runs_created_at_idx on public.sync_runs (created_at desc);

-- Detalhe das alterações. Só é gravado para o cenário fictício (demo/seed):
-- arquivos enviados por visitantes nunca têm conteúdo armazenado, só contagens.
create table public.sync_changes (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references public.sync_runs (id) on delete cascade,
  sheet       text not null,
  key_value   text not null,
  row_number  integer not null,
  column_name text not null,
  old_value   text not null default '',
  new_value   text not null
);

create index sync_changes_run_id_idx on public.sync_changes (run_id);

alter table public.sync_runs enable row level security;
alter table public.sync_changes enable row level security;

-- Totais agregados para os cards do painel (evita trazer todas as linhas).
create view public.sync_totals
with (security_invoker = true) as
select
  count(*)::int                     as runs,
  coalesce(sum(total), 0)::int      as records,
  coalesce(sum(updated), 0)::int    as updated,
  coalesce(sum(cells_changed), 0)::int as cells_changed,
  coalesce(sum(not_found), 0)::int  as not_found,
  coalesce(avg(duration_ms), 0)::int as avg_duration_ms
from public.sync_runs;

-- Limpeza: mantém o histórico da demo enxuto (chamado após cada execução).
create function public.prune_sync_runs(keep integer default 500)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.sync_runs
  where origin <> 'seed'
    and id not in (
      select id from public.sync_runs
      where origin <> 'seed'
      order by created_at desc
      limit keep
    );
$$;

revoke all on function public.prune_sync_runs(integer) from public, anon, authenticated;
