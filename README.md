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
