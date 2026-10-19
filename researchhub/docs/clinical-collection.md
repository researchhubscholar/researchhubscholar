# Estudos com dados próprios — primeira etapa

Entrada: Meu projeto → Coleta e perfil dos participantes. O fluxo fica em
`/resultados?projeto=<id>#coleta` e compartilha a gravação de Resultados e Figuras.

A ficha carrega população e critérios do protocolo salvo. A assistência `collection`
usa a franquia já existente (`protocol` no ledger) para sugerir definições de variáveis.
O servidor limita esse contexto ao protocolo e ao dicionário; linhas, códigos e arquivos
importados não são contexto da IA. O preenchimento manual também está disponível.

## Fluxo e persistência

1. Definir período, população, inclusão, variáveis, tipos, categorias e regras.
2. Concluir a revisão da ficha; cadastrar participantes ou relacionar as colunas de um CSV.
3. Importações entram pendentes. A inclusão depende da conferência pelo pesquisador.
4. Somente registros incluídos alimentam `workspace.dataset`; códigos não são variáveis estatísticas.
5. Salvar resultados grava ficha, coleta, últimas 100 ações e base incluída na mesma operação.
6. A Tabela 1 acompanha o Word dos resultados, do manuscrito e da central de documentos.

`workspace.collection` é opcional e versionado (`version: 1`). A validação da API verifica
sua estrutura, duplicidades e consistência com a base incluída. O armazenamento e RLS
existentes em `scholar_project_results` continuam em uso; não é necessária migração SQL.
Resultados antigos, sem coleta, continuam compatíveis.

Alterar a ficha após o início exige reabrir sua revisão. Os incluídos voltam a pendentes;
a base e as análises são atualizadas para evitar misturar definições antigas e novas.
Registros excluídos são preservados com motivo. O histórico recente é editável junto
do workspace e não é uma trilha de auditoria imutável.

## Tipos e ausência

- Categorias numéricas permanecem categóricas na Tabela 1 e nas análises guiadas.
- Vazios e os marcadores de importação NA, N/A, “não informado” e “não registrado” são ausentes.
- Zero, “Não” e “Não se aplica” não são convertidos em ausência.
- Percentuais categóricos usam o N informado de cada variável. Ausentes são apresentados à parte.
- Datas exigem AAAA-MM-DD; regras numéricas vêm do pesquisador, sem pontos de corte clínicos automáticos.
- Limites: até 1.000 participantes, 40 variáveis e 1,5 MB em UTF-8 por projeto, prevalecendo o primeiro atingido.
- A unidade desta etapa é uma pessoa por código, com uma observação por participante.

## Privacidade e escopo

A entrada é estruturada e usa códigos de pesquisa. Colunas comuns de identificação,
e-mails, CPF formatado e telefones com DDD recebem bloqueios. Essa detecção é limitada,
não substitui a desidentificação na instituição e não garante anonimização.
Não há leitura de PDFs de prontuários, integração hospitalar, extração automática de
pacientes, medidas repetidas ou novos modelos de regressão nesta etapa.

Verificação: `tests/clinical-collection.cjs` cobre seleção, tipagem, ausências, privacidade,
validação, persistência privada e exportações. `tests/clinical-flow.cjs` executa os handlers
reais dos componentes, incluindo importação, revisão, exclusão, gravação, reabertura e erros.
