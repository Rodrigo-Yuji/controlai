# Distribuição em reais ou porcentagem (1.21)

Em **Orçamento → Divisão da renda**, escolha **Porcentagem (%)** ou **Valor (R$)**. No modo por valor, informe variáveis e reserva; os fixos continuam automáticos, pela soma dos compromissos do mês. A porcentagem equivalente aparece abaixo de cada campo. **Completar restante em Variáveis** usa a base menos os fixos e a reserva, sem precisar acertar percentuais manualmente.

O modo em reais preserva os valores informados até os centavos. Os percentuais são arredondados para exibição: eles podem somar 99,99% ou 100,01% mesmo quando os valores fecham exatamente a base. Nesse modo, a validação usa a soma em reais, e não a soma desses percentuais arredondados. No modo percentual, permanece a exigência de 100% com até duas casas decimais.

Salvar mantém os valores escolhidos. **Salvar e travar este mês** também preserva a base e a distribuição contra entradas extras. Valores e modo de entrada são mantidos após recarregar, no backup e na sincronização. Trocar de reais para porcentagem passa a usar os percentuais exibidos como regra; revise a distribuição antes de salvar.

Em **Saldos pessoais do casal → Parte pessoal do casal**, os botões **%** e **R$** permitem escolher como definir a parte pessoal. O valor em reais é sempre o total destinado aos dois titulares juntos, e não o valor individual. O painel mostra o equivalente, a divisão visual entre pessoal/uso comum e o valor de cada titular.

Por exemplo, uma parte pessoal total de R$ 300,01 destina R$ 150,00 ao primeiro titular e R$ 150,01 ao segundo. O centavo restante é preservado. O que sobra do orçamento variável fica para uso comum. Informar em reais não muda os centavos para tentar reproduzir uma porcentagem arredondada.

Confirmações anteriores ficam preservadas. Para mudar uma distribuição confirmada, use **Ajustar parte pessoal**. Reduzir a parte pessoal para menos do que já foi transferido é rejeitado; os registros anteriores continuam intactos. Meses fechados continuam protegidos.

O modo por valor usa campos opcionais dentro das configurações e distribuições existentes. Não requer novo SQL no Supabase. Use a versão atual nos dispositivos que editam esses dados, para preservar os valores exatos durante validação e sincronização.
