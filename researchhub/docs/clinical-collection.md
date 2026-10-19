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

## Comparação entre grupos

Depois da coleta, a seção **Comparar grupos de participantes** permite selecionar
uma variável categórica da ficha e duas a quatro categorias. A configuração fica
em `workspace.comparison` (opcional, compatível com os resultados anteriores).
Somente participantes incluídos nas categorias selecionadas entram na comparação.
Registros sem grupo e outras categorias são contados separadamente. Cada célula
mostra o N válido e as ausências; percentuais categóricos usam os valores informados
da variável naquele grupo. Códigos numéricos permanecem categorias.

O pesquisador escolhe uma variável por vez para investigação: Welch para variável
numérica em dois grupos, ou qui-quadrado para categórica. Reutiliza o motor existente,
com confirmação de independência e pressupostos, bloqueio de amostras insuficientes
e frequências esperadas pequenas. Não há teste automático em todas as linhas.
A ordem selecionada dos grupos define o sinal da diferença de médias, sem depender
da ordem de entrada dos registros. A comparação não ajusta confundidores, não usa
dados pareados e não substitui revisão estatística. O texto sugerido é determinístico,
baseado nos cálculos, e deve ser revisado pelo pesquisador.

Salvar resultados persiste a configuração junto à coleta. Alterações na base ou no
dicionário removem a análise anterior; alterações que invalidam os grupos removem
a comparação. As tabelas são recalculadas com a base atual. Exportações Word,
Excel e manuscrito incluem a comparação salva; exportações da seção usam o estado
atual. Word e manuscrito contêm agregados, sem códigos individuais. Excel completo
da coleta continua contendo a aba de registros para uso autorizado do pesquisador.

## Acompanhamento por visitas

`workspace.followup` é opcional e versionado (`version: 1`). A ficha inicial e sua
base de análises continuam com uma linha por participante. O acompanhamento
armazena momentos, um dicionário próprio, datas de início por código e visitas
identificadas pelo par participante/momento, sem duplicação. A ativação não
transforma dados existentes nem copia valores para visitas. As definições podem
ser copiadas da ficha inicial e revisadas de forma independente, ou criadas
manualmente para medidas, tratamentos e desfechos.

Nesta etapa são até 12 momentos (dias inteiros distintos de 0 a 36.500 após a data
de início), 20 variáveis por visita e 5.000 registros de visita, dentro do limite
geral de 1,5 MB por projeto. Somente participantes incluídos podem registrar
visitas. Excluir ou retornar um participante à conferência preserva suas visitas,
mas remove-as da agenda, medidas, gráficos e resumos. As tabelas mostram a
situação por momento, com pendências, não realizadas e visitas sem registro.

Visitas realizadas exigem uma data válida e valores compatíveis com a ficha,
incluindo campos obrigatórios. Rascunhos podem preservar valores a corrigir;
possíveis identificadores detectáveis são bloqueados em qualquer situação.
Visitas não realizadas exigem um motivo previsto na interface. Seus valores
anteriores são preservados, mas não entram nos resumos. Uma visita por momento
pode ser editada sem duplicar o registro. Não há remoção de visitas nesta versão.
Momentos com registros e variáveis com dados não podem ser removidos. Revisar a
ficha ou os momentos preserva valores e devolve visitas realizadas à conferência,
com confirmação explícita; não altera o dicionário nem os valores da linha de base.

A agenda é derivada para participantes incluídos e todos os momentos previstos.
Datas são dias de calendário, com cálculo em UTC para evitar deslocamento por
horário de verão. O dia atual da agenda usa America/Sao_Paulo. Prazos sem visita
registrada são comparados ao dia nominal, sem janela de tolerância ou inferência
automática de perda. Sem data de início, a agenda pede o início e não inventa
prazos. A alteração da data de início recalcula prazos sem mover a data real.
Nenhuma notificação externa é enviada.

Perfis e gráficos usam somente visitas realizadas e conferidas de participantes
incluídos. Percentuais usam as respostas informadas em cada momento; ausências
em visitas conferidas são contadas por variável, enquanto visitas sem registro
são contadas no resumo de situação. Zero e categorias numéricas permanecem
válidos. O gráfico mostra um participante selecionado ou médias disponíveis,
com N por ponto e sem preencher ou conectar momentos ausentes. O eixo representa
dias nominais. A composição da amostra pode mudar entre momentos: estes resumos
não são estimativas pareadas de mudança, efeitos de tratamentos ou análises
inferenciais de medidas repetidas. As visitas nunca alimentam o motor de
Welch/Pearson/qui-quadrado como observações independentes.

