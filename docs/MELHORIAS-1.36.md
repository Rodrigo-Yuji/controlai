# ControlAI 1.36 — solicitações compactas e identificação pelo titular

## Visual

O contador de solicitações aguardando aprovação fica alinhado ao título. Quando não couber na mesma linha, começa abaixo com a mesma margem esquerda. Cards têm espaçamentos menores, remetente e destinatário agrupados, categoria e ações aproximadas e texto introdutório mais curto. Os controles principais mantêm altura mínima de 44 pixels. Observações respeitam quebras de linha e linhas em branco no titular e no convidado, sem truncar o conteúdo.

## Quem é cada e-mail

Somente o titular define a pessoa de cada e-mail em Ajustes → Acessos de consulta. É possível associar um nome ao liberar acesso ou carregar os acessos existentes, selecionar a identificação e usar Salvar identificação. Na Gestora são os participantes cadastrados; na conta Casal são os dois titulares, pelos nomes configurados nos salários. Um acesso sem pessoa associada continua consultando, mas não pode enviar compra para reembolso.

O convidado vê a identificação somente para leitura. O formulário de compra não tem mais Pessoa que pagou nem permite escolher outro nome. A identificação vem do servidor, vinculada ao titular, conta e e-mail verificado, e funciona em outros dispositivos. O servidor determina o pagador; o identificador enviado como expectativa apenas detecta uma troca de vínculo enquanto o convidado preenche um pedido.

## Segurança

A API de associação só atua nas contas do titular autenticado. A tabela de acessos continua sem escrita direta para convidados. Rotas novas e antigas de solicitação verificam a associação por meio de validação no servidor, incluindo um gatilho que permanece ativo mesmo se funções antigas de solicitações forem reinstaladas.

Trocar o vínculo não reescreve compras já aprovadas nem seus destinatários. Uma solicitação pendente enviada com identificação antiga precisa ser retirada/recusada e enviada novamente antes da aprovação. Se o participante deixar de existir, o envio falha até o titular corrigir a associação. Os demais dados e permissões das contas não são ampliados.

## Ativação

Execute `supabase/identidade-consulta.sql` depois das atualizações anteriores. O script acrescenta a associação aos acessos e instala funções/validações; não escolhe nomes automaticamente nem altera pagamentos ou aprovações existentes. Depois da publicação, associe os e-mails já convidados em Acessos de consulta. Sem associação, solicitações de reembolso ficam bloqueadas por segurança. A chave pública do aplicativo não tem permissão para instalar funções administrativas.

## Validação

180 testes passaram. Casos de autorização, associação atômica, isolamento por conta, tentativa de falsificar pagador nas rotas antigas/novas, identificação desatualizada, mudança de vínculo sem reescrever reembolsos, repetição de SQL e compatibilidade. Navegador no titular e no convidado: associação em Acessos de consulta, formulário sem seleção de pessoa, bloqueio de envio sem vínculo, preenchimento automático em outro dispositivo, quebras de linha, contador alinhado e cards compactos entre 320 e 1280 pixels. As regras anteriores de desistência, desfazer decisões, reembolso parcial/integral e paginação são preservadas.
