# ControlAI 1.38

- O excesso do orçamento semanal reduz a semana seguinte e continua nas próximas até ser absorvido. A interface do titular e do convidado mostra o excesso anterior. Sobras não são transferidas; cada ciclo salarial começa com seu próprio orçamento.
- Participantes identificados pelo titular podem solicitar reembolso de compras anteriores ao início das contribuições. A data original é preservada, sem criar contribuições retroativas; aprovação e confirmação do reembolso permanecem separadas.
- A correção administrativa está em `supabase/solicitacoes-retroativas.sql` (já executada pelo titular). Mantém acesso por conta, identidade definida pelo titular e verificações de aprovação.

Validação: 183 testes passaram, incluindo repasse entre semanas, compra de 25/10 por participante com início em novembro e proteção contra identificação forjada. Build e lint passaram.
