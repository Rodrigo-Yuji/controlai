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

## Aplicativo Android com SQLite

O projeto inclui uma versão Android com Capacitor. **No aplicativo instalado, os dados financeiros ficam no SQLite nativo**, em um arquivo privado do pacote `com.controlai.app`. A versão web/PWA continua usando o IndexedDB existente: publicar o site não converte os dados do navegador em um arquivo nativo.

O app não exige servidor, conta online nem API paga para armazenar as finanças. A seleção de conta e o tema continuam sendo preferências da interface; contas, lançamentos, categorias, salários, orçamento, recorrências, reservas e fechamentos usam o banco selecionado pela plataforma. Em Ajustes, “Sobre o ControlAI” informa qual armazenamento está em uso.

### Gerar e instalar para teste

Requisitos: Node.js 22.18+ (validado com 24), JDK 21, Android SDK 36 e as ferramentas de compilação exigidas pelo Gradle. Instale/configure esses componentes pelo Android Studio ou pelas ferramentas oficiais de linha de comando.

```bash
npm ci
npm run android:sync
npm run android:open
```

No Android Studio, abra/executa o projeto em um aparelho ou emulador. Se `JAVA_HOME` e `ANDROID_HOME` já estiverem configurados, também é possível gerar o APK pelo terminal:

```bash
npm run android:build
```

O APK de teste será criado em `android/app/build/outputs/apk/debug/app-debug.apk`. Ele usa assinatura de desenvolvimento, não é uma publicação na Play Store e precisa ser validado em aparelho antes de uso definitivo. Atualizações instaladas sobre o mesmo aplicativo precisam manter o mesmo identificador e a mesma chave de assinatura; exporte backup antes de trocar de instalação ou assinatura.

`npm run build:native` gera assets com caminhos adequados à origem local do Capacitor, sem registrar service worker. `npm run build` continua gerando o site com base `/controlai/` para o Pages. O comando `android:sync` recompila os assets nativos antes de copiá-los para o projeto Android.

### Transferir seus dados do site

1. No site atual, use **Ajustes → Exportar backup JSON**; pode usar a opção de senha.
2. Instale/abra o APK e conclua o primeiro acesso; a renda pode ser configurada mais tarde.
3. No Android, use **Ajustes → Importar backup**, selecione o JSON e informe a senha, quando houver. A restauração substitui os dados daquela instalação após confirmação, dentro de uma transação SQLite.
4. Confira contas, saldos, parcelas, observações e fechamentos antes de deixar de usar a versão anterior.

O aplicativo nativo não consegue ler automaticamente o IndexedDB do Chrome ou do site no GitHub Pages, pois são origens distintas. A transferência entre eles é feita por backup, sem sincronização automática.

Se uma instalação Capacitor anterior já tiver IndexedDB na **mesma WebView**, a primeira abertura migra os registros para o SQLite vazio em uma única transação. A origem não é apagada. O processo registra sua conclusão e não repete a importação; se houver falha, reverte a cópia e mantém a origem. Um SQLite que já contenha dados não é sobrescrito/mesclado automaticamente. Uma cópia bruta da migração fica em `storage_meta`, inclusive tabelas históricas sem correspondência na interface atual.

### Persistência e backup

O arquivo SQLite é independente dos dados do navegador Chrome. Desinstalar o aplicativo ou limpar **os dados do próprio aplicativo** ainda pode apagá-lo. O banco desta versão não recebe uma senha própria; o backup opcionalmente criptografado com AES-GCM continua disponível.

No Android, exportar abre o compartilhamento nativo para escolher onde guardar o arquivo. Apenas a pasta temporária de backups é exposta pelo FileProvider; o banco privado não é compartilhado. O backup automático do pacote pelo Android foi desativado, evitando cópias automáticas não solicitadas. Faça e guarde backups manuais.

### Camada de armazenamento e validação

- `src/storage/legacy.ts`: mantém os esquemas e migrações Dexie anteriores para a web.
- `src/storage/web.ts`: usa o IndexedDB existente e a observação de consultas do Dexie.
- `src/storage/sqlite.ts`: schema SQLite versão 1, consultas por conta, chaves, índices, unicidade de categorias e transações atômicas. O formato interno preserva os campos dos registros em JSON, com chaves e conta indexadas em colunas SQL.
- `src/storage/native.ts`: conexão nativa com `@capacitor-community/sqlite`. Não usa SQLite em WebAssembly/IndexedDB como substituto no Android.
- `src/storage/migration.ts`: conversão não destrutiva do snapshot legado.
- `src/storage/useLiveQuery.ts`: atualiza a interface depois de commits e evita reutilizar dados da conta anterior enquanto a nova consulta carrega.

