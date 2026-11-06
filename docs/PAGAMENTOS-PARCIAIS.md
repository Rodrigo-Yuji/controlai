# Pagamentos e recebimentos parciais (1.17)

Na lista de lançamentos, um previsto de receita mostra **Receber parte** e um previsto de despesa mostra **Pagar parte**. Informe o valor efetivo e a data do recebimento/pagamento. O aplicativo confirma essa parte e mantém a diferença prevista no mesmo vencimento original. É possível registrar outras partes depois. Informar todo o restante quita a previsão. O botão de status Previsto continua permitindo a confirmação integral rápida.

Exemplo: receita prevista de R$ 1.000,00, recebimento parcial de R$ 400,00. Ficam um recebimento confirmado de R$ 400,00 e a mesma previsão com R$ 600,00 restantes. A soma não muda. Só a parte confirmada entra no saldo realizado e nos relatórios de caixa, pela data informada. Filtrar Previsto mostra apenas o restante.

Recorrências são materializadas em uma única ocorrência, sem recriar a previsão do mesmo mês. Um recebimento/pagamento em outro mês mantém a ocorrência original e não impede a previsão do mês seguinte. Parcelas preservam grupo e número, e uma parcela só conta como paga após quitar seu restante. O orçamento fixo continua incluindo o total do compromisso no mês original. Pagamentos de cartão mantêm a fatura original, mesmo se forem realizados em outra data.

Excluir ou clicar no status de uma parte confirmada permite **estornar** essa parte: o valor volta ao previsto. Outras partes confirmadas continuam preservadas, inclusive se o restante já havia sido quitado. Não use esse estorno para representar uma devolução real de dinheiro; ele corrige o registro. Para editar ou excluir a previsão de origem, estorne antes as partes confirmadas. Remover previsões de parcelas/recorrências preserva os saldos que já têm pagamentos parciais.

Os meses do vencimento original, do registro alterado e da nova data devem estar abertos. Valores não positivos, acima do saldo restante ou gravados sobre uma previsão desatualizada são rejeitados. Reduzir a previsão e registrar a parte são operações atômicas: uma falha reverte ambas. Os vínculos integram backup e sincronização, sem novo SQL no Supabase. Atualize todos os dispositivos para lidar corretamente com esses vínculos.

Movimentos gerados pela Gestora usam os controles próprios de contribuições, reembolsos e repasses, que já permitem pagamentos parciais. O botão genérico de parte é destinado aos lançamentos não gerados pela Gestora.

Na listagem, valor, editar e excluir ficam agrupados para a lixeira não quebrar sozinha para outra linha no celular. A observação continua disponível abaixo.
