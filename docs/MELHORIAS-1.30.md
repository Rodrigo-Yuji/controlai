# Organização e economia de armazenamento — 1.30

## Lançamentos

Principal e consulta usam a ordem de cadastro, com o último registro adicionado no topo, incluindo a prévia de últimos lançamentos. Os IDs numéricos já existentes são atribuídos na inserção e preservados nas edições e na sincronização; não foi necessário adicionar outra coluna ou reconstruir datas antigas. Previsões automáticas ainda não registradas ficam abaixo dos registros cadastrados. A lista de contas a vencer mantém sua ordem de vencimento.

## Organização

- O orçamento semanal mostra apenas o disponível por dia, calculado pelo saldo e pelos dias restantes. A referência diária estática foi retirada.
- Os campos de lembretes ficam alinhados pela base, mesmo com rótulos de duas linhas. Telas muito estreitas mantêm uma coluna.
- Planilha e conciliação ficam em Ajustes → Importar planilha e extrato, com opções internas separadas.
- Seu espaço é a primeira seção dos Ajustes.
- Conta de login é um cartão próprio logo abaixo, com Alterar senha e Deletar minha conta sempre visíveis. O principal usa um portal para manter as proteções contra sincronização concorrente sem esconder os botões no painel de sincronização.
- O convidado abre solicitações pelo botão flutuante em Início e Lançamentos. O formulário foi retirado dos Ajustes e não inclui arquivos.
- Transferências e saldos pessoais do convidado de casal começa recolhido.
- Pendências e previsão de saldo fica imediatamente antes de Últimos lançamentos, no principal e na consulta.

## Armazenamento

O histórico guardava cópias de antes/depois e crescia com cada alteração. A gravação, a lixeira e a restauração de exclusões foram removidas. O histórico antigo é retirado do banco local, das bases de sincronização e das cópias de recuperação. Contas, lançamentos, reservas, categorias, recorrências, salários e fechamentos permanecem intactos.

Snapshots, backups e importações deixam de carregar a propriedade antiga de histórico. O diff de registros usado no contador de sincronização continua funcionando, sem gravar eventos. A atualização de revisão causada pela limpeza na nuvem preserva alterações financeiras locais que ainda aguardem envio.

Anexos privados consumiam o Storage do Supabase. A interface de envio e leitura foi retirada. Arquivos já enviados são preservados e continuam ocupando espaço até serem excluídos pelo responsável no Storage; esta atualização não os apaga automaticamente. A exclusão do próprio login mantém o procedimento anterior de limpeza de seus arquivos.

## Atualização administrativa

Execute supabase/economia-armazenamento.sql depois da configuração de solicitações. O script:

1. Retira somente o histórico dos cofres existentes.
2. Impede que clientes antigos voltem a salvar histórico na nuvem.
3. Para de gerar histórico em aprovações de solicitações.
4. Desativa novos uploads e a função de anexar comprovantes.
5. Preserva solicitações e os objetos de comprovantes existentes.

Pode ser executado novamente. A revisão do cofre só aumenta pela limpeza quando havia histórico. O PostgreSQL pode reutilizar o espaço liberado conforme sua manutenção normal; o objetivo é retirar o conteúdo adicional e impedir seu crescimento.

## Validação

Testes SQLite e PostgreSQL verificam remoção do histórico, preservação dos dados financeiros, conservação de alterações não sincronizadas, bloqueio de uploads e preservação de arquivos antigos. Testes de ordenação cobrem cadastro de hoje acima de previstos antigos com datas futuras. A interface foi verificada em 320, 390 e 1280 pixels, incluindo o cartão de segurança, o diálogo flutuante, os campos de lembretes e o acesso de consulta sem abrir banco financeiro.
