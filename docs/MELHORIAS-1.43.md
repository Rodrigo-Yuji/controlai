# ControlAI 1.43

- Sobras das semanas encerradas aumentam o disponível da próxima semana; gastos excedentes continuam reduzindo os limites seguintes.
- A transferência aparece no orçamento do titular e do convidado. A semana em andamento não antecipa sua própria sobra, e o ciclo salarial seguinte começa com seu próprio orçamento.
- O Controle de limites mostra o percentual consumido dos gastos fixos e variáveis comuns, incluindo valores acima de 100% e tratamento de limite zero.
- Verificação da mudança de dia enquanto aberto e atualização ao retornar ao aplicativo.

Validação: 199 testes, build e lint passaram. Navegador validado em celular, computador e acesso de consulta. Detalhes em `SOBRAS-SEMANAS-LIMITES.md`. Não exige SQL.
