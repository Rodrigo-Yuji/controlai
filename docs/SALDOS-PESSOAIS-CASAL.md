# Divisão variável e saldos pessoais do casal

Somente a conta Casal divide o orçamento variável em 50% de uso comum e 50% para dividir entre os titulares. O padrão é 25% do orçamento variável para cada titular. O cálculo considera o valor variável da distribuição da renda salva, sobre a base de renda selecionada. Com R$ 2.000 variáveis, R$ 1.000 ficam no uso comum e R$ 500 para cada pessoa. Eventuais centavos são ajustados para preservar o total.

O orçamento semanal e o controle de gastos variáveis usam somente a parte comum, inclusive antes da liberação pessoal. Os lançamentos de despesas nessa conta continuam sendo gastos comuns; não registre novamente como despesa os valores transferidos aos titulares.

Em Orçamento → Saldos pessoais do casal, confira a simulação e use **Confirmar distribuição** quando o dinheiro estiver disponível. A confirmação libera as duas parcelas pessoais e preserva os valores daquele mês mesmo se a renda/configuração mudar. Cada mês pode ter uma única distribuição. Nenhum saldo pessoal é creditado automaticamente.

Os nomes vêm dos titulares cadastrados em Ajustes → Salário fixo e benefícios. Os saldos são separados pelos dois titulares, acumulam entre meses e anos e mostram: destinado acumulado, já transferido e a transferir. Selecionar um mês antigo mostra os saldos até aquele mês.

**Transferir para…** registra a saída efetiva da conta conjunta para a conta bancária pessoal. Aceita pagamentos parciais e uma data explícita. Não é despesa de consumo, não afeta os gráficos de despesas nem o limite semanal e não exige registrar os gastos pessoais posteriores. O histórico mostra as liberações e transferências. Não há integração com o banco: é necessário fazer a transferência bancária e registrar o valor no aplicativo.

A tela inicial separa o saldo registrado da conta conjunta dos valores ainda pertencentes aos titulares. O saldo registrado acumula receitas confirmadas menos despesas confirmadas, movimentos de reserva e transferências pessoais até o mês selecionado; o disponível comum também desconta os valores pessoais pendentes. Esse cálculo depende dos lançamentos cadastrados e não consulta o saldo real do banco.

Cancelar uma distribuição recalcula os saldos e só é permitido se todas as transferências continuarem cobertas na respectiva data. Excluir uma transferência devolve o valor ao saldo a transferir; faça isso apenas para corrigir registros, não para representar uma devolução real do titular. Meses fechados bloqueiam alterações nas respectivas distribuições e transferências. Uma transferência não pode usar uma liberação de mês futuro, mesmo que o saldo atual seja positivo.

Liberações e transferências são salvas junto à conta: integram SQLite, backup e sincronização Supabase, sem novas tabelas ou execução de SQL. Atualize o APK e o site para usar os mesmos controles. Solo e Gestora mantêm suas regras anteriores. Uma conta com histórico pessoal precisa manter o tipo Casal para preservar o acesso aos saldos.

## Percentuais pessoais (1.11)

Em Saldos pessoais do casal, os campos de cada titular indicam percentuais do orçamento variável **total**. Eles somam 50%; os outros 50% continuam no uso comum. Ao preencher um percentual, o outro é ajustado automaticamente. Exemplo: com R$ 2.000 variáveis, 20% e 30% resultam em R$ 400 e R$ 600 pessoais, além de R$ 1.000 comuns. O valor simulado fica logo abaixo de cada campo. São aceitos zero e percentuais com até duas casas decimais.

Confirmar a distribuição salva os percentuais para os próximos meses, sem alterar meses já confirmados. Distribuições antigas sem percentuais continuam em 25%/25%. **Ajustar percentuais** permite alterar um mês confirmado, preservando o total daquele mês, a parte comum e as transferências. A operação só é concluída se nenhum titular ficar sem saldo para cobrir suas transferências históricas. Meses fechados continuam protegidos. Os percentuais integram o backup e a sincronização.
