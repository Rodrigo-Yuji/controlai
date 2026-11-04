# ControlAI v4.2 — Mobile First, Offline

Aplicativo PWA de finanças pessoais (React, TypeScript, Vite, Dexie/IndexedDB).

## Funcionalidades v4.2

- Fechamento e reabertura de mês por conta: bloqueia edição, exclusão e confirmação de lançamentos do mês fechado.
- Compras parceladas: informe valor total e número de parcelas; centavos são distribuídos sem perda, com vencimentos mensais previstos. Exclusão em lote remove apenas parcelas previstas de meses abertos.
- Orçamento semanal de despesas variáveis: semanas terminam no domingo, limite mensal distribuído igualmente pelas semanas.
- Contas a vencer: previsões do mês selecionado com data até sete dias à frente, incluindo atrasadas do mesmo mês.
- Backup JSON opcionalmente criptografado com AES-GCM e senha (PBKDF2 SHA-256, 250 mil iterações). A senha não é recuperável.
- Mantidas as funcionalidades anteriores: contas individuais/conjuntas, salários, categorias, recorrências, reservas, orçamento, modo escuro e assistente inicial.

## Instalação

```bash
npm install
npm run build
npm run dev -- --host 0.0.0.0
```

Envie os arquivos extraídos para a raiz do repositório (não a pasta ZIP). A publicação do GitHub Pages usa `.github/workflows/deploy.yml`.

## Atenção

Dados ficam no IndexedDB do dispositivo. Exporte backup antes de atualizar. Backup sem senha contém dados em texto legível. A versão deve ser testada no Codespaces antes da publicação.

## Assistente local

A aba **Assistente** na navegação inferior permite adicionar lançamentos à conta selecionada, sem substituir o banco ou enviar planilhas a uma API. A interpretação usa regras locais, sem modelo de IA ou assinatura.

- Importe **CSV** (vírgula, ponto e vírgula ou tabulação) ou **Excel .xlsx**. Arquivos .xls devem ser convertidos primeiro. Limites: 5 MB por arquivo e 500 lançamentos por aba. Escolha a aba e confira o mapeamento das colunas antes de revisar.
- A primeira linha deve conter os cabeçalhos. Descrição e valor são obrigatórios; data, tipo, categoria, status e observação são opcionais. Sem tipo, valores negativos significam despesas e positivos significam receitas. Sem data, usa hoje; sem status, confirmado. Valores são armazenados em centavos inteiros.
- Exemplo de CSV: `Descrição;Valor;Data;Tipo;Categoria;Status;Observação`. Uma linha pode ser `Almoço;40,00;04/11/2026;despesa;Alimentação;confirmado;Com colegas`.
- Digite ou dite um comando simples, como “comprei almoço por 40 reais” ou “recebi salário de 2500 reais ontem”. O resultado é uma sugestão editável, não um lançamento automático. Sem data, usa hoje. Comandos ambíguos devem ser corrigidos.
- Confira a prévia e clique em **Confirmar lançamentos**. Possíveis duplicatas são comparadas por data, tipo, valor, descrição e categoria e ignoradas por padrão; a opção pode ser desmarcada para permitir lançamentos iguais de propósito.
- O salvamento verifica conta, categorias e todos os meses envolvidos dentro de uma transação. Meses fechados bloqueiam a gravação; corrija ou desmarque essas linhas, ou reabra o mês em Orçamento.
- Planilhas e comandos digitados funcionam offline depois que a PWA foi carregada e seu cache ativado. O reconhecimento de voz é fornecido pelo navegador, exige permissão de microfone e pode depender de internet/enviar áudio ao serviço dele. O ControlAI não grava áudio. Quando indisponível, use texto ou o ditado do teclado.

Para executar os testes das regras locais, use `npm test` com Node.js 22.18+ (ambiente de desenvolvimento validado com Node.js 24). `npm run build` e `npm run lint` continuam disponíveis.
