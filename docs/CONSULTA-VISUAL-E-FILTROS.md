# Visual e filtros da consulta (1.24)

A consulta usa o mesmo padrão de cabeçalho colorido da conta, título/mês, botão de tema, resumo mensal em destaque e cartões de receitas/despesas do sistema principal. A conta continua sendo trocada somente em Ajustes. O seletor de mês permanece fixo no cabeçalho.

Na aba Lançamentos, os filtros seguem as mesmas regras do principal:

- Pesquisa de descrição, observação, categoria e valor, desconsiderando acentos e diferença de maiúsculas/minúsculas.
- Todos, Receitas ou Despesas.
- Todos os status, Previstos / contas a pagar e receber, ou Pagos / recebidos.
- Cartão, nas contas Casal. A Gestora mantém o filtro de cartão oculto, como no principal.

Os filtros podem ser combinados. Inicialmente, todos os status são mostrados: pagos/recebidos, previstos registrados e previsões de recorrências. Confirmar uma recorrência no sistema principal substitui sua previsão sem duplicar a ocorrência na consulta, após a sincronização.

As linhas exibem ícone de entrada/saída, valor com cor, categoria, natureza, informação de cartão/fatura quando aplicável e etiqueta de status. Observações aparecem abaixo. As etiquetas são texto: não permitem confirmar, editar ou excluir lançamentos.

Os cinco últimos lançamentos do Início não são restringidos pelos filtros escolhidos na aba Lançamentos. Se um filtro não encontrar resultados no mês selecionado, a tela informa isso sem alterar os dados.

A consulta continua sem usar o banco financeiro local, sem gravar snapshots e sem enviar alterações ao cofre do titular. Não há alteração no SQL nem nas permissões de compartilhamento.
