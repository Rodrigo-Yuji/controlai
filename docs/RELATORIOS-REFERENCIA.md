# Relatórios por mês de referência

Nos relatórios do titular e do convidado, **Mês de referência** é a visão inicial; **Data do pagamento** mostra as entradas e saídas pela data real. Apenas valores confirmados entram nas duas visões. Pagamentos parciais contam pelos valores efetivamente confirmados.

No formulário de lançamento, o mês de referência é opcional. Sem preenchimento manual, o sistema usa a previsão original dos pagamentos e das recorrências; lançamentos antigos sem essa informação usam sua data. Contribuições da gestora mantêm o mês da obrigação já registrado.

Exemplo: condomínio vencendo em 03/11 e pago em 28/10 aparece em novembro por referência e em outubro por pagamento. Alterar o vencimento de água ou luz preserva a ocorrência original; o titular pode ajustar o mês explicitamente quando necessário.

O saldo da conta, a data real dos movimentos e as faturas não são alterados por essa escolha. O campo é armazenado nos documentos já existentes do SQLite/IndexedDB e sincronizado no snapshot; não exige migração SQL.

Validação: 192 testes passaram; build e lint passaram. O navegador validou as duas visões nos acessos do titular e do convidado, edição manual com persistência após recarregar e layout móvel/desktop. Testes cobrem antecipação, atraso, virada de ano, pagamentos parciais, contribuição da gestora, validação de snapshots e início do controle.
