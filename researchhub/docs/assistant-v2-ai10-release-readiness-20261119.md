# ResearchHub — candidato de integração do assistente V2 + IA-01 a IA-10
Data: 2026-11-19

## Escopo validado
- Base: design/assistant-panel-shell-v2-20261118 (derivada da auditoria IA-01 a IA-10).
- UI: painel V2 separado da página, cabeçalho, conversa com rolagem independente e compositor fixo.
- IA: guard de busca, DeCS opt-in, extração/proveniência, validação conservadora, matriz e revisões human-in-the-loop.
- A primeira execução completa GitHub Actions da branch base foi aprovada: https://github.com/researchhubscholar/researchhubscholar/actions/runs/44411601235
- O usuário aprovou visualmente o V2 no Preview de 2026-11-19.

## Critérios obrigatórios de liberação
1. CI deste candidato: lint, TypeScript, testes IA-01 a IA-10, suite completa, Next.js build e smoke test.
2. Smoke interativo no Preview: abrir/fechar, compacto/expandido, erro/reenvio, teclado e resposta real da IA.
3. Regressão de autenticação/assinatura/checkout em conta paga e não paga.
4. Verificar variáveis reais do ambiente antes de ativar recursos experimentais.
5. Validar integração DeCS com API real e artigos reais; não liberar por depender exclusivamente de mocks.
6. Conferir segurança por projeto, titularidade e salvamento antes de ativar a transferência à seção Meu Projeto.
7. Conferir se a linha de produção mais recente precisa ser incorporada: produção identificada em b9225e7a4f61623c23dce19408a2646868da8e91. Não fazer merge cego de alterações anteriores.

## Limites deliberados
- SCHOLAR_DECS_AUTO_REFINE=false até validação externa.
- SCHOLAR_AI05_STRUCTURED_EXTRACTION=false e SCHOLAR_AI06_DEEP_RESULTS=false até validação funcional.
- IA-07 a IA-10 fornecem prévias e lógica de revisão; não há autorização para gravar evidências no projeto automaticamente.
- Este candidato não altera Supabase, Vercel Production ou branch de produção.
- Os testes automatizados não equivalem a revisão científica dos resultados extraídos.

## Decisão de liberação
PENDENTE: apenas depois dos critérios acima, preparar um merge seletivo contra a branch atual de produção e submeter a publicação a aprovação explícita.
