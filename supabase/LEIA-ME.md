# Ativar sincronização do ControlAI

1. No painel do seu projeto Supabase, abra **SQL Editor → New query**.
   Cole e execute todo o conteúdo de [setup.sql](setup.sql). Pode executar novamente:
   ele mantém as cópias existentes. Não altere nem desative o RLS.
2. Em **Authentication → Providers → Email**, mantenha o login por e-mail e senha
   habilitado. Se a confirmação de e-mail estiver ativa, confirme o e-mail antes
   de entrar. Em **Authentication → URL Configuration**, use o endereço do site
   como Site URL; o aplicativo não depende de abrir um link especial no APK.
3. Em **Settings → Data API / API Keys**, obtenha a URL do projeto e a chave
   **publishable** (ou **anon**). Essas são configurações públicas. Nunca coloque
   `service_role` ou `sb_secret_...` no site, no APK ou no formulário.
4. No **APK**, exporte um backup JSON em Ajustes antes de conectar. Em
   **Ajustes → Sincronização entre dispositivos**, salve a URL e a chave pública,
   crie um login, confirme o e-mail e entre. Escolha **Usar dados deste dispositivo**
   para enviar a cópia do celular.
5. No **computador**, abra a versão atualizada do site. Na configuração inicial,
   pode escolher **Conectar dados de outro dispositivo**, sem criar uma conta vazia.
   Configure o mesmo projeto, entre com o mesmo login e escolha
   **Usar dados da nuvem**. Se já houver dados no computador, exporte o backup antes:
   essa escolha substitui a cópia local inteira, sem mesclar os lançamentos.

Após conectar, alterações locais disparam a sincronização e os outros dispositivos
consultam a revisão a cada 10 segundos, ao recuperar conexão e ao voltar à tela.
Sem internet, os dados continuam no SQLite do APK ou no IndexedDB do navegador.
O botão **Sincronizar agora** permite uma verificação imediata. É necessário que
ambos os dispositivos estejam conectados ao mesmo login e com o aplicativo aberto.

## Conflitos e recuperação

Se os dois dispositivos forem modificados antes de sincronizar, a sincronização
pausa. Não se escolhe silenciosamente a última gravação e não se mesclam IDs locais
que possam representar lançamentos diferentes. Exporte as cópias de recuperação
local e remota antes de escolher qual cópia inteira manter. A cópia do último
conflito/conexão fica no armazenamento local do aparelho até ser substituída por
outra recuperação. Os arquivos de recuperação individuais usam o formato de
backup JSON restaurável pelo aplicativo. Não incluem credenciais de login.

## Segurança, limites e operação

Cada login possui uma cópia privada, com RLS por `auth.uid()`. As contas financeiras
pessoais/conjuntas dentro dessa cópia pertencem ao mesmo login; não existe convite
para compartilhar com outro login nesta versão. O banco nega gravações diretas e
usa uma função que exige a revisão esperada, evitando sobrescrever alterações
concorrentes. O frontend valida as cópias antes de substituir dados locais, e a
substituição e o avanço da revisão local são atômicos.

O servidor guarda somente a cópia atual, sem duplicar um histórico de snapshots.
Cada cópia é limitada a 8 MB nesta primeira implementação; esse limite de envio
é separado dos 500 MB do banco do plano gratuito. Consultas sem mudanças trazem
somente a revisão, não todos os lançamentos. Uma atualização transfere a cópia
inteira: evite anexos. O tamanho do banco, o tráfego, as condições de inatividade
ou pausa e as demais cotas do Supabase devem ser acompanhados no painel do projeto.
Credenciais públicas não substituem RLS, e backups regulares continuam necessários.

Sair do login pausa a sincronização e mantém os dados locais. Trocar projeto ou
login exige uma nova escolha explícita da origem, sem enviar automaticamente os
dados do usuário anterior. A senha de login não é armazenada pelo ControlAI; a
sessão fica nos metadados locais privados, fora dos backups financeiros.
