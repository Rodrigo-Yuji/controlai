# Cartões e conta gestora

## Cartões e faturas

Em **Lançamentos → Cartões**, cadastre o nome, o dia do fechamento e o vencimento.
Cartões ficam disponíveis nas contas Solo e Casal. A Gestora usa diretamente quem pagou, sem cadastro de cartão.
O mês da fatura é o mês do vencimento, não necessariamente o mês da compra:
para fechamento dia 25 e vencimento dia 5, uma compra em 20/11 entra na fatura de
dezembro; uma em 26/11 entra na de janeiro. Compras no próprio dia do fechamento
permanecem no ciclo atual. Datas de vencimento acima do último dia do mês são
ajustadas ao último dia válido.

Lançamentos e parcelas permitem selecionar cartão e ajustar o mês da fatura. Em
parcelas, o ajuste inicial avança um mês por parcela, preservando os centavos do
valor total. A revisão do assistente nas contas Solo e Casal também permite escolher cartão e ajustar a fatura. Recorrências de despesas também aceitam cartão. Receitas recorrentes
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
**Gestão da conta → Gestora**, cadastre as pessoas e a contribuição mensal de cada uma.
O valor pode ser zero. Alterações na contribuição passam a valer a partir do mês
selecionado, sem reescrever os valores dos meses anteriores.

**Registrar entrada** permite receber a contribuição integral ou em partes. O
recebido e o pendente ficam separados por pessoa e mês de referência. Uma entrada
realizada depois pode quitar a contribuição de um mês anterior; a data efetiva do
recebimento continua no lançamento financeiro. Não há compensação automática com
reembolsos. Uma contribuição recebida em 30/10 para novembro aparece nos lançamentos e relatórios de novembro, preservando 30/10 como data efetiva. A proteção de mês fechado considera a referência da contribuição. A categoria é **Contribuição**.

## Mercado e itens pessoais

Informe data, total da nota e **Quem pagou?**: o nome da conta (padrão) ou uma pessoa cadastrada. A descrição da compra é opcional e assume **Mercado**. A descrição dos itens também é opcional e assume **Item 1**, **Item 2**, etc. O status inicial é **Pago**. As despesas usam a categoria **Mercado**.
A soma dos itens pessoais não pode ultrapassar a nota. A diferença é a parte comum
da moradia. O resumo mensal soma os itens por pessoa e detalha cada item e compra.

Exemplo: nota de **R$ 300**, itens pessoais de Ana **R$ 40** e de Bia **R$ 20**.
A parte comum é **R$ 240**.

| Quem pagou? | Valores a receber pela gestora | Valor a enviar pela gestora |
|---|---|---|
| Conta gestora | Ana: R$ 40; Bia: R$ 20 | Nenhum repasse ao comprador |
| Ana | Bia: R$ 20 | Ana: R$ 260 (R$ 300 − R$ 40) |

Quando a conta paga, a nota é uma única despesa da gestora (prevista ou paga), e
os reembolsos são receitas quando recebidos. Quando uma pessoa paga, a compra não cria
outra despesa da gestora: os repasses efetivamente pagos à pessoa que pagou são as saídas,
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

Na Gestora, Divisão da renda, Orçamento semanal, Controle de limites e Reserva financeira não aparecem. O fechamento mensal continua disponível. Dados históricos de cartões e reservas permanecem preservados nos backups.

## Organização das telas (1.8)

No computador, o cabeçalho com o mês permanece visível durante a rolagem. Na Gestora, as contribuições e o histórico de entradas/repasses ficam no primeiro bloco; Mercado e acertos vem em seguida, depois Outras entradas de pessoas e Fechamento mensal. Use **Adicionar pessoa** para abrir os campos; **Editar pessoa** abre a mesma janela com os valores atuais.

Em Solo e Casal, o orçamento segue: Orçamento semanal, Controle de limites, Reserva financeira, Fechamento mensal e Divisão da renda. Nos três tipos de conta, editar uma categoria abre uma janela no ponto atual da página, com opções de salvar e cancelar.
