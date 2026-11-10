# ControlAI 1.44 — histórico compacto e lixeira

Em Ajustes → Histórico e lixeira, o titular consulta as alterações sincronizadas de contas, lançamentos, reservas, recorrências, categorias, salários, orçamentos e fechamentos. Cada evento identifica a conta, horário da sincronização, login responsável e diferenças entre os campos. Conteúdos extensos são resumidos; o histórico não copia snapshots completos.

A lixeira recupera lançamentos já sincronizados e posteriormente excluídos por até 30 dias. Edições feitas entre duas sincronizações aparecem como a diferença final; registros criados e excluídos antes de qualquer sincronização não chegam ao servidor. Não é um registro de cada tecla ou de cada ação offline intermediária.

Retenção: até 90 dias de eventos, no máximo 3.000 eventos e 300 cópias recuperáveis por login, compartilhados por suas contas. A limpeza ocorre em atualizações e consultas; não exige cron, e um projeto inativo não gera novos eventos. A tela informa o tamanho aproximado do conteúdo JSON, sem índices ou metadados.

O titular confirma a recuperação. O servidor verifica revisão de sincronização, conta, categoria, cartão, meses fechados, recorrência/parcela já substituída e restauração anterior. Pagamentos com vínculos de Gestão, solicitações, conciliação ou grupos parciais não são recuperados isoladamente. A restauração usa um ID disponível globalmente e mantém valor, data real, referência e status originais. Pode modificar o saldo, conforme o movimento recuperado.

O histórico está em uma tabela separada, protegida por RLS, não compartilhada com convidados e não incluída nos snapshots/backups financeiros locais. A proteção anterior que remove o campo legado `atividades` continua intacta.

Ativação: executar `supabase/historico-compacto.sql` no SQL Editor. Script idempotente, sem alteração dos lançamentos existentes, com exclusão em cascata ao remover o login.

Validação: 205 testes passaram; testes específicos do servidor cobrem diferenças compactas, autor, dados intactos em sincronização sem mudanças, isolamento entre logins, expiração, limites de armazenamento, recuperação única, ID global, meses fechados e vínculos. Navegador: seção recolhida, paginação de 20, Exibir menos, recuperação e atualização local, aviso de SQL ausente e layouts móvel/desktop. Build e lint passaram.
