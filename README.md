# excel-sync-tool

Ferramenta em Python que sincroniza automaticamente colunas de status/dados
entre uma **fonte diária** (CSV ou Excel exportado de um sistema) e uma
**planilha de controle** com múltiplas abas — sem sobrescrever formatação,
sem quebrar proteção de aba, e com log completo de tudo que mudou.

## O problema que resolve

Times que trabalham com planilhas de controle (backlog, pipeline de tarefas,
status de processos, chamados) recebem, quase sempre, uma exportação diária
de um sistema com os dados "corretos" — mas essa planilha de controle não
pode simplesmente ser substituída: ela tem várias abas (uma por equipe,
por exemplo), formatação manual, comentários e às vezes proteção de célula.

Atualizar isso à mão, linha por linha, é lento e sujeito a erro. Este
projeto automatiza exatamente essa tarefa, de forma **genérica**: nenhuma
regra de negócio fica fixa no código — nomes de colunas, linha de
cabeçalho, abas a ignorar e senha de proteção vêm de um arquivo de
configuração.

## Como funciona

1. Lê os registros da fonte (CSV ou Excel).
2. Para cada registro, procura a **coluna-chave** (ex.: um código/ID) em
   todas as abas do arquivo de destino.
3. Quando encontra a linha correspondente, atualiza apenas as colunas
   configuradas — e só quando o valor realmente mudou.
4. Se a aba estava protegida, desprotege, atualiza e reprotege
   automaticamente.
5. Gera um relatório CSV com todas as mudanças (valor antigo → novo,
   aba, linha, horário) e um resumo no console.

```
Resumo da sincronização
------------------------
Atualizados:      3
Sem mudança:      12
Não encontrados:  1
Total processado: 16
```

## Instalação

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -e .
```

## Uso

### Via arquivo de configuração (recomendado para rodar todo dia)

```bash
cp config.example.yaml config.yaml
# edite config.yaml com os nomes reais das suas colunas e arquivos
excel-sync --config config.yaml
```

### Via linha de comando direta

```bash
excel-sync \
  --source dados/exportacao_sistema.csv \
  --target dados/controle.xlsx \
  --key "Codigo" \
  --update "Area" "Status" \
  --ignore-sheets "RESUMO" "DASHBOARD" \
  --log dados/log_atualizacao.csv
```

### Agendamento

Como é um script Python padrão, pode ser agendado com:
- **cron** (Linux/macOS) para rodar todo dia de manhã;
- **Agendador de Tarefas** do Windows;
- **GitHub Actions** (runner self-hosted), se os arquivos ficarem em rede
  interna.

## Testes

```bash
pip install -r requirements-dev.txt
pytest -v
```

O diretório `examples/` tem um caso de uso completo e reproduzível: um CSV
de origem, uma planilha de destino com múltiplas abas, e o comando para
rodar a sincronização de ponta a ponta.

## Origem do projeto

Este projeto nasceu de uma automação real, originalmente feita em VBA
dentro do próprio Excel, para manter uma planilha de controle sincronizada
com uma base exportada diariamente de um sistema interno. A lógica foi
reescrita do zero em Python, generalizada (sem nomes de colunas ou regras
fixas de um negócio específico) e coberta por testes automatizados, para
servir como referência de portfólio.

## Por que Python e não VBA/outra linguagem

- **Portável**: roda em qualquer SO, não depende do Excel estar instalado
  nem aberto.
- **Testável**: a lógica de sincronização tem testes automatizados
  (`pytest`), algo praticamente inviável em VBA.
- **Legível para portfólio**: é a linguagem mais reconhecível por
  recrutadores e outros devs para esse tipo de automação de dados.
- **Agenda fácil**: pode rodar sozinho via cron/Agendador de Tarefas, sem
  precisar do Excel aberto.

## Estrutura

```
excel-sync-tool/
├── src/excel_sync/
│   ├── sync.py       # lógica principal de sincronização
│   └── cli.py        # interface de linha de comando
├── tests/
│   └── test_sync.py  # testes automatizados (pytest)
├── examples/          # exemplo reproduzível de ponta a ponta
├── config.example.yaml
├── requirements.txt
└── pyproject.toml
```

## Licença

MIT.
