# Seleção de previstos e preenchimento de valores (1.18)

Em Lançamentos, use **Selecionar previstos** e marque os itens desejados ou todos os previstos visíveis. O resumo mostra o total, as receitas a receber e as despesas a pagar separadamente. Alterar filtros remove da seleção os itens que deixam de aparecer. Revise e confirme a seleção no popup. As datas originais são mantidas, como na confirmação integral individual. Para informar outra data ou pagar apenas uma parte, utilize o registro parcial individual.

A confirmação em conjunto é atômica. Um previsto alterado, já confirmado ou em mês fechado impede toda a operação. Recorrências são materializadas sem duplicação; saldos de pagamentos parciais são quitados apenas pelo restante. Os controles próprios da Gestora continuam responsáveis por contribuições, repasses e reembolsos.

As edições de recorrências e cartões são feitas em popups. Cancelar não altera os dados. Editar uma recorrência preserva os lançamentos já registrados; editar o fechamento do cartão preserva as faturas já atribuídas. O histórico da reserva mantém descrição, valor e lixeira alinhados no celular.

Todos os campos monetários aceitam digitação apenas dos números, com centavos automáticos: **12345 → 123,45** e **100000 → 1.000,00**. Para R$ 40,00, digite **4000**. O campo pode ser apagado por completo. Valores existentes mantêm seus centavos. Percentuais, quantidades e dias continuam com preenchimento numérico normal.

Ao registrar uma contribuição, o popup mostra o restante atualizado. O valor sugerido aparece como placeholder, sem preencher o campo. Deixar o valor vazio registra todo esse restante; digitar um valor menor registra uma parte. Reabrir o popup atualiza a sugestão. Uma mudança concorrente do restante exige nova conferência antes da confirmação. O mês de referência da contribuição continua independente da data real do recebimento.

Os dados mantêm o formato atual em centavos e os mesmos vínculos de backup, SQLite e sincronização. Não há novo SQL para executar no Supabase.
