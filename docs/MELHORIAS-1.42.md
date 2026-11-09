# ControlAI 1.42

- A confirmação individual abre em **Quitar lançamento**: o valor final pode ser maior ou menor que a estimativa e quita a ocorrência inteira, sem deixar diferença prevista.
- **Pagar ou receber parte** mantém o comportamento anterior, registrando apenas a parte paga e preservando o restante pendente.
- A estimativa da recorrência permanece igual para os próximos meses. Data real, referência original, cartão e fatura são preservados.
- Quando já houve pagamentos parciais, quitar ajusta apenas o saldo restante; não modifica os pagamentos anteriores.

Validação: 195 testes passaram. O navegador confirmou valores finais menores e maiores, previsão do mês seguinte inalterada, pagamento parcial, persistência após recarregar e casos com/sem cartão. Build e lint passaram. Nenhuma atualização SQL necessária.
