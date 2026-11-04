# ControlAI — Finanças pessoais offline

PWA para Android e iOS com React, TypeScript, Dexie/IndexedDB e Vite. Os dados são armazenados **localmente em cada dispositivo**. Sem servidor e sem sincronização entre celulares.

## Desenvolvimento no GitHub Codespaces

```bash
npm install
npm run dev
```

## Publicação

1. Envie os arquivos deste pacote para a **raiz** do repositório `Rodrigo-Yuji/controlai` (não envie a pasta que os contém).
2. Execute `npm install` para gerar/atualizar `package-lock.json` e faça commit do lockfile.
3. Verifique `npm run build`.
4. Em GitHub → Settings → Pages → Source, escolha **GitHub Actions**.
5. Faça push para `main`; o workflow `.github/workflows/deploy.yml` publicará `dist` em `https://rodrigo-yuji.github.io/controlai/`.

## Instalação

Android: Chrome → menu → Instalar aplicativo/Adicionar à tela inicial. iOS: Safari → Compartilhar → Adicionar à Tela de Início. O app precisa ser aberto online inicialmente para armazenar os recursos necessários ao uso offline.

## Recursos

- Receitas/despesas fixas e variáveis; previsto/confirmado; categorias; edição/exclusão.
- Recorrência mensal: gera lançamentos previstos por até 60 meses.
- Distribuição percentual da renda recebida em fixos/variáveis/reserva.
- Reservas registradas separadamente das despesas de consumo.
- Gráficos de gastos por categoria e relatório anual.
- Backup JSON (exportar/restaurar). O arquivo não é criptografado: guarde-o em local seguro.

## Cuidados

- Não apague dados do site ou desinstale antes de fazer backup.
- O IndexedDB pode ser removido pelo navegador/SO; exporte backups regularmente.
- A versão inicial não tem login, criptografia local nem sincronização entre dispositivos.
- Recorrências geradas não são atualizadas em lote ao editar uma ocorrência.
- Os percentuais atuais se aplicam ao mês consultado, inclusive meses anteriores; snapshots históricos de regras ainda não estão implementados.
- O relatório anual usa a data de lançamento e considera somente registros confirmados.


## Novidades da versão 3
- Logo PWA renovada.
- Categorias editáveis em Ajustes, com natureza fixa ou variável vinculada ao lançamento.
- Salário e benefícios em Ajustes, como referência percentual do Orçamento.
- Reserva com depósitos e retiradas, saldo acumulado e histórico.
- Pesquisa na aba Lançamentos.
- Aba Recorrentes: despesas mensais sem data final, projetadas em meses futuros; encerrar a recorrência preserva lançamentos confirmados e elimina os futuros previstos vinculados.
- Backup v3 inclui categorias, recorrências e salário; restaura backups anteriores compatíveis.

### Publicação
Extraia **o conteúdo desta pasta** diretamente na raiz do repositório GitHub, sem pasta adicional. Execute `npm install`, `npm run build` e faça commit/push. Configure Pages → GitHub Actions.

### Dados
Antes de substituir a aplicação, exporte um backup JSON da versão anterior. A migração Dexie mantém lançamentos, configurações e reservas já salvos no mesmo navegador.


## Versão 3.1: mobile-first

Layout responsivo otimizado para celulares: navegação fixa inferior, cartões compactos, filtros roláveis, botões com área de toque ampliada, formulários com fontes adequadas ao teclado móvel e edição de lançamentos em painel inferior. A versão desktop permanece responsiva.
