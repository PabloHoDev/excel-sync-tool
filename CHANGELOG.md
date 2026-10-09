# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-10-09

### Corrigido
- Pacote renomeado para `src/excel_sync`; antes `import excel_sync` falhava
  e nem a CLI nem os testes rodavam.
- Chave vazia em fonte Excel não é mais tratada como o texto `"None"`.

### Melhorado
- Busca de chaves via índice montado uma única vez (O(1) por registro).
- CLI com erros amigáveis (arquivo inexistente, planilha aberta no Excel) e
  saída em UTF-8 no Windows.

### Adicionado
- Exemplo reproduzível em `examples/`.
- Testes de CLI, chave duplicada, fonte Excel e cabeçalho deslocado.
- CI (GitHub Actions) com lint, formatação e testes em Linux e Windows.
- Licença MIT.

## [1.0.0]

- Versão inicial: motor de sincronização, CLI e testes básicos.
