"""
excel_sync.cli
===============

Interface de linha de comando. Permite rodar a sincronização todos os dias
(manualmente, via Agendador de Tarefas do Windows, cron, GitHub Actions
com runner self-hosted, etc.) sem precisar abrir o Excel.

Uso:
    python -m excel_sync.cli --config config.yaml

    # ou passando tudo via linha de comando, sem arquivo de config:
    python -m excel_sync.cli \\
        --source dados_sistema.csv \\
        --target controle.xlsx \\
        --key "Codigo" \\
        --update "Area" "Status" \\
        --log log_atualizacao.csv
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import yaml

from .sync import SyncConfig, sync


def _load_yaml_config(path: Path) -> SyncConfig:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return SyncConfig(
        source_path=Path(data["source_path"]),
        target_path=Path(data["target_path"]),
        key_column=data["key_column"],
        update_columns=list(data["update_columns"]),
        header_row=int(data.get("header_row", 1)),
        sheet_password=data.get("sheet_password") or None,
        ignored_sheets=list(data.get("ignored_sheets", [])),
        log_path=Path(data["log_path"]) if data.get("log_path") else None,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="excel-sync",
        description="Sincroniza colunas de um arquivo-fonte (CSV/Excel) com um Excel de destino de múltiplas abas.",
    )
    parser.add_argument("--config", type=Path, help="Arquivo YAML de configuração.")
    parser.add_argument("--source", type=Path, help="Arquivo fonte (CSV ou Excel).")
    parser.add_argument("--target", type=Path, help="Arquivo Excel de destino.")
    parser.add_argument("--key", type=str, help="Nome da coluna-chave usada para localizar a linha.")
    parser.add_argument("--update", nargs="+", help="Nomes das colunas a atualizar.")
    parser.add_argument("--header-row", type=int, default=1, help="Linha do cabeçalho no destino (padrão: 1).")
    parser.add_argument("--ignore-sheets", nargs="*", default=[], help="Abas a ignorar na busca.")
    parser.add_argument("--sheet-password", type=str, default=None, help="Senha de proteção das abas, se houver.")
    parser.add_argument("--log", type=Path, default=None, help="Onde salvar o log CSV da execução.")
    parser.add_argument("-v", "--verbose", action="store_true", help="Log detalhado no console.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.config:
        config = _load_yaml_config(args.config)
    else:
        if not (args.source and args.target and args.key and args.update):
            parser.error("Sem --config, é obrigatório informar --source, --target, --key e --update.")
        config = SyncConfig(
            source_path=args.source,
            target_path=args.target,
            key_column=args.key,
            update_columns=args.update,
            header_row=args.header_row,
            sheet_password=args.sheet_password,
            ignored_sheets=args.ignore_sheets,
            log_path=args.log,
        )

    changes = sync(config)

    updated = sum(1 for c in changes if c.status == "OK")
    unchanged = sum(1 for c in changes if c.status == "SEM_MUDANCA")
    not_found = sum(1 for c in changes if c.status == "NAO_ENCONTRADO")

    print()
    print("Resumo da sincronização")
    print("------------------------")
    print(f"Atualizados:      {updated}")
    print(f"Sem mudança:      {unchanged}")
    print(f"Não encontrados:  {not_found}")
    print(f"Total processado: {len(changes)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
