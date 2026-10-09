# Exemplo reproduzível

Cenário fictício: a **Nimbus Serviços** controla 160 processos em uma
planilha com uma aba por equipe (Financeiro, Jurídico, Comercial, RH). Todo
dia o ERP exporta um CSV com o status atualizado.

```bash
python examples/generate_example.py        # cria controle.xlsx e exportacao_sistema.csv
excel-sync --config examples/config.yaml   # sincroniza
```

Saída esperada (a semente é fixa, então o resultado é sempre o mesmo):

```
Resumo da sincronização
------------------------
Atualizados:      33
Sem mudança:      127
Não encontrados:  3
Total processado: 163
```

O que observar em `controle.xlsx` depois da execução:

- só as células de **Area** e **Status** que mudaram foram alteradas;
- cabeçalho colorido, títulos e larguras de coluna continuam iguais;
- a aba **Juridico** continua protegida (senha `nimbus`);
- a aba **VISAO GERAL** não foi tocada.

`log_atualizacao.csv` traz cada mudança com valor antigo → novo, aba e linha.
Os arquivos gerados ficam fora do Git (`.gitignore`).
