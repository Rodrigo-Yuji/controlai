# Meu sistema e Contas compartilhadas — 1.27

Ajustes → Seu espaço oferece duas opções para o mesmo login:

- **Meu sistema:** contas próprias com edição, configurações e sincronização do próprio cofre.
- **Contas compartilhadas:** apenas leitura das contas autorizadas pelo titular. A lista e o conteúdo continuam passando pelos RPCs e pelas regras de acesso existentes no servidor.

Trocar de espaço não exige outra senha e mantém a conta compartilhada selecionada. O app lembra o último espaço por projeto e usuário. Links antigos com `?consulta=1` continuam funcionando. Não é necessário executar outro SQL.

## Separação local

SQLite no Android e IndexedDB no navegador usam um banco distinto por projeto e UUID do login. Os nomes usam a codificação hexadecimal da identidade completa para evitar colisões, caracteres inválidos e uso do e-mail como identidade. O banco pessoal novo não importa o IndexedDB antigo do WebView. Preferências da conta financeira padrão também são individuais. As contas consultadas permanecem apenas na memória do modo de consulta e nunca são importadas para o banco pessoal ou enviadas ao cofre do convidado.

A sessão fica fora do banco financeiro e atende aos dois espaços. A preferência de entrar automaticamente determina se os tokens ficam persistidos ou apenas na aba/WebView atual. Sair ou trocar de login invalida a sessão anterior, inclusive em outras abas; respostas de renovação atrasadas não podem substituir a identidade atual. Após sair, os dados financeiros ficam no dispositivo, mas a tela retorna ao login. Isso é separação de perfis no aplicativo, não criptografia adicional dos arquivos locais.

## Migração dos dados existentes

O banco original não é apagado nem transferido automaticamente a outra pessoa. Quando há um proprietário identificável por metadados, vínculo de sincronização ou sessão antiga, ele fica reservado a esse usuário. O mesmo login continua abrindo esse banco, preservando lançamentos, pendências locais e recuperações. Um login diferente usa outro banco. Um login antigo marcado apenas para a sessão não passa a ser persistido pela migração.

Se os dados originais nunca tiveram login, o primeiro vínculo feito pelo painel de sincronização pede confirmação explícita. Cancelar abre um espaço separado e mantém a origem. A opção **Abrir dados offline sem login** permite continuar usando um banco original não vinculado; ela não abre bancos já associados a alguém. Dados sem proprietário não são adotados automaticamente quando um convidado entra.

Ao abrir um banco pessoal vazio pela primeira vez, o app consulta o próprio cofre: baixa os dados existentes ou cria uma base vazia com controle de revisão antes da configuração inicial. Uma criação concorrente não pode substituir um cofre que acabou de ser criado em outro dispositivo. Se a conexão falhar, a origem permanece intacta e o app oferece tentar novamente. Bancos já conectados continuam abrindo offline.

## Validação

Testes de sessão verificam persistência, saída, isolamento de usuário/projeto, resposta atrasada e troca de identidade entre abas. A verificação de interface percorre migração do proprietário, troca de espaço sem novo login, configuração pessoal do convidado, consulta autorizada somente leitura, cofres separados, retorno ao proprietário e isolamento entre abas, usando IndexedDB e SQLite reais em arquivos de teste. Nenhuma conta real é criada ou excluída.
