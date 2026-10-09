"""Testes end-to-end do motor de sincronização."""

import csv
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook

from excel_sync.sync import SyncConfig, sync


@pytest.fixture
def source_csv(tmp_path: Path) -> Path:
    path = tmp_path / "fonte.csv"
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Codigo", "Area", "Status"])
        writer.writerow(["TASK-001", "Financeiro", "Concluido"])
        writer.writerow(["TASK-002", "Juridico", "Em andamento"])
        writer.writerow(["TASK-999", "Comercial", "Pendente"])  # não existe no destino
    return path


@pytest.fixture
def target_xlsx(tmp_path: Path) -> Path:
    path = tmp_path / "destino.xlsx"
    wb = Workbook()

    ws1 = wb.active
    ws1.title = "EquipeA"
    ws1.append(["Codigo", "Area", "Status"])
    ws1.append(["TASK-001", "Financeiro Antigo", "Aberto"])

    ws2 = wb.create_sheet("EquipeB")
    ws2.append(["Codigo", "Area", "Status"])
    ws2.append(["TASK-002", "Juridico", "Aberto"])  # área já igual, só status muda

    ws3 = wb.create_sheet("RESUMO")  # aba a ser ignorada
    ws3.append(["Codigo", "Area", "Status"])

    wb.save(path)
    return path


def test_sync_updates_only_changed_fields(source_csv, target_xlsx, tmp_path):
    log_path = tmp_path / "log.csv"
    config = SyncConfig(
        source_path=source_csv,
        target_path=target_xlsx,
        key_column="Codigo",
        update_columns=["Area", "Status"],
        header_row=1,
        ignored_sheets=["RESUMO"],
        log_path=log_path,
    )

    changes = sync(config)

    by_key = {c.key_value: c for c in changes}

    assert by_key["TASK-001"].status == "OK"
    assert by_key["TASK-001"].updated_columns == ["Area", "Status"]

    assert by_key["TASK-002"].status == "OK"
    assert by_key["TASK-002"].updated_columns == ["Status"]  # área já era igual

    assert by_key["TASK-999"].status == "NAO_ENCONTRADO"

    wb = load_workbook(target_xlsx)
    ws1 = wb["EquipeA"]
    assert ws1["B2"].value == "Financeiro"
    assert ws1["C2"].value == "Concluido"

    ws2 = wb["EquipeB"]
    assert ws2["B2"].value == "Juridico"
    assert ws2["C2"].value == "Em andamento"

    assert log_path.exists()


def test_sync_preserves_sheet_protection(source_csv, target_xlsx):
    wb = load_workbook(target_xlsx)
    wb["EquipeA"].protection.sheet = True
    wb["EquipeA"].protection.set_password("1234")
    wb.save(target_xlsx)

    config = SyncConfig(
        source_path=source_csv,
        target_path=target_xlsx,
        key_column="Codigo",
        update_columns=["Area", "Status"],
        header_row=1,
        ignored_sheets=["RESUMO"],
        sheet_password="1234",
    )
    sync(config)

    wb2 = load_workbook(target_xlsx)
    assert wb2["EquipeA"].protection.sheet is True
    assert wb2["EquipeA"]["B2"].value == "Financeiro"


def test_duplicate_key_keeps_first_occurrence(source_csv, target_xlsx):
    wb = load_workbook(target_xlsx)
    wb["EquipeB"].append(["TASK-001", "Duplicado", "Duplicado"])
    wb.save(target_xlsx)

    config = SyncConfig(
        source_path=source_csv,
        target_path=target_xlsx,
        key_column="Codigo",
        update_columns=["Area", "Status"],
        ignored_sheets=["RESUMO"],
    )
    changes = sync(config)

    task1 = next(c for c in changes if c.key_value == "TASK-001")
    assert task1.sheet == "EquipeA"
    wb2 = load_workbook(target_xlsx)
    assert wb2["EquipeB"]["B3"].value == "Duplicado"  # segunda ocorrência intocada


def test_excel_source_with_blank_key_is_skipped(target_xlsx, tmp_path):
    source = tmp_path / "fonte.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.append(["Codigo", "Area", "Status"])
    ws.append(["TASK-001", "Financeiro", "Concluido"])
    ws.append([None, "Sem chave", "Ignorar"])
    wb.save(source)

    config = SyncConfig(
        source_path=source,
        target_path=target_xlsx,
        key_column="Codigo",
        update_columns=["Area", "Status"],
        ignored_sheets=["RESUMO"],
    )
    changes = sync(config)

    assert [c.key_value for c in changes] == ["TASK-001"]
    assert changes[0].status == "OK"


def test_header_row_offset(source_csv, tmp_path):
    target = tmp_path / "destino.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "EquipeA"
    ws.append(["Relatório de controle"])
    ws.append([])
    ws.append(["Codigo", "Area", "Status"])
    ws.append(["TASK-001", "Antiga", "Aberto"])
    wb.save(target)

    config = SyncConfig(
        source_path=source_csv,
        target_path=target,
        key_column="Codigo",
        update_columns=["Area", "Status"],
        header_row=3,
    )
    sync(config)

    assert load_workbook(target)["EquipeA"]["C4"].value == "Concluido"
