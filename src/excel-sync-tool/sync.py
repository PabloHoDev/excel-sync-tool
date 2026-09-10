"""
excel_sync.sync
================

Motor de sincronização de dados entre uma fonte (CSV ou Excel) e um arquivo
Excel de destino com múltiplas abas.

Contexto do problema (genérico, aplicável a qualquer operação):
-----------------------------------------------------------------
Toda empresa que opera com planilhas de controle (backlog, pipeline, status
de tarefas, obrigações, chamados etc.) enfrenta o mesmo problema: um sistema
externo exporta dados atualizados todos os dias (um CSV, um relatório, uma
base "fonte da verdade"), e essas atualizações precisam ser refletidas em
uma planilha de controle interna, que geralmente está espalhada em várias
abas e não pode simplesmente ser sobrescrita (tem formatação, comentários,
histórico, proteção de células etc.).

Fazer isso manualmente, linha a linha, aba a aba, é lento e sujeito a erro
humano. Este módulo resolve esse problema de forma genérica:

1. Lê os registros "atuais" de uma fonte (CSV ou Excel).
2. Para cada registro, localiza a linha correspondente no arquivo de
   destino, procurando em todas as abas por uma coluna-chave (ex.: um ID,
   um código, um nome de tarefa).
3. Atualiza apenas as colunas configuradas, e apenas quando o valor
   realmente mudou.
4. Preserva a proteção de aba (se houver) e formatação existente.
5. Gera um log completo (o que mudou, de que para que, onde, quando) para
   auditoria.

Nenhuma regra de negócio específica fica hard-coded: nomes de colunas,
linha do cabeçalho, abas a ignorar e senha de proteção vêm de um arquivo de
configuração (ver `config.example.yaml`).
"""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

logger = logging.getLogger("excel_sync")


@dataclass
class SyncConfig:
    """Configuração de uma execução de sincronização."""

    source_path: Path
    target_path: Path
    key_column: str
    update_columns: list[str]
    header_row: int = 1
    sheet_password: str | None = None
    ignored_sheets: list[str] = field(default_factory=list)
    log_path: Path | None = None


@dataclass
class ChangeRecord:
    """Uma linha do log: o que mudou (ou não) em uma atualização."""

    timestamp: str
    sheet: str
    key_value: str
    row: int
    updated_columns: list[str]
    old_values: dict[str, str]
    new_values: dict[str, str]
    status: str  # "OK", "SEM_MUDANCA", "NAO_ENCONTRADO"
    message: str = ""


def _read_source_rows(path: Path) -> list[dict[str, Any]]:
    """Lê a fonte de dados (CSV ou Excel) e devolve uma lista de dicts."""
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [
        {header[i]: (row[i] if i < len(row) else None) for i in range(len(header))}
        for row in rows[1:]
    ]


def _find_header_indices(
    sheet: Worksheet, header_row: int, wanted: list[str]
) -> dict[str, int] | None:
    """Procura os nomes de coluna `wanted` na linha `header_row` da aba.

    Retorna {nome_coluna: índice_1based} ou None se alguma coluna não existir.
    """
    values = {}
    for cell in sheet[header_row]:
        if cell.value is not None:
            values[str(cell.value).strip()] = cell.column

    indices = {name: values[name] for name in wanted if name in values}
    if len(indices) != len(wanted):
        return None
    return indices


