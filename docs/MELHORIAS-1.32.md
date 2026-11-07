# ControlAI 1.32

## Organização

- Fechamento mensal aparece depois da Divisão da renda.
- Reserva financeira, Divisão da renda, Saldos pessoais do casal e Transferências e saldos pessoais começam recolhidos. Os formulários continuam disponíveis ao abrir cada seção.
- Na Gestora, Outras entradas de pessoas começa recolhida. Em Mercados e acertos, Registrar mercado e itens pessoais compartilham uma área recolhida, mantendo os mercados cadastrados e seus acertos visíveis.
- O totalizador do gráfico Peso dos gastos passou a se chamar Peso das despesas, tanto no principal quanto na consulta.

## Pagamentos e previsões

A confirmação rápida e a confirmação em lote usam a data real de hoje para o pagamento ou recebimento. A data prevista original fica guardada para identificar a ocorrência da recorrência, preservar o orçamento do mês original e impedir que a mesma obrigação reapareça como previsão. A fatura do cartão é preservada. O formulário Pagar/Receber parte permite escolher outra data e também quitar o total.

As confirmações são transacionais: valor alterado, item já pago ou mês fechado impedem a gravação. O estorno recupera a data prevista. Pagamentos integrais sem partes continuam editáveis; pagamentos divididos mantêm as proteções existentes. Datas dos pagamentos antigos não são reescritas automaticamente, pois não há como deduzir a data real em que foram feitos.

## Horário

Novos lançamentos guardam o horário local de cadastro, exibido depois da data no principal e na consulta. Ao confirmar um pagamento, o horário é atualizado para o momento da confirmação. O campo é mantido no SQLite, navegador, backup e sincronização. Registros antigos sem horário permanecem sem horário; nenhuma hora é inventada para eles. Não é necessário SQL adicional.

## Verificação

156 testes de domínio, armazenamento, permissões e sincronização; build web e lint. Cenários de navegador em 320, 390 e 1280 pixels: seções recolhidas, ordem do fechamento, horário, pagamento antecipado de recorrência sem duplicação e registro de mercado agrupado.
