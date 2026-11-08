# ControlAI 1.39

- Abertura centralizada com logo animada, sem tempo mínimo de espera. Funciona desde o HTML inicial e durante a preparação do espaço e banco local. Respeita movimento reduzido.
- Aviso de novas solicitações ao titular em qualquer aba, com acesso direto à conta correspondente. Atualiza a cada 30 segundos enquanto visível e ao retornar ao aplicativo.
- Notificação local no Android e no navegador quando já autorizada. A permissão pode ser solicitada pelo botão do aviso. Não adiciona push com o aplicativo fechado.
- Evita avisos repetidos por conta e login, sem armazenar novos registros no Supabase.

Validação: testes de solicitações não vistas e de listas extensas; navegador em celular e computador com captura da abertura, movimento reduzido, aviso fora do início, deduplicação e regressões de solicitações. Build e lint passaram. Nenhuma atualização SQL necessária.
