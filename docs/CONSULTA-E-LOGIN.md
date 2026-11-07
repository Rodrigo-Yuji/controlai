# Consulta do convidado e login (1.23)

## Navegação e relatórios

O convidado escolhe uma conta na primeira utilização. A escolha é lembrada por login neste dispositivo e validada novamente no servidor antes de carregar os dados. Para trocar, use Ajustes. Uma conta revogada deixa de ser carregada; o servidor continua isolando cada conta autorizada. Não há nova migração SQL.

As abas são Início, Lançamentos e Ajustes. Início mostra os cinco últimos lançamentos do mês escolhido; Ver todos abre Lançamentos com a listagem completa e pesquisa. O cabeçalho fica fixo, com seletor de mês e setas para navegar.

No Casal, após Resumo do mês vêm Orçamento semanal, Relatório anual e Peso dos gastos. O semanal usa a mesma regra de pagamento, semanas, limites, orçamento travado e parte comum do sistema principal. No anual, as barras representam receitas/despesas confirmadas e a linha representa o saldo de cada mês (receitas menos despesas, não saldo acumulado). A distribuição por categoria e o peso das despesas sobre os recebimentos usam os confirmados do mês.

Na Gestora, os gráficos aparecem abaixo de Mercados e reembolsos. Contribuições são agrupadas por mês de referência, como no sistema principal. O saldo registrado continua seguindo a data real dos recebimentos e pagamentos. Saldo positivo fica verde, negativo fica vermelho. Pessoas com a contribuição completa ganham barra verde de 100% e texto de conclusão, tanto no sistema principal quanto na consulta. Uma contribuição parcial fica amarela; sem obrigação prevista, a barra é neutra.

## Login

Os dois logins têm Entrar automaticamente neste dispositivo e botão de mostrar/esconder senha. No convidado, a opção mantém apenas a sessão autenticada em localStorage; sem ela, a sessão fica em sessionStorage. Nenhum snapshot financeiro consultado é persistido. No principal, a opção controla a persistência da sessão de sincronização no armazenamento privado do aplicativo; os dados financeiros offline continuam preservados. Não é a senha que é armazenada. Sair remove as sessões de ambos os locais.

A senha nova e a confirmação de senha da recuperação também possuem o botão de visibilidade.

## E-mail de confirmação e erro 404

O endereço correto é https://rodrigo-yuji.github.io/controlai/ (incluindo a pasta e a barra final).

No Supabase → Authentication → URL Configuration, configure:

- Site URL: `https://rodrigo-yuji.github.io/controlai/`
- Redirect URLs: `https://rodrigo-yuji.github.io/controlai/**`

Novos cadastros e reenvios de confirmação informam esse destino explicitamente. O convidado volta ao mesmo caminho com `?consulta=1`. A tela verifica o usuário no serviço de autenticação antes de mostrar E-mail confirmado com sucesso, retira os tokens do endereço e leva ao login adequado. Não faz login silencioso com os tokens do e-mail.

Um link com `otp_expired` já foi usado ou expirou: isso não significa que uma conta já confirmada deixou de funcionar. Nesse caso, entre com a senha. Se ainda faltar confirmar, use Reenviar confirmação do e-mail na tela de login. Links antigos podem continuar com o destino errado; solicite um novo após corrigir as URLs.

O `404.html` do projeto recupera retornos de autenticação que chegarem a um caminho inexistente dentro do site do projeto. Ele não pode corrigir um site raiz externo que não hospeda o aplicativo; por isso a configuração correta do Supabase é necessária.

O botão Retirar da reserva usa somente texto, assim como Adicionar.
