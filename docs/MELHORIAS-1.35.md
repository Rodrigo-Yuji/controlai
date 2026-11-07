# ControlAI 1.35 — ciclo das solicitações

## Solicitante

Pode desistir de um envio enquanto a solicitação estiver pendente de decisão. A desistência fica identificada no histórico; uma solicitação aprovada ou recusada não pode mais ser retirada pelo convidado. O servidor verifica o próprio solicitante e bloqueia uma aprovação concorrente após a desistência. Não apaga o registro nem permite contornar o limite diário de envios.

A lista mostra os cinco últimos envios, em ordem de criação, com Exibir mais para carregar os próximos cinco. A paginação não fica limitada às 100 solicitações antigas da versão anterior. A consulta continua isolada por conta e solicitante.

## Titular

Todas as solicitações aguardando decisão e todos os reembolsos pendentes da gestora ficam visíveis em Em andamento, sem limite de quantidade. Só o histórico recente começa com três itens, carregando outros três por Exibir mais. Solicitações ativas e histórico são consultados separadamente no servidor, inclusive quando houver mais de 100 pendências.

Na Gestora, Desfazer recusa devolve a solicitação a pendente. Desfazer aprovação remove somente o lançamento ou a compra gerada por aquela solicitação e devolve-a a pendente. Para um lançamento comum confirmado originalmente pela aprovação, sua remoção reverte o efeito no saldo; a tela explica isso antes de confirmar. As datas, valores e registros de outras operações são mantidos.

Se houver reembolsos vinculados à compra, é necessário estorná-los em Gestão antes de desfazer a aprovação. Pagamentos parciais, conciliações, alterações no lançamento, mudanças na compra e meses fechados bloqueiam uma remoção insegura. A operação verifica titular, tipo Gestora, estado esperado e revisão do cofre, e é atômica. O convidado não pode desfazer decisões nem alterar dados financeiros.

## Visual

Identificadores com texto e ícone distinguem Aguardando decisão, Aprovada, Reembolso pendente, Concluída, Recusada e Desistência. Aprovação de um previsto não é exibida como pagamento concluído. O aplicativo mantém a atualização automática e não adiciona botão de atualização manual.

## Ativação

Execute `supabase/solicitacoes-ciclo.sql` no SQL Editor depois da atualização de reembolsos. O script atualiza funções e amplia os estados permitidos, sem excluir solicitações, lançar pagamentos, desfazer decisões existentes ou criar tabelas de histórico. A chave pública não tem permissão administrativa para instalar essas funções. O script pode ser executado novamente, inclusive quando já houver desistências.

## Validação

A versão passou em 174 testes. Testes PostgreSQL de autorizações, desistência antes/depois de decisões, reversão isolada de aprovação/recusa, bloqueio de reembolsos/alterações/conciliações/meses fechados, reaprovação sem duplicidade, revisão e tipo de conta. Paginação com mais de 100 solicitações ativas, histórico em páginas de três, convidado em páginas de cinco e proteção dos dados de outros solicitantes/contas. Testes de navegador validam o fluxo em dois acessos, todos os ativos visíveis, desistência, desfazer decisões, botão bloqueado após reembolso, estados visuais, atualização automática e larguras de 320 a 1280 pixels.
