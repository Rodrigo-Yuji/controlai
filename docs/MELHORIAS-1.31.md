# ControlAI 1.31

## Início do controle

Em Ajustes → Início do controle e saldo inicial, informe a data e o saldo total existente no começo desse dia, incluindo corrente e reserva. Os movimentos desse dia entram depois desse valor. O saldo inicial não gera receita nem lançamento fictício. Valores negativos são aceitos pela opção de saldo negativo.

Os recebimentos e pagamentos anteriores ficam no histórico, identificados como anteriores ao início do controle. Não entram novamente no saldo, no resumo de receitas/despesas nem na referência atual do orçamento. Planejamentos já travados são mantidos. Para consultas anteriores ao início, o saldo total e corrente são desconhecidos e aparecem como traço, em vez de um zero enganoso.

A reserva continua acumulando todos os depósitos e retiradas, inclusive retroativos. Ela é separada do total já informado, sem somá-la duas vezes. Exemplo: saldo inicial total R$ 1.000,00, reserva histórica R$ 300,00: corrente R$ 700,00. Registrar mais R$ 70,00 retroativos na reserva muda a divisão para corrente R$ 630,00 e reserva R$ 370,00; o total continua R$ 1.000,00.

## Parcelas anteriores

A configuração lista parcelas previstas com data e vencimento anteriores ao início. Selecione apenas as que já pagou e confirme. A operação preserva datas e parcelas futuras e marca as escolhidas como confirmadas. As não selecionadas permanecem pendentes. Meses fechados devem ser reabertos antes. Mudanças concorrentes, parcelas de outra conta e seleções repetidas impedem toda a operação.

Ao cadastrar uma compra parcelada retroativa, uma opção explícita permite declarar pagas as parcelas anteriores ao início. Faturas futuras não são quitadas apenas porque a data da compra é antiga. Para pagar hoje um débito antigo ainda aberto, use Pagar parte, podendo informar o valor integral e a data real. A confirmação rápida encaminha para esse formulário; a confirmação em lote orienta usar a data real para esses casos.

## Relatórios e conta

- Removido o quadro Peso dos gastos no mês. Peso dos gastos mostra o total das despesas e 100% (0% quando não houver despesas), no principal e na consulta.
- Conta de login e sincronização foram reunidas em Conta e sincronização, no principal e na consulta. Senha e exclusão ficam junto ao login, sem perder a proteção contra sincronização concorrente.
- Saldo inicial acompanha a conta nos backups e na sincronização, inclusive na consulta. Nenhuma atualização SQL é necessária.

## Validação

Testes de saldo, reserva retroativa, parcelas futuras, datas preservadas, validação, transações SQLite, rollback de mês fechado e conflito, sincronização e previsão de saldo. Testes de navegador verificam a configuração real, totalizador dos relatórios, seção de conta unificada, modos principal/consulta e larguras de 320 a 1280 pixels.
