# Consolidação obrigatória — decisão de 26/10/2026

Novas funcionalidades suspensas até concluir as cinco etapas abaixo. Pagamentos
e monetização ficam fora deste ciclo. Nenhuma etapa está concluída ainda.

1. **Proteger o trabalho — implementação da primeira entrega.** Projeto correto,
   navegação com salvar/continuar/descartar, conflito entre abas e transação do manuscrito.
2. **Gestão dos dados — em implementação (primeira entrega: exportação).** Exportação completa e paginada, migrations
   rastreáveis e execução comprovada da exclusão de conta.
3. **Jornada completa — iniciada em paralelo; validação real pendente.** Ideia até exportação, persistência, contas
   distintas, permissões, desktop e celular.
4. **Consistência visual — iniciada em paralelo; validação real pendente.** Cabeçalhos, seletores, salvamento,
   mensagens, acessibilidade e hierarquia nas telas reais.
5. **Qualidade e acompanhamento — iniciada em paralelo; validação real pendente.** Avaliação humana de IA real,
   métricas dos pontos de falha/abandono e recuperação operacional.

## Etapa 1: instalação e validação necessárias

Aplicar somente `supabase/scholar_safe_saves.sql`, após manuscrito e resultados.
É reexecutável; não remove dados. Atualizar todas as abas após a instalação.
Não executar novamente o instalador histórico. Sem a migration, os novos
salvamentos são bloqueados com explicação, sem fallback inseguro.

RPCs com RLS/proprietário e revisão sob lock impedem sobrescrita de clientes
atualizados com revisão antiga, incluindo criação concorrente de resultados/artigo.
Metadados e seções do manuscrito são gravados na mesma transação. Escritas de
clientes antigos invalidam revisões novas; clientes antigos ainda abertos precisam
ser atualizados, pois não conhecem o controle de conflito nem o novo diálogo.

Em conflito, o rascunho permanece e a tela permite abrir a versão salva em outra
aba para comparar; não troca a revisão nem força sobrescrita automaticamente.
Coleta/resultados não passam a guardar dados brutos no armazenamento local.

Verificar no Preview autenticado:

- ID ausente/inválido/removido/de outra conta: escolher explicitamente, sem abrir
  outro trabalho. Conferir URL, página e assistente.
- Editar e tentar sair por menu, seletor, assistente, logout e voltar/avançar.
  Salvar/continuar/descartar no diálogo; fechar/atualizar usam o aviso nativo.
- Duas abas: salvar A, tentar salvar B; B mantém rascunho e avisa conflito.
- Falha de rede ao salvar e sair mantém o editor. Falha em seção desfaz toda a
  transação, sem metadados parcialmente gravados.
- Repetir em celular e com conta somente leitora.

A etapa 1 só termina após confirmar instalação e os testes autenticados.

## Verificação de código em 27/10/2026

Typecheck, lint, suíte funcional/SQL e build/smoke passaram. Testes específicos
cobrem conflito, criação sem sobrescrita, rollback, propriedade, seleção real nas
páginas, navegação e autosave após descartar. Os testes usam banco de teste e
harnesses de componentes; não equivalem a navegador autenticado no Supabase real.
Instalação da migration e validação autenticada/mobile continuam pendentes.

## Retorno do usuário em 27/10/2026

`scholar_safe_saves.sql` aplicado com sucesso, conforme retorno do usuário.
Validação autenticada da etapa 1 continua em andamento. O usuário autorizou
iniciar a etapa 2 em paralelo enquanto testa a primeira.

Etapa 2, primeira entrega: exportação v2 paginada/em fluxo, dados científicos
antes ausentes, manifesto por seção e indicação de arquivo parcial. Inventário
de migrations com hashes no repositório não equivale a histórico aplicado no
banco. Conferência por ambiente e executor de exclusão continuam pendentes.
Ver `migrations-status.md` e `account-data-operations.md`.

## Etapa 2 — processamento administrativo preparado em 27/10/2026

Nova migration `scholar_account_deletion.sql`: admissões serializadas com pedidos,
comprovantes mínimos, bloqueios institucionais/Storage/operação ativa e guardas
revalidadas na exclusão efetiva. A instalação não remove nenhuma conta.

Operação, papel owner: revisar conta, digitar e-mail atual, executar pelo Auth no
backend e verificar resultado incerto sem repetir a exclusão. Conta acompanha
`processing`; cancelamento vale somente antes da admissão. Há diagnóstico de
estruturas/RLS por ambiente, que não presume histórico de migrations aplicado.

Testes SQL, API e componentes usam dados sintéticos. Nenhuma conta real foi
excluída. Instalação da nova migration, homologação com Auth/Storage reais e
conferência do histórico por ambiente continuam pendentes antes de concluir a etapa 2.

## Etapa 3 — início em 27/10/2026

Teste integrado em banco sintético para ideia, origem, biblioteca/matriz, resultados,
manuscrito e isolamento entre contas. Roteiro reproduzível e critérios de evidência
em `journey-validation.md`. Não houve teste autenticado de ponta a ponta nem em
celular nesta rodada. A etapa 2 continua aberta até instalação e validação pendentes.

## Etapa 4 — início em 27/10/2026

