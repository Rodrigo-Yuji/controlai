# ControlAI 1.41

- Relatórios do titular e do convidado com escolha entre mês de referência (padrão) e data do pagamento.
- Mês de referência opcional no lançamento; a previsão original fornece a referência automática dos pagamentos antecipados ou atrasados.
- Saldo da conta mantém a data real dos movimentos. A escolha da visão não altera datas, valores ou faturas.
- Referências preservadas nos pagamentos parciais, snapshots e armazenamento local, sem atualização SQL.

Validação: 192 testes, build e lint passaram. Conferência no navegador dos dois acessos, persistência do ajuste manual após recarregar e layouts móvel/desktop. Detalhes em `RELATORIOS-REFERENCIA.md`.
