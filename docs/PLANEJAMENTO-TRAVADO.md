# Planejamento mensal travado e saldo da conta (1.19)

Em Orçamento → Divisão da renda, escolha a base e os percentuais. **Completar 100% em Variáveis** calcula a diferença após os fixos e a reserva. **Salvar distribuição** mantém a referência dinâmica. **Salvar e travar este mês** grava a base, os percentuais e os valores em reais para aquela conta e aquele mês.

Receitas extras e confirmações de recebimentos continuam entrando no caixa, mas não alteram o planejamento travado. Mudanças posteriores em recorrências ou parcelas também não recalculam os valores travados. O orçamento semanal, o limite de fixos/variáveis e a simulação de distribuição do casal usam esses valores. Os gastos reais continuam sendo atualizados para comparação com os limites.

Uma trava não é aplicada a outros meses ou contas. Para revisar, use **Destravar planejamento deste mês**: a base e os compromissos voltam a ser calculados com os registros atuais. Meses fechados precisam ser reabertos antes de salvar, travar ou destravar. Uma alteração concorrente na base ou nos compromissos exige conferir novamente os valores antes de salvar. Distribuições pessoais já liberadas continuam preservadas e usam seus controles próprios.

O total dos valores planejados é igual à base. Fixos mantêm os centavos dos compromissos; variáveis usam o percentual arredondado em centavos; a reserva absorve a pequena diferença do arredondamento dos percentuais.

No início da conta Casal, o antigo bloco Dinheiro comum e pessoal passa a exibir apenas **Saldo registrado da conta**: total, corrente e reserva. Na Gestora, o mesmo resumo abre as telas Início e Orçamento.

- Total: receitas confirmadas menos despesas confirmadas e transferências pessoais realizadas.
- Reserva: depósitos menos retiradas.
- Corrente: total menos reserva.

Os saldos acumulam entre meses e anos, até o mês selecionado. Usam a data real do movimento, inclusive nas contribuições antecipadas. Receitas/despesas previstas e valores pessoais ainda não transferidos não alteram esse total. Depósitos e retiradas da reserva movem dinheiro entre os componentes sem duplicar o total.

As travas ficam dentro das configurações da conta, preservadas em SQLite, backup e sincronização. A restauração e a sincronização validam os valores e rejeitam travas inconsistentes ou repetidas. Não é necessário novo SQL no Supabase. Atualize o site e os APKs usados para editar o planejamento com os mesmos controles.
