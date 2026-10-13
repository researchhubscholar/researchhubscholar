# IA atual — ResearchHub Scholar

Todas as operações de IA usam exclusivamente gemini-3.8-flash pelo Google AI SDK.
O código ignora overrides antigos SCHOLAR_AI_MODEL e não troca para outro modelo.
Geração, refinamento e assistentes exibem o mesmo dialog acessível com tempo de
espera, texto contextual e fechamento automático no sucesso ou na falha. Não é uma conexão
com a assinatura ChatGPT do usuário nem, atualmente, com o AI Gateway.

## Fluxos existentes

- Ideias: três propostas científicas, geração automática e refinamento com PubMed.
- Radar: estratégia de busca revisável.
- Protocolo: sugestões por campo, aplicadas pelo usuário.
- Biblioteca: apoio de leitura e comparação na matriz a partir do material disponível.
- Orientação: preparação de reunião com o contexto fornecido.
- Manuscrito: assistência por seção, comparação e snapshot antes da aplicação.

Acesso depende de sessão autenticada, licença válida e carteira do próprio usuário.
A escolha em Minha licença é respeitada. Não há troca silenciosa de carteira
quando a selecionada perde saldo. Com várias carteiras, a escolha é obrigatória.
Sem escolha e com apenas uma carteira elegível, essa carteira pode ser usada.

## Consumo e orçamento

Reserva de até 10.000 tokens por operação, orçamento de saída, registro de uso
informado pelo provedor, devolução de franquia em falhas e versões de prompts.
O registro atual de tokens/custos de geração concluída cobre a resposta final;
tentativas anteriores que falham podem ser cobradas pelo provedor sem aparecer
integralmente no ledger. A fatura do provedor continua sendo a fonte financeira.

Migration incremental: supabase/scholar_ai_budgets.sql. É repetível e não apaga
material. Cria envelopes diários em USD globais e por licença, com lock global
na admissão de operações. Falhas continuam consumindo envelope diário; retries
com o mesmo ID não duplicam a admissão. Simulações não usam orçamento financeiro.

Os limites começam DESATIVADOS para preservar os testes existentes no Preview.
Valores iniciais de configuração, não estimativas de preço do modelo:
US$2/dia global, US$1/dia por licença e US$0,25 de envelope por operação.

Antes de ativar, configurar SCHOLAR_AI_INPUT_USD_PER_TOKEN e
SCHOLAR_AI_OUTPUT_USD_PER_TOKEN na Vercel. Usar tarifas conservadoras cobrindo o
modelo mais caro entre principal e alternativas, inclusive tokens de raciocínio.
O guard exige valores positivos e envelope suficiente para quatro tentativas de
até 10.000 tokens. Depois, pelo SQL Editor:

```sql
update public.scholar_ai_budget_settings set enabled=true where id=true;
```

Produção exige migration, orçamento ativo e tarifas configuradas. Preview permite
continuar o piloto com controle financeiro desligado. Esses envelopes são controle
de admissão estimado, não garantia de teto exato da fatura do provedor.

## Validação pendente

- Confirmar tarifas reais e consumo de alternativas/falhas antes da venda.
- Validar navegador autenticado e celular com contas individuais e institucionais.
- Comparar qualidade em casos científicos reais; feedback existe em Ideias e Minha licença.
- Validar checkout, renovação e e-mails após configuração da Stripe brasileira.
