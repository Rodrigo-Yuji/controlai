# Mercados, acertos por pessoa e saldo anual (1.25)

Principal e consulta da Gestora agora usam os mesmos componentes para resumo por pessoa e listagem de compras. Os dois exibem indicadores gerais de itens pessoais quitados, contagem de pessoas acertadas e pendências, repasse da gestora em separado, compras recolhidas, filtros Todas/Com pendências/Quitadas, pendências primeiro e dez compras por página com Carregar mais.

Cada compra mostra o nome e a situação de quem tem itens pessoais, antes mesmo de expandi-la:

- Quitou: os reembolsos confirmados cobrem os itens pessoais da pessoa.
- Deve R$…: valor que ainda falta, descontando pagamentos parciais confirmados.
- Abatido do repasse: itens pessoais de quem pagou a nota no próprio cartão, já descontados do que a Gestora deve enviar. Não representa um reembolso em dinheiro.

O resumo mensal por pessoa também destaca quem quitou os reembolsos, quem deve e quem tem repasse a receber da Gestora. Um reembolso previsto não conta como pago. O indicador verde de itens pessoais pode coexistir com um repasse pendente: são obrigações diferentes. Pessoas sem itens pessoais não ganham uma obrigação inventada.

O principal mantém seus botões de registrar reembolso/repasse e excluir compra. Na consulta, esses botões não são renderizados. Os mesmos cálculos e a mesma apresentação são compartilhados; não há alteração de banco nem de permissões.

Em Pessoas e contribuições da consulta, as caixas individuais foram retiradas. Nome, valores, situação e barra de progresso ficam em linhas, como no principal. Contribuição parcial e pendente têm rótulos explícitos; contribuição concluída mantém a barra verde cheia.

O gráfico anual do principal também tem a linha de saldo mensal, correspondente a receitas confirmadas menos despesas confirmadas do mês. Principal e consulta usam o mesmo gráfico: linha fina de 1,5 px, sem pontos mensais nem pontos ao passar o mouse. Nas contas gestoras, as contribuições continuam agrupadas pelo mês de referência.