Seletores de projeto padronizados em Resultados, Manuscrito, Documentos e
Orientação, incluindo escolha inicial e largura em celular. A validação visual
autenticada e as demais partes da revisão permanecem pendentes. As etapas 2 e 3
continuam abertas. Detalhes em `design-audit.md`.

Continuidade da etapa 4: estados de carregamento/salvamento mais claros em
Projeto, Resultados e Manuscrito; revisão autenticada e demais telas pendentes.

## Etapa 5 — início em 28/10/2026

Matriz para avaliação humana de IA e roteiro de recuperação; sanitização da
telemetria de interface e cobertura das rotas de Resultados/Manuscrito. Sem
geração real nesta entrega; avaliação humana, dados de campo e monitoramento
de abandono continuam pendentes. Ver `assistant-evaluation.md`.

Etapa 5, implementação complementar: roteiro de avaliação manual disponível em
Operação → Qualidade, com relatório exportável e casos inicialmente não testados.
A execução humana com IA real e a validação em ambiente autenticado permanecem
pendentes; as cinco etapas serão validadas individualmente.

Indicadores de jornada: primeira implementação para tentativas de busca no Radar,
com início e desfecho correlacionados e painel agregado. Instalação de
`scholar_journey_metrics.sql` e validação autenticada permanecem pendentes.
Casos sem resultado registrado não comprovam abandono; outras etapas da jornada
ainda não possuem a mesma instrumentação. Ver `assistant-evaluation.md`.

## Etapa 4 — conceitos visuais em 03/11/2026

Camada de apresentação nas seis áreas autenticadas: Meu espaço, Ideias, Radar,
Biblioteca, Meu projeto e Manuscrito. Paleta creme/verde, menu lateral a partir
de 1280px, superfícies mais leves, hierarquia de títulos e campos, artigos e
projetos separados por linhas. Abaixo desse tamanho, mantém a navegação existente.
Sem alteração de ações, dados, consultas, formulários, salvamento ou permissões;
controles e dados fictícios dos conceitos não foram incorporados. Sem SQL novo.

A prévia local gerenciada não iniciou porque acrescenta opções incompatíveis com
Next.js (`--host`/`--strictPort`). A conferência visual autenticada nas seis telas
e em celular permanece pendente, incluindo estados vazios, formulários abertos,
assistente e edição do manuscrito. Implementação não equivale a validação visual.

## Validação parcial da etapa 1 e correção de trechos — 05/11/2026

Usuário informou que os testes 1 (seleção do projeto correto) e 2 (saída com
edição pendente) funcionaram no Preview. Conflito entre abas, falha de rede,
celular e conta leitora continuam pendentes. A etapa 1 não está encerrada.

Na revisão de trechos, a prévia de substituição passa a ficar junto da resposta
que a gerou, sem deslocar a conversa para o contexto no topo. A rolagem automática
fica limitada ao histórico do assistente. Recomendações de substituição deixam
de ser ocultadas pelo limite visual de duas recomendações e não oferecem a ação
de adicionar ao plano. O assistente aguarda a confirmação do editor antes de
fechar; em caso de texto alterado, mantém a prévia e informa o erro. Substituição
continua limitada ao trecho original, sem salvar automaticamente nem chamar IA
novamente ao revisar/aplicar.

Testes de componentes verificam prévia, confirmação positiva/negativa, ação após
a segunda recomendação, correlação do trecho, duplicidade e bloqueio de edição
obsoleta. Validação autenticada desse ajuste no Preview continua pendente.

### Reteste de trechos — falha relatada e correção complementar, 05/11/2026

Usuário relatou que o botão exibido ainda era “Adicionar ao plano do projeto”,
sem substituir a seleção e com salto para as tarefas no topo. A correção anterior
não resolveu esse caminho: o modelo ainda podia responder com orientações gerais.

Para intent improve, a geração agora usa formato estruturado com uma única
recommendation guide_excerpt. O servidor rejeita respostas científicas sem
substituição válida em vez de tratá-las como revisão aplicável; esclarecimentos
e recusas continuam sem ação. O histórico identifica respostas sobre trechos e
não oferece inclusão no plano, inclusive após recarregar a conversa. O pedido
preparado solicita explicitamente a reescrita. Rolagem de tarefas fica restrita
ao histórico do assistente. Nada é salvo automaticamente.

Testes cobrem o caminho do endpoint com provedor simulado até a resposta de
substituição, a renderização do botão real de revisar, confirmação positiva e
negativa, resposta inválida, histórico recarregado e recusas. Tipos, lint e build
passaram. Ainda falta reteste com IA real e sessão autenticada no Preview; não
registrar esse ajuste como validado pelo usuário antes desse retorno. As demais
etapas ficam em espera enquanto este problema é corrigido e retestado.

### Prioridade autorizada em 05/11/2026 — orientadores por plano

Usuário confirmou substituição de trechos e preços; testes de conflito e falha de
rede do manuscrito e fluxo mobile também receberam confirmação. Antes de retomar
as revisões, autorizou o benefício Plus: 1 orientador/projeto; Premium: 3;
Essencial: sem novos convites. Convidado usa conta gratuita para leitura/comentários.
Escopo e instalação pendente registrados em `advisor-plan-access.md`. Esta pausa
não conclui as etapas da consolidação. Próximo passo: instalar a nova migração e
validar com autor e convidado, depois retomar o checklist de orientação.
