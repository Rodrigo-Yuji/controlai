# ControlAI

Aplicativo de controle financeiro **offline-first** para Android e iOS, instalável pelo navegador (PWA).

## Funcionalidades

- Dashboard mensal, receitas recebidas e previstas, despesas e saldo
- Receitas/despesas fixas ou variáveis; categorias personalizadas
- Recorrência mensal gerada por até 120 meses; parcelamentos de até 120 parcelas
- Distribuição mensal da renda em fixos, variáveis e reserva
- Peso dos gastos por categoria; relatório anual com gráfico
- Backup JSON (exportação/restauração) e IndexedDB local

## Desenvolver no GitHub Codespaces

```bash
npm install
npm run dev
```

Abra a porta 5173 na aba **Ports**.

## Publicar no GitHub Pages

1. Vá a **Settings → Pages** no repositório e configure **Build and deployment → Source: GitHub Actions**.
2. Adicione o workflow fornecido em `.github/workflows/deploy.yml`.
3. Faça commit/push para `main` e acompanhe **Actions**.
4. Acesse `https://rodrigo-yuji.github.io/controlai/` quando a publicação terminar.

> O endereço do PWA exige HTTPS para service worker. No iOS, use Safari → Compartilhar → Adicionar à Tela de Início. No Android, use o menu de instalação do Chrome.

## Privacidade e limitações

Os dados ficam apenas no armazenamento local **de cada navegador/dispositivo**. Não há sincronização automática. Limpar dados do site, desinstalar o app ou políticas do navegador podem apagá-los. Exporte backups periodicamente e guarde-os fora do GitHub público. O armazenamento local não é criptografado pelo aplicativo. O app não acessa bancos, cartões ou contas reais.

**Importante:** o saldo representa receitas e despesas confirmadas **no mês selecionado**, não o saldo real de uma conta bancária. Recorrências futuras são criadas como previstas e exigem confirmação manual. As metas de reserva são planejamento, não movimentações de conta.

## Qualidade

```bash
npm run build
```

O projeto é uma versão inicial funcional e deve ser testado com seus cenários antes de usar para registros financeiros importantes.