def sync(config: SyncConfig) -> list[ChangeRecord]:
    """Executa a sincronização e devolve a lista de mudanças (o log)."""
    logger.info("Lendo fonte: %s", config.source_path)
    source_rows = _read_source_rows(config.source_path)
    logger.info("Registros lidos da fonte: %d", len(source_rows))

    logger.info("Abrindo destino: %s", config.target_path)
    wb = load_workbook(config.target_path)

    wanted_columns = [config.key_column, *config.update_columns]
    changes: list[ChangeRecord] = []

    total = len(source_rows)
    for i, record in enumerate(source_rows, start=1):
        key_value = str(record.get(config.key_column, "")).strip()
        if not key_value:
            continue

        if i % 50 == 0 or i == total:
            logger.info("Processando %d/%d (%.1f%%)", i, total, i / total * 100)

        target_sheet, target_row, col_idx = _locate_row(
            wb, config, wanted_columns, key_value
        )

        if target_sheet is None:
            changes.append(
                ChangeRecord(
                    timestamp=datetime.now().isoformat(timespec="seconds"),
                    sheet="(N/A)",
                    key_value=key_value,
                    row=i,
                    updated_columns=[],
                    old_values={},
                    new_values={},
                    status="NAO_ENCONTRADO",
                    message="Chave não encontrada em nenhuma aba válida",
                )
            )
            continue

        was_protected = target_sheet.protection.sheet
        if was_protected:
            target_sheet.protection.set_password(config.sheet_password or "")
            target_sheet.protection.sheet = False

        updated_cols: list[str] = []
        old_values: dict[str, str] = {}
        new_values: dict[str, str] = {}

        for col_name in config.update_columns:
            idx = col_idx[col_name]
            current = target_sheet.cell(row=target_row, column=idx).value
            current_str = "" if current is None else str(current).strip()
            new_val = record.get(col_name)
            new_str = "" if new_val is None else str(new_val).strip()

            if new_str and new_str != current_str:
                target_sheet.cell(row=target_row, column=idx).value = new_str
                updated_cols.append(col_name)
                old_values[col_name] = current_str
                new_values[col_name] = new_str

        if was_protected:
            target_sheet.protection.sheet = True

        changes.append(
            ChangeRecord(
                timestamp=datetime.now().isoformat(timespec="seconds"),
                sheet=target_sheet.title,
                key_value=key_value,
                row=target_row,
                updated_columns=updated_cols,
                old_values=old_values,
                new_values=new_values,
                status="OK" if updated_cols else "SEM_MUDANCA",
                message="Atualizado" if updated_cols else "Valores iguais",
            )
        )

    wb.save(config.target_path)
    logger.info("Destino salvo: %s", config.target_path)

    if config.log_path:
        _write_log(changes, config.log_path)
        logger.info("Log salvo: %s", config.log_path)

    return changes


def _locate_row(
    wb, config: SyncConfig, wanted_columns: list[str], key_value: str
) -> tuple[Worksheet | None, int | None, dict[str, int] | None]:
    """Procura `key_value` na coluna-chave em todas as abas válidas."""
    for sheet in wb.worksheets:
        if sheet.title in config.ignored_sheets:
            continue

        col_idx = _find_header_indices(sheet, config.header_row, wanted_columns)
        if col_idx is None:
            continue

        key_idx = col_idx[config.key_column]
        for row in range(config.header_row + 1, sheet.max_row + 1):
            cell_value = sheet.cell(row=row, column=key_idx).value
            if cell_value is not None and str(cell_value).strip() == key_value:
                return sheet, row, col_idx

    return None, None, None


def _write_log(changes: list[ChangeRecord], log_path: Path) -> None:
    """Grava o log de mudanças em CSV."""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    all_update_cols: list[str] = []
    for c in changes:
        for col in c.updated_columns:
            if col not in all_update_cols:
                all_update_cols.append(col)

    fieldnames = ["timestamp", "sheet", "key_value", "row", "status", "message", "updated_columns"]
    for col in all_update_cols:
        fieldnames += [f"old_{col}", f"new_{col}"]

    with log_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in changes:
            row = {
                "timestamp": c.timestamp,
                "sheet": c.sheet,
                "key_value": c.key_value,
                "row": c.row,
                "status": c.status,
                "message": c.message,
                "updated_columns": ";".join(c.updated_columns),
            }
            for col in all_update_cols:
                row[f"old_{col}"] = c.old_values.get(col, "")
                row[f"new_{col}"] = c.new_values.get(col, "")
            writer.writerow(row)
