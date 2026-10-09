"""Testes da interface de linha de comando."""

from pathlib import Path

import pytest

from excel_sync.cli import main


def test_cli_requires_args_without_config():
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2


def test_cli_missing_file_returns_error(tmp_path: Path, capsys):
    code = main(
        [
            "--source",
            str(tmp_path / "nao_existe.csv"),
            "--target",
            str(tmp_path / "nao_existe.xlsx"),
            "--key",
            "Codigo",
            "--update",
            "Status",
        ]
    )
    assert code == 2
    assert "arquivo não encontrado" in capsys.readouterr().err


def test_cli_runs_example_end_to_end(tmp_path: Path, monkeypatch, capsys):
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "generate_example", Path(__file__).parents[1] / "examples" / "generate_example.py"
    )
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    monkeypatch.setattr(gen, "HERE", tmp_path)
    gen.main()

    code = main(
        [
            "--source",
            str(tmp_path / "exportacao_sistema.csv"),
            "--target",
            str(tmp_path / "controle.xlsx"),
            "--key",
            "Codigo",
            "--update",
            "Area",
            "Status",
            "--header-row",
            "4",
            "--ignore-sheets",
            "VISAO GERAL",
            "--sheet-password",
            "nimbus",
            "--log",
            str(tmp_path / "log.csv"),
        ]
    )

    out = capsys.readouterr().out
    assert code == 0
    assert "Atualizados:      33" in out
    assert "Não encontrados:  3" in out
    assert (tmp_path / "log.csv").exists()
