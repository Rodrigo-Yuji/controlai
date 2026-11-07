# Acessos de consulta e popups de pagamento (1.22)

## Ativação no Supabase

Execute `supabase/compartilhamento.sql` no SQL Editor do mesmo projeto em que `supabase/setup.sql` já foi executado. A atualização é idempotente e foi testada em PostgreSQL com RLS e os papéis anon/authenticated. A chave publishable do aplicativo não tem permissão para executar SQL administrativo; esta etapa é feita pelo titular no painel do Supabase.

A migração mantém a política original: cada login só pode ler e sincronizar seu próprio cofre completo. Ela adiciona autorizações por conta financeira e funções específicas de consulta, que filtram a cópia no servidor. Não libere SELECT do cofre para participantes e não altere a política `own_vault`.

## Para o titular

1. Sincronize seus dados normalmente com seu próprio login.
2. Selecione a conta Casal ou Gestora que deseja compartilhar.
3. Em Ajustes → Acessos de consulta, informe o e-mail da pessoa e clique em Liberar consulta.
4. A pessoa acessa https://rodrigo-yuji.github.io/controlai/?consulta=1 usando o próprio e-mail e senha. É possível liberar o acesso antes de ela criar o login.
5. Para remover um acesso, carregue os acessos dessa conta e clique em Revogar.

Não compartilhe seu login de administração. A conta Solo não pode ser liberada. Cada autorização vale somente para uma conta. Quem recebe acesso à gestora vê todos os dados dela, incluindo as pessoas, contribuições, lançamentos, observações, mercados e reembolsos. Não recebe dados de nenhuma outra conta solo/casal do titular. Uma pessoa pode receber mais de uma autorização explicitamente.

## Para quem consulta

Abra o link, crie seu próprio login, confirme o e-mail e volte ao link para entrar. Selecione uma das contas autorizadas. A tela mostra saldo, resumo mensal, lançamentos com pesquisa, contribuições/mercados na Gestora e saldos pessoais no Casal. O mês e a pesquisa podem ser alterados; os registros financeiros não podem ser editados.

Os dados são os da última sincronização do titular. O acesso é conferido a cada 30 segundos e ao voltar à tela; Atualizar consulta verifica imediatamente. Revogar bloqueia novas leituras no servidor, e a próxima verificação limpa a tela. A revogação não pode apagar informações já vistas ou capturadas anteriormente.

O portal não usa o banco financeiro local do titular nem a sincronização de edição, e não grava as cópias consultadas em SQLite/IndexedDB. A sessão de consulta fica separada: sessionStorage por padrão, ou localStorage quando Entrar automaticamente é marcado. A senha não é armazenada. Sair limpa a sessão e os dados da tela. Requisições antigas de outra seleção ou sessão não podem repor os dados após sair ou trocar de conta.

## Pagamentos e transferências

Transferir para um titular agora mostra o disponível na data escolhida e o restante após o valor digitado. O valor abre preenchido com o saldo e selecionado, para ser substituído apenas digitando. Reabrir atualiza o saldo. A validação no banco local continua impedindo transferir mais do que foi liberado até aquela data.

Pagamentos/recebimentos parciais também abrem com o restante selecionado e mostram quanto sobrará. Reembolsos e repasses da Gestora abrem com o restante preenchido e selecionado. Contribuições mantêm a sugestão em placeholder e o preenchimento vazio: deixar vazio continua registrando todo o restante, conforme a regra anterior. Todos continuam sujeitos aos limites e às travas mensais.
