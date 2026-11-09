# Sobras semanais e percentuais dos limites

A sobra positiva de uma semana encerrada aumenta o limite da próxima. Semanas em andamento ou futuras não antecipam suas sobras. O excesso continua reduzindo as semanas seguintes, usando primeiro a sobra já recebida. O cálculo reinicia em cada ciclo salarial e preserva os centavos do orçamento-base.

Titular e convidado veem o valor transferido como **Sobra anterior** ou **Excesso anterior**. O orçamento se atualiza ao retornar ao aplicativo e verifica a mudança do dia enquanto permanece aberto.

O Controle de limites mostra o percentual consumido do limite de gastos fixos e variáveis comuns. O percentual pode ultrapassar 100%; quando há gasto com limite zero, informa **Limite zero excedido**.

Validação: 199 testes passaram; build e lint passaram. Testes no navegador confirmaram fechamento do domingo, transferência apenas na segunda-feira, atualização sem recarregar, concordância entre titular/convidado, percentuais e layouts móvel/desktop. Não exige atualização SQL.
