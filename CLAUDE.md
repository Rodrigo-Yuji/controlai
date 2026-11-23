# ControlAI

App de controle financeiro (PWA + Android). Contas **Solo**, **Casal** e **Gestora**. Responda e escreva textos da interface em **português do Brasil**.

## Stack
- React 19 + TypeScript + Vite, PWA (`vite-plugin-pwa`), gráficos com Recharts. Visual: `src/style.css` + camada `src/theme.css` (variáveis de cor; mobile-first).
- Dados locais: **Dexie/IndexedDB** no navegador e **SQLite** (`@capacitor-community/sqlite`) no Android via Capacitor 8 (pacote `com.controlai.app`).
- Sincronização opcional com **Supabase** (login por e-mail).

## Comandos
- `npm ci` · `npm run dev` · `npm run build` (`tsc -b && vite build`, base `/controlai/` para o Pages) · `npm run lint` · `npm test`
- Android: `npm run android:sync`, `npm run android:build`. Precisa de JDK 21, Android SDK 36 e python3. O APK de teste sai em `android/app/build/outputs/apk/debug/app-debug.apk` (assinatura de debug; para atualizar sem perder dados, mantenha a mesma chave e o mesmo identificador).
- O build nativo (`build:native`) não registra service worker; não misture com o build web.
- Antes de qualquer push: `npm run build`, `npm run lint` e `npm test` precisam passar.

## Arquitetura de dados
- Camada em `src/storage/` (`web.ts`, `sqlite.ts`, `native.ts`, `legacy.ts`, `migration.ts`, `types.ts`). Tabelas: `contas`, `fechamentos`, `lancamentos`, `configuracoes`, `reservas`, `categorias`, `recorrencias`, `salarios`. IDs numéricos em `lancamentos`, `reservas`, `categorias`, `recorrencias`; texto nas demais.
- Em `db.transaction([...tabelas], async tx => ...)` use sempre `tx` dentro do callback, nunca `db`.
- `Conta` é um documento com listas embutidas (`distribuicoesCasal`, `transferenciasPessoais`, `emprestimosReserva`, `cartoes`, `pessoas`, `mercados`...). Campo novo em `Conta` ou nos registros não exige tabela nova.
- Valores em **centavos inteiros**. Datas `YYYY-MM-DD`, meses `YYYY-MM`. Mês fechado bloqueia alterações: use `ensureOpenMonth` (`src/account-guards.ts`).
- Regras do casal: `src/couple-budget.ts`, `CoupleBudgetPanel.tsx`. Empréstimos da reserva: `src/reserve-loans.ts` e `ReserveLoansPanel.tsx` (devolução acima do pendente guarda o excedente em `acrescimoCentavos`, que também entra na reserva). Parcelamento opcional em `parcelamento` ({parcelas, primeiroVencimento}): é só um cronograma; as devoluções abatem as parcelas em ordem e parcela vencida não paga fica atrasada (`loanInstallments`, `loanLateness`). Gasto avulso da reserva: `src/reserve-spending.ts` (linha de `reservas` com `gasto: true`, reduz o total, não o saldo corrente). Saldo: `registeredBalance` em `src/account-balance.ts`.
- Devolução de gasto (estorno): `src/expense-refund.ts`. É um lançamento `despesa` com `estorno: true` e `valorCentavos` **negativo**, sempre confirmado e sem cartão, parcela ou recorrência; as somas de despesa (categoria, semana, saldo) abatem sozinhas. Para exibir use `Math.abs`.
- Dados vindos de backup ou sincronização são validados em `src/sync/snapshot.ts` (`validateSnapshot` → `validateManagement` e `validateFinancialReferences`). Regra nova sobre a conta entra em `validateManagement`.

## Supabase
- A sincronização envia **um snapshot JSON** único por usuário (tabela `controlai_vaults`, limite de 8 MB, função `controlai_push`). Mudança no formato dos dados normalmente **não** exige SQL.
- SQL e regras RLS ficam em `supabase/`; leia `supabase/LEIA-ME.md` antes de aplicar qualquer coisa.
- Projeto do app: **ControlAI** (`ipjsyzwwfbnxuegbnowc`, us-east-1). **Nunca altere o projeto "Casa em dia"** (`acwxvgvzbrwnmjsfipqn`) nem outras contas.
- Não imprima nem grave chaves, senhas ou tokens. A chave pública já fica em `src/sync/config.ts`.

## Código e testes
- O estilo atual é denso (funções curtas em poucas linhas) e muitos arquivos usam CRLF. Preserve o estilo e o fim de linha do arquivo que estiver editando.
- Testes usam `node:test` rodando direto com `node src/arquivo.test.ts` (Node 22.18+). Registre cada teste novo na cadeia do script `test` do `package.json`. Alguns testes antigos exigem `@electric-sql/pglite`.
- Mensagens de erro e textos da interface em português.

## Fluxo de trabalho com Git
- Nunca commite direto na `main`. Crie uma branch nova a partir da `main` atualizada (`git pull` primeiro), abra Pull Request e faça o merge depois de build, lint e testes passarem.
- Não use `git push --force`. Não commite arquivos `.zip`, `node_modules` ou `dist`. Os `.zip` antigos na raiz são versões históricas e devem ser ignorados.
- O deploy no GitHub Pages roda por `.github/workflows/deploy.yml`; confira o gatilho no arquivo e acompanhe a aba Actions depois do merge.
- O dono usa Windows (cmd) e a pasta local fica em `C:\Users\Banana\Documents\Codex\2026-11-13\continue-no-reposit-rio-rodrigo-yuji-2\work\controlai`.

## Cuidados
- Os dados do usuário ficam no aparelho. Antes de mudar formato de dados, migração ou backup, avise para exportar o backup JSON em Ajustes e nunca apague dados sem pedido explícito.
- Peça confirmação antes de: apagar dados, mudar o Supabase, publicar no Pages ou gerar release.
- Empréstimos, devoluções e gastos avulsos da reserva não são lançamentos e não entram no orçamento variável nem nos relatórios.
