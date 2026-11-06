# Saldos pessoais do casal — percentual único (1.12)

Em Orçamento → Saldos pessoais do casal existe apenas o campo **Parte pessoal do casal (%)**. Ele define quanto do orçamento variável total pertence aos dois titulares, em partes iguais. Pode variar de 0% a 100%, com até duas casas decimais. O restante é destinado ao uso comum.

Exemplo para R$ 2.000 variáveis: escolhendo 40%, R$ 800 são pessoais (R$ 400 para cada titular) e R$ 1.200 são comuns. Escolhendo 60%, cada titular recebe R$ 600 e o comum fica com R$ 800. A simulação em reais aparece logo abaixo do campo. Eventual centavo indivisível fica com o segundo titular, preservando o total.

O orçamento semanal e o controle de gastos variáveis usam o restante comum. Confirme a distribuição quando o dinheiro estiver disponível: nada é liberado automaticamente. A porcentagem confirmada fica como padrão para os próximos meses; não altera meses anteriores.

Os saldos pessoais acumulam entre meses e anos. Transferências parciais registram o envio efetivo à conta bancária pessoal e não são despesas de consumo. O uso posterior do dinheiro não precisa ser registrado nesta conta. Não registre a mesma transferência novamente como despesa. Os nomes vêm de Ajustes → Salário fixo e benefícios.

**Ajustar percentual** permite mudar um mês confirmado, recalculando as duas parcelas iguais e a parte comum sobre o total original daquele mês. Não é permitido deixar transferências históricas sem cobertura. Meses fechados continuam protegidos. Cancelar distribuição e excluir transferência mantêm as mesmas proteções; excluir serve para corrigir um registro, não para representar uma devolução real do titular.

Distribuições antigas ficam preservadas, inclusive as que tinham valores diferentes por titular. Um ajuste explícito nessas distribuições passa a usar a nova regra igualitária. O saldo registrado da conta conjunta considera receitas e despesas confirmadas, reserva e transferências; o disponível comum desconta ainda os saldos pessoais pendentes. Não há consulta automática ao banco.

A porcentagem, liberações e transferências integram SQLite, backup e sincronização. Não são necessárias novas tabelas ou SQL no Supabase. Atualize o APK e o site para utilizar o mesmo controle.

## Visualização dos valores (1.16)

Na tela inicial, Dinheiro comum e pessoal mostra três cartões: uso comum previsto no mês, saldo registrado acumulado e disponível para uso comum. A indicação de valores aguardando transferência foi removida dessa tela; o cálculo da disponibilidade continua descontando os saldos pessoais liberados.

Nos relatórios, Transferências e saldos pessoais fica no fim. Há totais de transferências e valores a transferir, além de um cartão por titular com o destinado acumulado, transferido, pendente e uma barra de progresso. Valores transferidos não representam o saldo bancário pessoal atual, pois o uso posterior não é acompanhado pelo aplicativo.

No celular, as ações da conta ficam ao lado do nome: paleta, selecionar (círculo marcado para a conta atual), editar e excluir. Os nomes acessíveis e as dicas dos ícones identificam cada ação.
