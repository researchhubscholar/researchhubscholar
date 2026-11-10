# Auditoria de design — 13/10/2026

Escopo: revisão da organização do código/interface e capturas anteriores.
Não substitui inspeção visual autenticada em desktop, tablet e celular.

## Radar — ajuste implementado

Problema: ações complementares e gráficos apareciam antes da lista de artigos,
aumentando a distância entre a busca e o resultado e a competição entre botões.

- CTA principal: Pesquisar artigos.
- Assistência de IA em seção opcional recolhida.
- Buscas salvas, histórico e alertas em uma seção expansível.
- Importação por DOI/PMID/link em seção expansível.
- Volume, tendências e cobertura passam para depois dos artigos e ficam recolhidos.
- Filtros, revisão de conceitos, avisos, destino dos artigos, paginação,
  fontes, exportação e acesso aos resultados continuam disponíveis.

## Próximas prioridades

- Biblioteca: distinguir organização, leitura e matriz; reduzir ações simultâneas
  em cada artigo; manter salvar notas sempre perto do editor e das pendências.
- Ideias: separar gerar, comparar e salvar; agrupar ações secundárias das propostas
  e manter uma ação principal por estado da jornada.
- Meu projeto: separar edição do protocolo, jornada e documentos; contextualizar
  ações da IA junto ao campo/seção; reduzir competição no painel de ações.
- Manuscrito: dar predominância ao texto; fontes e assistência como ferramentas
  complementares; manter visível o estado de salvamento e versão.
- Orientação: explicitar seleção de projeto e papel do usuário antes dos controles.
- Sistema: padronizar significado de cores dos botões, tamanhos, espaçamento,
  mensagens vazias, carregamento, erros e confirmação de salvamento.

## Verificação pendente

Testar navegação por teclado dos elementos details, aplicação da busca de IA,
retomada de histórico/alertas, importação por identificador, leitura dos gráficos,
scroll e larguras em desktop e celular com sessão autenticada.

## Revisão de composição — 15/10/2026

- Retorno global corrigido em todos os módulos internos e subrotas: Meu espaço
  (`/dashboard`), sem enviar para a landing. Sem retorno redundante no dashboard.
  Páginas públicas e de autenticação mantêm retorno à homepage.
- Títulos científicos preservam palavras inteiras e quebram apenas quando uma
  palavra isolada excede a largura. Textos de tabelas aceitam quebra de termos longos.
- Fieldsets deixam de impor largura mínima pelo conteúdo; tabelas mantêm sua
  própria rolagem horizontal.
- Campos de Conta, figuras e análises alinham os controles na base da linha,
  mesmo quando os rótulos ocupam duas linhas.
- Seletor de projeto do manuscrito ocupa largura disponível em celular.
- Botões com padding horizontal compartilham alinhamento vertical do texto.
- Mensagem de transferência Projeto → Radar agora descreve o tema recebido,
  sem afirmar que população/desfecho foram transferidos quando só há tema.

Validação: contrato de navegação inclui módulos internos, subrotas e URLs com
barra final; typecheck, lint, testes de acesso e resultados, build e smoke de rotas.
O Preview exige autenticação da Vercel no navegador disponível: inspeção visual
privada, com projetos reais e em diferentes tamanhos de tela, continua pendente.
Não houve alteração dos dados científicos nem do provedor de IA neste bloco.

## Revisão de hierarquia visual — outubro de 2026

Camada de composição em `app/workspace.css`, restrita às áreas de trabalho: títulos sobre fundo simples, sem círculos/faixas decorativas, sombras secundárias reduzidas, métricas sem sobreposição e superfícies de edição com separadores em vez de caixas aninhadas.

Ideias usa três modos compactos com estado pressionado e descrição apenas do modo escolhido. Meu Projeto mantém o seletor visível, com tarefas e revisão de IA recolhidas em disclosures. Esses conteúdos permanecem montados para preservar rascunhos, prévias e resultados ao recolher. Assistente dá prioridade à conversa; ajuda/atalhos e guias de Resultados ficam em disclosures, com recomendações separadas por linhas em vez de novas caixas.

Verificação: typecheck, lint, suíte funcional e build/smoke. O acesso visual ao Preview nesta sessão encontrou a autenticação da Vercel; a revisão visual com conta conectada continua necessária, inclusive em celular. Nenhuma mudança de permissão, dado, preço, franquia ou algoritmo de pesquisa/análise faz parte desta revisão.

