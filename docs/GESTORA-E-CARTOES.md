# Cartões e conta gestora

## Cartões e faturas

Em **Lançamentos → Cartões**, cadastre o nome, o dia do fechamento e o vencimento.
Na conta gestora, escolha se o cartão pertence à gestão ou a uma pessoa cadastrada.
O mês da fatura é o mês do vencimento, não necessariamente o mês da compra:
para fechamento dia 25 e vencimento dia 5, uma compra em 20/11 entra na fatura de
dezembro; uma em 26/11 entra na de janeiro. Compras no próprio dia do fechamento
permanecem no ciclo atual. Datas de vencimento acima do último dia do mês são
ajustadas ao último dia válido.

Lançamentos e parcelas permitem selecionar cartão e ajustar o mês da fatura. Em
parcelas, o ajuste inicial avança um mês por parcela, preservando os centavos do
valor total. Compras de mercado da Gestora e a revisão do assistente também permitem escolher
cartão e ajustar a fatura. Recorrências de despesas também aceitam cartão. Receitas recorrentes
usam o tipo Receita e uma categoria de receita; não são despesas fixas.

A consulta mostra previstos, pagos, totais e relatório por categoria do cartão.
Marcar a fatura como paga confirma os lançamentos, sem criar outra despesa pelo
mesmo pagamento. Meses fechados dos lançamentos continuam protegidos. Alterar o
fechamento do cartão preserva as faturas dos registros já existentes. Excluir um
cartão com histórico o arquiva; recorrências ativas precisam trocar de cartão
antes da exclusão. Cartões pessoais usados no mercado mostram a compra externa
separadamente: a saída da gestora ocorre somente quando ela faz o repasse.

## Conta gestora

Escolha **Gestora** no tipo da conta, em Ajustes ou no primeiro acesso. Solo e
Casal continuam disponíveis e as contas antigas mantêm seus dados. Em
**Orçamento → Gestora**, cadastre as pessoas e a contribuição mensal de cada uma.
O valor pode ser zero. Alterações na contribuição passam a valer a partir do mês
selecionado, sem reescrever os valores dos meses anteriores.

**Registrar entrada** permite receber a contribuição integral ou em partes. O
recebido e o pendente ficam separados por pessoa e mês de referência. Uma entrada
realizada depois pode quitar a contribuição de um mês anterior; a data efetiva do
recebimento continua no lançamento financeiro. Não há compensação automática com
reembolsos. As contribuições previstas compõem a base de renda prevista da gestora.

## Mercado e itens pessoais

Cadastre primeiro os cartões. Depois informe descrição, data, total da nota e
cartão utilizado, acrescentando cada item pessoal com descrição, pessoa e valor.
A soma dos itens pessoais não pode ultrapassar a nota. A diferença é a parte comum
da moradia. O resumo mensal soma os itens por pessoa e detalha cada item e compra.

Exemplo: nota de **R$ 300**, itens pessoais de Ana **R$ 40** e de Bia **R$ 20**.
A parte comum é **R$ 240**.

| Cartão utilizado | Valores a receber pela gestora | Valor a enviar pela gestora |
|---|---|---|
| Cartão da gestão | Ana: R$ 40; Bia: R$ 20 | Nenhum repasse ao comprador |
| Cartão de Ana | Bia: R$ 20 | Ana: R$ 260 (R$ 300 − R$ 40) |

No cartão da gestão, a nota é uma única despesa da gestora (prevista ou paga), e
os reembolsos são receitas quando recebidos. No cartão pessoal, a compra não cria
outra despesa da gestora: os repasses efetivamente pagos ao titular são as saídas,
e os reembolsos das demais pessoas são as entradas. Nos dois exemplos, depois de
todos os acertos, a saída líquida da gestora é R$ 240. Relatórios de caixa mostram
as entradas e saídas brutas; o custo comum é exibido separadamente na gestão.

Não cadastre novamente em Lançamentos uma nota já registrada pela Gestora. Compras
antigas já lançadas não são vinculadas automaticamente ao novo módulo.

Cada reembolso/repasse aceita pagamentos parciais, sem ultrapassar o saldo restante.
Entradas avulsas de pessoas também podem ser registradas, mas não quitam itens de
mercado nem contribuições. Para corrigir um pagamento, exclua-o no histórico da
gestora e registre novamente. Para corrigir uma compra, remova antes os acertos e
exclua a compra pela Gestora; a exclusão também remove a despesa original gerada.
Datas de meses fechados são protegidas. Pessoas com histórico ficam inativas após
o mês selecionado, mantendo os valores pendentes e referências antigas.

## Celular, backup e sincronização

Arrastar a tela para baixo a partir do topo atualiza os dados e consulta a
sincronização. O gesto não instala uma nova versão do APK: atualizações do programa
continuam sendo feitas pelo instalador Android. Não é preciso apagar o banco local.

Cartões, pessoas, itens, contribuições e acertos fazem parte do mesmo backup JSON
e da sincronização já configurada. Não é necessário alterar as tabelas Supabase.
Atualize ambos os dispositivos para ter acesso à interface nova. Quando os dois
forem alterados antes de sincronizar, a proteção contra conflitos continua ativa.
