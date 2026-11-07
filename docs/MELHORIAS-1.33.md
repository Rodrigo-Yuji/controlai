# ControlAI 1.33

## Peso das despesas

O totalizador do gráfico usa despesas confirmadas / receitas recebidas × 100, para o mês consultado. Exemplo: R$ 300 de despesas e R$ 1.000 de receitas = 30%. Pode ultrapassar 100%; na ausência de receita exibe Sem receitas recebidas. A composição por categoria do gráfico continua sendo uma distribuição das despesas. O mesmo cálculo aparece no principal e na consulta.

## Recorrências pagas e faturas

A projeção passa a receber os cartões da conta. Para um registro antigo sem data prevista original, mas com fatura explícita, identifica a ocorrência pelo vínculo da recorrência, conta, cartão e mês da fatura, em vez de usar o mês da data real de pagamento. Isso evita gerar outra previsão da fatura já paga quando o pagamento aconteceu em mês diferente da compra prevista. Metadados explícitos da ocorrência original continuam tendo prioridade, inclusive em pagamentos parciais.

A central usa as mesmas recorrências virtuais do mês de Lançamentos, junto aos lançamentos efetivamente salvos. Não fabrica compras de meses anteriores para criar novas dívidas de cartão sem um registro previsto correspondente. Lançamentos previstos realmente salvos continuam nas pendências, mesmo atrasados. Partes ainda não quitadas e próximas faturas continuam previstas.

Lançamentos, faturas, conciliação, confirmação em lote e consulta usam o mesmo critério. A correção é de leitura e projeção; não reescreve datas, não gera pagamentos, não exclui lançamentos e não muda saldos financeiros gravados. Não há SQL adicional.

## Verificação

163 testes, build web e lint. Casos específicos: pagamento antigo com data real e fatura explícita; três assinaturas pagas na mesma fatura; próxima competência preservada; previsão de caixa sem débito duplicado; dívida antiga registrada mantida; restante parcial; cartão/conta/fatura diferentes sem baixa indevida; prioridade da competência explícita; peso das despesas de 30%, acima de 100% e receita zero. Navegador no principal e na consulta, com larguras de 320, 390 e 1280 pixels.