## Etapa 4 — início: contexto do projeto

Seletores de Resultados, Manuscrito, Documentos e Orientação usam a mesma
composição: rótulo “Projeto em uso”, campo legível e ação explícita para abrir.
A escolha inicial usa o mesmo padrão. Superfícies redundantes foram removidas;
em telas estreitas campo e botão ocupam a largura disponível. Formulários GET,
seleção explícita e proteção de alterações não salvas foram preservados.

Esta é uma primeira entrega da etapa, não uma auditoria visual autenticada. Ainda
é preciso conferir estados reais, teclado e responsividade em desktop e celular,
e revisar os demais cabeçalhos, mensagens e estados de salvamento.

## Etapa 4 — clareza do estado de salvamento

Resultados deixa de indicar carregamento contínuo quando houve falha ao abrir os
dados; edição continua bloqueada e a mensagem mantém o motivo. Projeto já aberto
passa a ser identificado como projeto carregado, em vez de novo rascunho. No
Manuscrito, a mensagem de estado é anunciada a tecnologias assistivas e o texto
explica que o salvamento automático precisa ser conferido, sem prometer sucesso.
A avaliação visual autenticada permanece pendente.

## Auditoria de composição — 03/11/2026

Escopo: leitura das páginas e componentes ativos, das regras globais, da camada
workspace e da camada dos conceitos; captura enviada pelo usuário na Biblioteca.
Esta é uma auditoria estática de composição, não uma inspeção autenticada completa
no navegador. A prévia local gerenciada falhou anteriormente porque injeta opções
`--host`/`--strictPort` incompatíveis com Next.js. Não foi usado acesso alternativo.

| Área | Evidência e ação | Estado |
| --- | --- | --- |
| Biblioteca / indicadores | Pseudoelemento absoluto de 3px do layout antigo sobrepunha os valores com padding zero; removido. Margens dos textos, alinhamento pela linha de base e números tabulares definidos. | Corrigido no CSS; conferir na conta |
| Biblioteca / filtros e seleção | Campos principais em duas colunas, adicionais recolhidos; lista e artigo com largura mínima zero. Rascunhos de notas no pai e organização dos artigos montada ao alternar a seleção. | Revisado no código; validar estados reais |
| Biblioteca / textos longos | Títulos, metadados e links podem quebrar sem aumentar a coluna. Lista fixa tem deslocamento compatível com cabeçalho horizontal entre 1100–1279px. | Corrigido; conferir 1100/1279/1280px |
| Meu espaço | Margem negativa das métricas já neutralizada na camada workspace; linhas decorativas desativadas, prioridades e projetos mantidos. | Revisado no código |
| Ideias / Radar | Formulários e disclosures preservados; faixas antigas das métricas do Radar removidas e placeholder mais legível. | Corrigido no CSS |
| Meu projeto | Conteúdo e ações já têm min-width zero, quebra e botões flexíveis; seletores e etapas preservados. | Revisado no código |
| Manuscrito | Três colunas mantidas no desktop; painéis aderentes agora usam top 1.5rem com menu lateral, sem espaço reservado ao antigo cabeçalho. | Corrigido no CSS |
| Orientação / Conta / Operação | Marcador de visual cobre áreas e subrotas; cabeçalhos, formulários e tabelas seguem camada verde/creme. | Revisado no código |
| Resultados / Documentos / Residência / diagnóstico / gerações / licença | Rotas ainda ausentes do marcador visual; incluídas para evitar retorno ao cabeçalho antigo durante a jornada. Nenhuma alteração comercial. | Corrigido no marcador |
| Assistente | Janela usa limites de viewport e safe area; controles de ampliar/fechar e estados mantidos. Botão flutuante pode cobrir conteúdo transitório, exigindo conferência real. | Validar em desktop/celular |
| Páginas públicas | Camada dos conceitos depende de sessão e rota interna; landing continua pública e independente. | Preservado |

Conferência visual pendente: 390px, 768px, 1100px, 1280px e 1440px; estados
vazio, carregando, erro, listas extensas, títulos/DOIs longos, formulário em edição,
seleção de artigo, filtros abertos, matriz, assistente aberto/ampliado, teclado e
zoom 200%. Não marcar a etapa 4 como validada antes dessa conferência.
