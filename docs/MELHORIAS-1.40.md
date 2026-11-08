# ControlAI 1.40

- A edição da data mantém a referência da ocorrência recorrente original, inclusive quando altera o mês da fatura. Impede que a previsão seja gerada novamente.
- A confirmação individual abre o formulário com valor total e data para conferência. Uma previsão reagendada mantém a data escolhida como sugestão, em vez de registrar diretamente no dia atual.
- Pagamentos parciais também preservam a ocorrência original após reagendamentos. Edição e pagamento respeitam os meses fechados envolvidos.

Validação: 28 testes de datas, pagamentos parciais, confirmação em lote e recorrências passaram. Teste no navegador reproduziu vencimento em 21/11, alteração para 06/11 e confirmação em 08/11, com e sem cartão; permaneceu apenas o pagamento de 06/11 após recarregar. Build e lint passaram. Não exige SQL.