Callbacks de `db.transaction` recebem `tx` explicitamente: use `tx` nas operações internas. Isso evita que uma gravação independente entre por engano na transação assíncrona de outra operação.

`npm test` executa as regras do Assistente e os testes de armazenamento com SQLite real (`node:sqlite`): persistência em arquivo, rollback, concorrência, isolamento de contas, migração/idempotência, arquivo legado preservado e rejeição de centavos inválidos. A compilação do APK não substitui os testes do plugin e do compartilhamento em um aparelho Android real.

### Importar planos mensais por blocos

Em **Assistente → Selecionar planilha**, arquivos `.xlsx` com blocos de
Despesas/Receitas lado a lado são reconhecidos automaticamente. Escolha a aba,
confira o mês e informe um dia de referência: o plano contém somente o mês,
não a data efetiva de cada compra. Datas permanecem editáveis na revisão.

Observações e indicações de parcelas são preservadas; não são geradas parcelas
futuras. Somente marcações explícitas como `OK` ou `pago` confirmam os valores;
os demais ficam previstos. Dívidas anteriores, totais, reservas/poupança,
valores zero e cálculos auxiliares aparecem no relatório de itens ignorados.
Linhas com valor e sem descrição exigem correção ou desmarcação antes de salvar.

A identificação de possíveis duplicatas também considera a célula de origem
nos planos mensais, preservando compras iguais em linhas diferentes. Confira a
revisão ao importar versões reorganizadas da planilha ou dados já cadastrados
manualmente. Nada é gravado antes de **Confirmar lançamentos**, e os meses
fechados continuam protegidos. O processamento do arquivo ocorre localmente.

### Fixos automáticos no orçamento

O percentual de Fixos é somente leitura: soma as despesas recorrentes (permanentes
ou repetidas) e parcelas do mês selecionado, previstas e pagas, e divide pela base
de renda escolhida. Uma recorrência já lançada não recebe outra previsão no mesmo
mês. O total em reais usa os centavos originais; somente o percentual é arredondado
para duas casas decimais. O cálculo é atualizado por conta, mês e base de renda,
sem depender do percentual fixo salvo anteriormente. Variáveis e Reserva continuam
editáveis e aceitam até duas casas decimais, mantendo o total de 100%.

Sem renda, o total em reais permanece visível e o percentual aparece vazio. Se os
compromissos excedem a renda, o percentual pode superar 100% e o orçamento mostra
um aviso. Pagamentos recorrentes e parcelas são acompanhados como gastos fixos;
as demais despesas entram no acompanhamento de gastos variáveis. Isso não altera
os lançamentos, suas categorias ou seu histórico.

### Ciclo semanal entre pagamentos

O orçamento semanal da aba selecionada começa no quinto dia útil desse mês e
termina um dia antes do quinto dia útil do mês seguinte. A contagem salarial
inclui sábados e exclui domingos e feriados nacionais fixos; não inclui feriados
estaduais, municipais ou pontos facultativos. Essa regra também aparece na tela.
Cada semana tem até sete dias a partir do pagamento, incluindo os gastos pagos
no mês seguinte que ainda pertencem ao ciclo. Previstas, receitas, recorrentes e
parcelas não entram nos gastos variáveis semanais. O limite é dividido igualmente
pelas semanas, distribuindo o resto dos centavos sem alterar o total.

O total da distribuição indica o percentual que falta (ou excede) para chegar a
100%, com vírgula decimal. Quantidades de parcelas e de repetições mensais podem
ficar vazias durante a edição e são validadas antes de gerar lançamentos.

A identidade visual utiliza uma versão adaptada do símbolo enviado pelo usuário
(carteira azul-marinho, barras e seta verdes), sem o texto no ícone pequeno. Os
recursos são compartilhados pelo cabeçalho, ícone PWA/favicon e variantes de ícone
e abertura do Android. O modo noturno define fundos e cores de texto específicos
para cartões, filtros, estados, campos e gráficos.

Para gerar o Android, use `npm run android:build`: a sequência interrompe em falhas
de compilação/sincronização e compara todos os arquivos web dentro do APK com o
build nativo recém-gerado. A verificação rejeita interfaces antigas e service
workers de PWA no pacote Android. A versão da interface é exibida em Ajustes.
Também é possível conferir um APK com
`python3 scripts/verify-android-bundle.py caminho/do/app.apk` logo após o build
nativo (antes de substituir `dist` por um build web).
