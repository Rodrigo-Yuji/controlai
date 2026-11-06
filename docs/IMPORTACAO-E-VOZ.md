# Importação e voz na navegação (1.20)

A navegação passa a ter cinco abas: Início, Lançamentos, Orçamento, Relatórios e Ajustes. As funções antes agrupadas em Assistente continuam disponíveis nos locais abaixo.

**Ajustes → Importar planilha** é uma seção recolhida inicialmente. Ao expandir, selecione CSV ou Excel .xlsx, confira as colunas/abas e revise os lançamentos antes de confirmar. O processamento local, a leitura dos planos mensais, o controle de duplicatas e a proteção dos meses fechados são preservados. É possível recolher a seção novamente sem sair da tela.

**Lançamentos → botão flutuante de microfone** abre o popup e inicia a captura de voz quando disponível. No Android, usa o serviço de voz nativo; no navegador, depende do suporte ao reconhecimento. Confira o texto, interprete e revise antes de confirmar o lançamento. Permissão negada ou falta de suporte não impedem digitar o comando. Fechar descarta a revisão sem salvar; sair da aba ou mudar de conta encerra o contexto de voz. Os registros permanecem vinculados à conta escolhida.

O status de sincronização e o botão de tema aparecem à direita do título da página. A seleção de conta continua no cabeçalho do computador e na linha própria do celular.

Na Gestora, o bloco Saldo registrado da conta mostra apenas o saldo total pelos recebimentos e pagamentos confirmados, acumulado até o mês selecionado. Não há cartão, rótulo nem decomposição de reserva nesse bloco. Eventuais registros antigos de reserva são preservados; eles não são subtraídos do saldo total exibido. A conta Casal mantém total, corrente e reserva.

Esta versão não altera o formato de banco, backup ou sincronização e não requer novo SQL no Supabase.
