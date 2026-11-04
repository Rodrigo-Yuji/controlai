# ControlAI v4 — Mobile First, Offline

Controle financeiro PWA para uso local no mesmo dispositivo, com contas individuais e conjuntas.

## Novidades
- Contas separadas (lançamentos, categorias, recorrências, reservas, orçamento e salários), com conta padrão.
- Conta conjunta com dois cadastros de salários e benefícios.
- Base de orçamento alternável entre receitas recebidas + previstas do mês e salários/benefícios configurados.
- Simulador de distribuição de fixos, variáveis e reserva.
- Modo escuro, logo de dinheiro e setas para navegar entre meses.
- Exportação e importação de backup com contas.

## Desenvolvimento
```bash
npm install
npm run build
npm run dev -- --host 0.0.0.0
```

GitHub Pages: publique o conteúdo **na raiz do repositório**. O workflow `.github/workflows/deploy.yml` compila e publica `dist` automaticamente ao enviar commits para `main`. O Vite usa `base: '/controlai/'`.

## Atenção
- **Faça backup JSON antes de atualizar.** Dados são armazenados no IndexedDB deste navegador/dispositivo, sem sincronização entre celulares.
- A atualização do banco migra registros anteriores para a conta `Minha conta` e converte o salário legado em `principal:1`.
- O backup JSON contém dados financeiros legíveis. Guarde-o em local seguro.
- A compilação não foi executada neste ambiente porque as dependências npm não estavam disponíveis offline. Rode `npm install && npm run build` no Codespaces e verifique os fluxos antes de usar com dados importantes.
