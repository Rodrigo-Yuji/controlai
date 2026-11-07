# ControlAI 1.34 — solicitações e reembolsos da gestora

Na consulta da Gestora, Solicitar oferece Compra para casa · preciso de reembolso. O convidado escolhe seu nome entre os participantes, informa descrição, valor, data da compra e observação. Essa opção representa uma compra já paga pelo participante. Lançamento da conta · sem reembolso mantém a solicitação comum de receita/despesa.

Ao aprovar a compra, o servidor cria um acerto na gestora, associado à solicitação e ao participante que pagou. A conta ainda deve devolver o valor: nenhuma saída de dinheiro é gerada pela aprovação. A compra fica disponível também em Mercados e acertos e na central de pendências. O valor comum integral da solicitação fica a reembolsar; este envio não inclui itens pessoais.

No Início, o titular encontra Solicitações dos convidados antes de Últimos lançamentos, em uma seção aberta. Aprova pela categoria e depois usa Confirmar reembolso para registrar somente o dinheiro efetivamente enviado, na data escolhida. O formulário mostra o restante e preenche o valor integral, com possibilidade de apagar e digitar um pagamento parcial. Cada confirmação gera uma única saída; o restante segue pendente. O acerto de mercado existente também reconhece esses pagamentos, evitando duplicidade entre as duas telas. Categoria e natureza aprovadas são preservadas.

O convidado acompanha Aprovação pendente, Reembolso pendente, valores já enviados e Reembolso concluído. Seu acesso financeiro continua somente leitura. Solicitações têm atualização automática a cada 30 segundos e ao retornar para a janela, sem botão Atualizar solicitações. A seção saiu dos Ajustes. Pendências de aprovação aparecem primeiro, inclusive no resultado limitado do servidor.

## Atualização do Supabase

Execute `supabase/solicitacoes-reembolso.sql` depois do script de solicitações já instalado. O arquivo substitui funções, preserva registros existentes e mantém o bloqueio de novos comprovantes. Não cria tabelas de histórico nem novos anexos. A chave pública do aplicativo não permite executar DDL no SQL Editor; essa etapa é feita pelo administrador do projeto.

O envio de compra com reembolso utiliza uma função própria. Se a atualização ainda não estiver instalada, o app mostra a instrução e não converte a solicitação em despesa paga da conta. Solicitações comuns continuam compatíveis. Não é necessário associar e-mail ao cadastro da pessoa: o participante indica quem pagou e o titular confere o nome e o e-mail de quem enviou antes de aprovar.

## Segurança e validação

A versão passou em 167 testes. Testes PostgreSQL verificam convite ativo, conta Gestora, pessoa pertencente à conta e válida no mês da compra, tipo e situação corretos, aprovação exclusiva do titular, revisão do cofre, idempotência, revogação, mês fechado e execução repetida da atualização sem alterar dados. Testes SQLite verificam aprovação sem débito, pagamentos parciais/integral, categoria e natureza, saldo real, restantes, excesso de pagamento, datas e valores inválidos e isolamento entre contas. O cliente falha com segurança contra servidores antigos.

O cenário de navegador cobre convidado → solicitação → atualização automática do titular → aprovação → reembolso parcial → reembolso final → atualização do convidado, incluindo as posições das seções, ausência de botão manual e larguras de 320 a 1280 pixels.
