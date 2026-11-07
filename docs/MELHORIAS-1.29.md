# Melhorias 1.29

Atualização: histórico/lixeira e envio de anexos foram retirados na versão 1.30 para reduzir armazenamento. Consulte MELHORIAS-1.30.md para os caminhos atuais.

## Onde encontrar

- **Início → Pendências e previsão de saldo:** contas previstas, atrasos, contribuições, reembolsos, repasses e projeção diária do saldo corrente. Disponível também na consulta autorizada.
- **Ajustes → Conciliação bancária:** OFX ou CSV; revisão por movimento, vínculo a previsto ou confirmado, pagamento parcial de previsto, ou criação de lançamento. O padrão é ignorar até a pessoa escolher a ação. CSV aceita Data, Descrição, Valor (saídas negativas), ou Débito/Crédito. A coluna ID opcional distingue compras idênticas. Até 1000 movimentos/4 MB por arquivo.
- **Ajustes → Histórico e lixeira:** mudanças registradas a partir desta versão, com antes/depois, autor e data. Exclusões de registros podem ser restauradas se o estado ainda corresponde ao momento da exclusão e os meses envolvidos estão abertos. A restauração é atômica e valida referências. Excluir uma conta financeira inteira não oferece recuperação automática: use backup para esse caso.
- **Lançamentos → Cartões:** pagamento total ou parcial da fatura, com valor sugerido e data; mantém o residual previsto, mostra seis faturas futuras e parcelas posteriores.
- **Ajustes → Lembretes:** ativação por conta, antecedência e horário; na gestora, prazo da contribuição e prazo de reembolso.
- **Orçamento semanal:** disponível por dia calculado pelo saldo restante e pelos dias restantes; semanas encerradas são identificadas.
- **Gestora → Resumo mensal por pessoa:** contribuição, itens pessoais, recebimentos, repasses pendentes e pagamentos registrados, para compartilhar ou baixar como texto. Também na consulta da gestora.
- **Consulta → Ajustes → Enviar solicitação:** envio para revisão do titular, com comprovante opcional privado de até 2 MB (JPG/PNG/WebP/PDF). O convidado não altera o cofre. Acompanha seus próprios envios.
- **Principal → Ajustes → Solicitações dos convidados:** aprovar com categoria ou recusar com motivo. A aprovação exige que a cópia local esteja sincronizada e registra a operação no servidor uma única vez.
- **Ajustes → Sincronização:** horário da última sincronização bem-sucedida e quantidade de registros com alterações a enviar. Atualizações automáticas do próprio histórico não contam como um segundo lançamento pendente.

## Regras financeiras

Conciliação nunca confirma sugestões sem revisão, reaplicações da mesma identificação são ignoradas e dois movimentos da mesma importação não podem usar o mesmo lançamento. O pagamento bancário da fatura não cria uma segunda despesa: ele deve ser tratado em Cartões. Os pagamentos de fatura distribuem o valor pelas compras previstas; juros/tarifas devem ser lançados separadamente quando conhecidos.

A projeção usa recebimentos e pagamentos registrados ou previstos, recorrências, reserva e transferências pessoais. Previstos em atraso entram no primeiro dia da projeção. Cartões usam o vencimento da fatura. Contribuições e reembolsos sem lançamento previsto aparecem nas pendências, mas não são presumidos como dinheiro disponível na projeção. A previsão não consulta o saldo do banco.

O histórico acompanha as gravações locais no mesmo commit da operação. Sincronização e restauração de snapshots preservam o histórico recebido sem criar cópias de eventos. Aprovações feitas no servidor acrescentam o respectivo evento. Não é um registro imutável regulatório; é histórico de uso e recuperação de erros. As alterações anteriores a esta versão não podem ser reconstruídas.

## Lembretes

No Android, o plugin oficial Capacitor Local Notifications agenda os próximos 30 dias de avisos locais (agrupados por dia/horário), dependendo da permissão e das restrições de bateria do aparelho. Mudanças de dados e abertura do app atualizam o agendamento. Não depende de serviço pago ou servidor de push. Não anuncia nomes nem valores na tela bloqueada.

No navegador, os avisos são verificados enquanto o aplicativo está aberto; não há promessa de notificação com ele fechado. A central de pendências funciona independentemente da permissão. Ao sair do login, o app cancela os avisos locais; ao trocar de usuário, o agendamento anterior não é reutilizado.

## Supabase

Execute **supabase/solicitacoes.sql** depois de setup.sql e compartilhamento.sql. O script cria a fila de solicitações, RPCs e um bucket privado de comprovantes, sem alterar os lançamentos existentes. Pode ser executado novamente. O APK usa apenas a chave pública.

O servidor exige convite e e-mail confirmado, restringe a lista do convidado aos próprios envios e valida os dados financeiros. Só o titular resolve as solicitações. A aprovação bloqueia a revisão do cofre e a solicitação na mesma transação; conflitos, mês fechado ou categoria inválida não geram aprovação parcial. Revogar o convite bloqueia novos envios e a leitura dos comprovantes pelo participante. Cada solicitação aceita um comprovante, limitado pelo bucket privado. Links de leitura expiram em um minuto.

A exclusão do próprio login primeiro remove seus comprovantes pelo Storage API e depois chama a função administrativa já instalada. Nenhuma chave secreta é incorporada ao app. Sem instalar o SQL, as demais melhorias funcionam; os envios e comprovantes informam a configuração necessária.

## Verificação

Testes de domínio com SQLite verificam histórico e rollback, restauração, reimportação, conciliação, pagamentos parciais, previsões, prazos e cálculos diários. Testes PostgreSQL verificam permissões reais, RLS de comprovantes, convites, validação, revisão concorrente e aprovação única. Verificação de navegador percorre as telas principais e o envio de convidado sem abrir banco financeiro nem chamar gravação de cofre no modo de consulta.
