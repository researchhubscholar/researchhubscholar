# ResearchHub — Auditoria visual geral (19/11/2026)

## Referência aprovada
A identidade de produto utiliza navegação lateral para áreas autenticadas,
verde-escuro, creme, tipografia editorial, formulários claros, bordas discretas
e espaçamento consistente. O assistente V2 aprovado permanece intacto.

## Achado crítico da captura
A rota `/contratacao` renderizava navegação pública horizontal mesmo estando
dentro da jornada autenticada. O arquivo `components/session-navigation.tsx`
não incluía a rota na lista de `isWorkspace`. Consequentemente, as regras
de layout de `concept-workspace.css` não eram aplicadas.

## Auditoria estática das rotas
- Módulos centrais: `/dashboard`, `/ideias`, `/descobrir`, `/biblioteca`,
  `/meu-trabalho`, `/orientacao`: já têm wrapper `scholar-workspace` e
  classificação na navegação.
- Trabalho científico: `/documentos`, `/resultados`, `/manuscrito`,
  `/scholar/onboarding`: seguem o mesmo shell interno.
- Conta e apoio: `/conta`, `/licenca`, `/residencia`, `/operacao`:
  seguem o mesmo shell interno.
- Contratação: corrigida para shell interno quando autenticado, com item
  `Assinatura` destacado. Visitantes não autenticados preservam layout público.
- Páginas comerciais públicas (`/planos`, `/como-funciona`, `/login`,
  `/cadastro`) mantêm apresentação pública intencionalmente; não devem
  receber a barra lateral sem autenticação.

## Alterações executadas
1. Classificação da rota de contratação em navegação autenticada.
2. Resumo de preço, seletor de plano e formulário de pagamento passam
   a seguir uma composição de superfícies claras com contraste controlado.
3. Layout de compra se adapta à largura disponível quando há barra lateral.
4. Teste automatizado cobre classificação de rotas, pagamento, contraste,
   acessibilidade básica e modo anônimo.

## Pendências de homologação visual — não concluídas por teste estático
- Capturas de desktop (1440, 1280, 1024 px) e mobile (390 px).
- Conferência de estados: carregando, cupom válido/inválido, erro de API,
  pagamento institucional, recarga, conta sem licença e assinatura ativa.
- Contraste e navegação por teclado em todas as telas secundárias.
- Comparação visual real com Dashboard, Biblioteca e Meu Projeto.
- Revisão específica do fluxo de contratação com formulário completo.
- Testes sem pagamentos reais; não mudar preços, cotas ou webhook.

## Critérios de publicação
Não fundir a branch sem aprovação de CI e inspeção visual do Preview.
Não modificar dados de compra, licenças, Asaas nem a produção nesta etapa.
