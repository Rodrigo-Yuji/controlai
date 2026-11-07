# Senha, exclusão do login e organização dos Ajustes (1.26)

No principal: Ajustes → Sincronização entre dispositivos → Conta de login · senha e exclusão.

Na consulta: Ajustes → Segurança do login → Conta de login · senha e exclusão.

## Alterar senha

Informe senha atual, nova senha e confirmação. A identidade é reautenticada pelo Supabase antes de atualizar a senha; a conta retornada precisa ser a mesma do login aberto. As senhas não são armazenadas. Após a mudança, as sessões locais são encerradas e é solicitado novo login. Também é solicitado encerramento das outras sessões no serviço de autenticação. Se o projeto exigir confirmação adicional, use a recuperação por e-mail.

## Deletar minha conta

Trata-se da conta de login, e não apenas da conta financeira atualmente selecionada. A confirmação exige senha atual, a palavra EXCLUIR e a caixa de ciência marcada. São excluídos:

- O próprio usuário de autenticação.
- O próprio cofre financeiro na nuvem, por chave estrangeira com exclusão em cascata.
- Os acessos compartilhados concedidos pelo usuário e os recebidos pelo seu e-mail.

As contas financeiras de outros titulares não são excluídas. Os dados financeiros offline permanecem nos dispositivos e a tela informa isso antes de confirmar. É possível exportar um backup antes. Não se promete apagar remotamente cópias baixadas em outros aparelhos.

No principal, a sincronização é pausada durante a operação. A sessão local é retirada; se o vínculo e a cópia de recuperação pertencerem ao login excluído, esses metadados também são removidos, sem apagar os dados financeiros offline. Na consulta, os dados da tela e os tokens são limpos, e a seleção lembrada do login excluído é removida.

## Ativação no Supabase

Execute `supabase/conta-login.sql` no SQL Editor depois dos arquivos de sincronização e compartilhamento. O arquivo apenas cria a função: executá-lo não exclui usuários.

A função aceita somente a confirmação textual, sem parâmetro de usuário-alvo. O usuário vem do JWT autenticado. Exige autenticação por senha nos últimos cinco minutos, rejeita anônimos e exige AAL2 se houver fator MFA verificado. A exclusão e a remoção dos acessos são atômicas: uma falha de chave estrangeira reverte toda a operação. A chave pública do app não permite criar a função administrativa, por isso o titular precisa executar o arquivo no painel.

Os testes PostgreSQL incluem tentativa anônima, confirmação incorreta, senha não recente, timestamp futuro, autenticação por outro método, MFA, exclusão apenas do próprio usuário e rollback por restrição de chave estrangeira. Nenhum usuário real é excluído nos testes.

## Espaçamento

Os botões Sincronizar agora/Sair do login ficam em um grupo. Os backups ficam em outro, separados por margem e linha divisória. A segurança do login tem uma área recolhível própria, abaixo desses grupos.

## Uso pessoal e compartilhamento

A partir da versão 1.27, um mesmo login alterna entre **Meu sistema** e **Contas compartilhadas** em Ajustes → Seu espaço. Consulte [ESPACOS.md](ESPACOS.md) para os limites de acesso e a migração dos bancos locais.