Salvar resultados persiste todo o plano e suas visitas na estrutura já protegida
do projeto; não exige migração nem serviço externo. A agenda e os dados brutos
são exportados para Excel com códigos e datas para conferência autorizada. Word,
centro de documentos e manuscrito recebem agregados por momento, sem códigos ou
datas individuais. A seção não envia dados de visitas à IA. O histórico recente
da coleta registra ações e códigos, dentro dos limites existentes, sem pretensão
de auditoria imutável.

## Comparação antes e depois de dois momentos

`workspace.paired` guarda somente `fieldKey`, `before`, `after` e a confirmação
humana dos pressupostos (`confirmed`). É opcional e compatível com workspaces
anteriores. A medida vem do dicionário numérico das visitas e o segundo momento
precisa ter dia previsto maior que o primeiro. Os filtros visuais da agenda e os
grupos da comparação independente não restringem este conjunto: a seção usa todos
os participantes incluídos na coleta inicial.

O pareamento usa o código de pesquisa e o momento, nunca a ordem de entrada das
visitas. Cada participante contribui com um par. Somente duas visitas realizadas
e conferidas, com valores presentes para a medida, geram um par completo. Zero é
válido, vazio é ausente. A contagem por motivos é mutuamente exclusiva: primeiro
visitas ausentes/não realizadas/em conferência (ambas, anterior, posterior),
depois medidas vazias em visitas conferidas (ambas, anterior, posterior). As
contagens reconciliam incluídos = pares completos + excluídos. Datas reais
invertidas nos pares completos são contadas à parte e bloqueiam a inferência;
os dados ficam visíveis para correção nas visitas.

A tabela descritiva usa exatamente os mesmos pares para antes, depois e mudança
individual (`depois - antes`). O teste t pareado bilateral testa mudança média
zero, com erro-padrão DP das diferenças / raiz(N), N - 1 graus de liberdade e
IC95% pela distribuição t. Requer confirmação de pareamento, mesma escala,
independência entre participantes e normalidade aproximada das diferenças,
especialmente em amostras pequenas. Não há verificação automática de normalidade.
A interface permite conferir diferenças por participante para revisar escala e
valores extremos. Nesta versão o mínimo operacional é três pares completos,
sem afirmar que três garantem adequação estatística. Diferenças constantes,
quase constantes, valores fora da precisão ou resultados não finitos bloqueiam
o teste e o intervalo; os resumos disponíveis permanecem para conferência.

Não há imputação, teste em todas as variáveis, ajuste por confundidores ou por
comparações múltiplas. A análise por pares completos pode ser enviesada por
perdas. A direção da mudança não é rotulada como melhora, e a redação sugerida
não atribui causalidade ou efeito do tratamento. Métodos categóricos, não
paramétricos ou para mais de dois momentos não foram adicionados.

Editar visitas, plano ou data de início remove a confirmação; alterar a base
inicial ou as identidades/situações dos participantes também exige reconferência.
Remover ou mudar para categórica a medida selecionada, ou invalidar os momentos,
remove a configuração pareada. Os resultados são recalculados da base atual,
não guardados como estimativas independentes. Salvar resultados persiste a
configuração com a coleta protegida pelo proprietário. Word, Excel, centro de
documentos e manuscrito incluem contagens, resumos, teste confirmado quando
válido e texto para revisão; as exportações da seção pareada são agregadas, sem
códigos ou datas individuais. A lista de diferenças por código fica somente na
interface, e os registros originais continuam nas exportações da coleta/visitas.

Referências de implementação e verificação:
- SciPy `stats.ttest_rel(after, before)` e `confidence_interval(0.95)`:
  https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_rel.html
- NIST, análise de observações pareadas:
  https://www.itl.nist.gov/div898/handbook/prc/section3/prc311.htm
- Seis casos de referência em `tests/paired-reference.json`, gerados com SciPy
  1.17.0 e conferidos contra o motor jStat existente, incluindo sinais, zeros,
  ausência de mudança média, escalas decimais e diferentes tamanhos de amostra.
