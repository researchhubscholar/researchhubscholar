# Consolidação obrigatória — decisão de 26/10/2026

Novas funcionalidades suspensas até concluir as cinco etapas abaixo. Pagamentos
e monetização ficam fora deste ciclo. Nenhuma etapa está concluída ainda.

1. **Proteger o trabalho — implementação da primeira entrega.** Projeto correto,
   navegação com salvar/continuar/descartar, conflito entre abas e transação do manuscrito.
2. **Gestão dos dados — em implementação (primeira entrega: exportação).** Exportação completa e paginada, migrations
   rastreáveis e execução comprovada da exclusão de conta.
3. **Jornada completa — iniciada em paralelo; validação real pendente.** Ideia até exportação, persistência, contas
   distintas, permissões, desktop e celular.
4. **Consistência visual — pendente.** Cabeçalhos, seletores, salvamento,
   mensagens, acessibilidade e hierarquia nas telas reais.
5. **Qualidade e acompanhamento — pendente.** Avaliação humana de IA real,
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
