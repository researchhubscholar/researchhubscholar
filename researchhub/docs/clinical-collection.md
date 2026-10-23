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

## Análise global de três ou mais momentos

`workspace.repeated` é uma configuração opcional com `fieldKey`, `moments` e
`confirmed`. Requer uma medida numérica do dicionário de visitas e de 3 a 12
momentos únicos, ordenados pelo dia nominal. A interface permite escolher um
subconjunto e aplica a ordem temporal antes de salvar. Alterações em rascunho só
substituem a análise depois de Aplicar seleção. Resultados existentes continuam
compatíveis sem esta configuração. Não requer migração, API de IA ou dependência
estatística nova; usa o jStat 1.9.6 já incluído no repositório.

O vínculo é pelo par código/momento. Apenas participantes incluídos com visitas
realizadas e conferidas e valores presentes em todos os momentos selecionados
compõem a matriz completa. Visitas de momentos não selecionados não interferem.
A mesma matriz de participantes alimenta todas as médias e a ANOVA, evitando
comparar médias de amostras diferentes. Zero é válido, vazio é ausente, e não há
imputação. As exclusões são contadas sem sobreposição: primeiro participantes
com pelo menos uma visita não conferida/ausente/não realizada; depois medidas
vazias entre aqueles com todas as visitas conferidas. Há também uma tabela de
ausências por momento, cujas contagens podem se sobrepor e não devem ser somadas
para calcular exclusões. Datas reais decrescentes na sequência nominal bloqueiam
a inferência; valores e códigos permanecem acessíveis para revisão na interface.

O método implementado é ANOVA de medidas repetidas de um fator (momento), com
correção de Greenhouse–Geisser aplicada sempre. O teste global avalia igualdade
das médias dos momentos; não identifica quais pares diferem, não estima uma
inclinação por dia e não usa os intervalos reais entre consultas como preditor.
Não há seleção automática de método, pós-testes, Mauchly automático, método não
paramétrico, comparação entre grupos, modelo misto ou ajuste por covariáveis.
O pesquisador confirma mesma escala, vínculo das medidas, independência entre
participantes, adequação da normalidade dos contrastes/resíduos e valores extremos.
A correção de esfericidade não resolve não normalidade nem multiplicidade.

O cálculo remove deslocamentos individuais por centragem dentro do participante
e escala os contrastes para evitar overflow. Separa somas de quadrados de momento
e erro; F usa GL originais k-1 e (N-1)(k-1). O epsilon GG vem da matriz de
covariância centrada, equivalente à matriz de contrastes ortonormais: quadrado do
traço / ((k-1) × soma dos quadrados dos elementos). Os GL são multiplicados pelo
epsilon e o p global corrigido vem da cauda F, calculada pela beta incompleta
regularizada para evitar subtração próxima de 1. São exportados F, epsilon, GL
originais/corrigidos, p corrigido e eta-quadrado parcial (sem IC nesta versão).

O limite operacional exige N completo > k momentos; não é uma afirmação de poder
ou adequação estatística. Falta de variação dentro de participantes, variabilidade
residual nula ou próxima demais de zero, resultados não finitos, epsilon fora dos
limites teóricos além da tolerância numérica e datas invertidas bloqueiam o teste.
Sem confirmação dos pressupostos, apenas contagens e resumos são apresentados.
Casos completos podem ter viés por perdas; o texto não atribui causalidade ou
melhora clínica e não faz interpretação automática de significância.

Alterações no plano, nas visitas, na data de início, na base inicial ou nas
identidades/situações dos participantes exigem nova confirmação. Configurações
incompatíveis com a medida ou os momentos revisados são removidas. As estimativas
são sempre recalculadas da base atual. Salvar resultados persiste a seleção na
estrutura privada já existente. Word, Excel, manuscrito e centro de documentos
recebem agregados, contagens, análise válida confirmada e redação para revisão.
A listagem individual fica na interface, sem códigos nas exportações da seção.

Verificação numérica independente em `tests/repeated-reference.json`:
- F e eta parcial: comparação de modelos por mínimos quadrados NumPy com fatores
  participante e momento, em vez da decomposição por centragem usada no JS.
- Epsilon: autovalores da covariância de contrastes ortonormais Helmert
  (`scipy.linalg.helmert`), em vez do traço da covariância centrada usado no JS.
- p corrigido: `scipy.stats.f.sf`, com SciPy 1.17.0.
- Sete casos: 3 a 12 momentos, amostra mínima operacional, efeito temporal nulo,
  heterogeneidade de variâncias, escalas diferentes e exemplo publicado com
  epsilon arredondado 0,56.

Referências primárias de método e exemplo:
https://pingouin-stats.org/generated/pingouin.rm_anova.html
https://pingouin-stats.org/generated/pingouin.epsilon.html


## Análise ajustada da coleta inicial

Regressão linear com desfecho numérico e até três covariáveis numéricas ou
categóricas (2–4 níveis com referência explícita), sem seleção automática.
Usa apenas participantes incluídos e casos completos da coleta inicial; não
mistura visitas como observações independentes. Mostra perdas por variável.

O ajuste usa QR com reortogonalização, centragem e escala internas, retornando
coeficientes nas unidades originais. Erros padrão clássicos, IC95% e p bilateral
t de Student só são apresentados após confirmação dos pressupostos. Exige
N >= max(20, 5p), limite operacional que não garante poder ou adequação. Bloqueia
colinearidade, níveis ausentes, variância residual nula e perda de precisão.

Gráfico de resíduos e diagnósticos individuais (alavancagem e distância de Cook)
permitem revisão, sem exclusão automática. Alterações na base exigem nova
confirmação; configurações incompatíveis são removidas. Salvar resultados
persiste o modelo no workspace privado existente, sem migração. Word, Excel,
manuscrito e centro de documentos recebem somente agregados desta análise.

Não inclui regressão logística, modelos longitudinais, erros robustos, imputação,
interações ou interpretação causal. Cinco referências independentes NumPy
(pseudoinversa SVD) e SciPy 1.17.0 verificam coeficientes, erros, IC, p, ajuste
e influência em tests/clinical-adjusted.cjs e tests/adjusted-reference.json.

Referências de método:
https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.OLS.fit.html
https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.RegressionResults.conf_int.html


## Jornada guiada de Resultados

Quatro etapas locais à página: preparar ficha ou escolher CSV avulso; adicionar
e conferir dados (ficha inicial ou visitas); escolher a pergunta; revisar
tabelas, gráficos, fluxo e exportações. O usuário pode voltar livremente.
A escolha de pergunta apenas controla a apresentação: não muda nem remove
configurações, dados ou confirmações estatísticas já existentes. Somente
o painel correspondente aparece, com explicação das dependências ausentes.

Painéis continuam montados com wrappers hidden, preservando rascunhos ao
trocar de etapa ou pergunta. A ficha recebe uma visualização prepare, records
ou profile; o padrão all mantém usos independentes compatíveis. Projetos
salvos com CSV avulso retomam esse caminho ao carregar. Navegação move foco
para o título da etapa; etapa atual e escolhas possuem atributos acessíveis.

Salvar resultados permanece explícito, com barra visível em todas as etapas
e aviso de alterações locais. Não há autosave nem migração do workspace.
Os testes de clinical-flow.cjs verificam visibilidade por ancestral hidden,
rotas de CSV e coleta, pré-requisitos de visitas, seleção exclusiva da análise,
preservação de rascunhos e ausência de gravações ao navegar. A revisão de
pressupostos, cálculos e formatos de exportação permanece a mesma.


## Leitura guiada e revisão estatística

ResultReading apresenta resumo determinístico, contagens, estimativa e incerteza
antes das tabelas técnicas. Inclui explicações de IC95%, p, estimativa e casos
completos, sem rótulos automáticos por limiar de p ou conclusão causal/clínica.
Antes/depois mantém o sentido depois menos antes; Welch explicita a ordem dos
grupos; ANOVA permanece global; ajuste descreve coeficientes nas unidades originais
e usa referências já escolhidas. O intercepto permanece na tabela técnica.

ReviewGuide apresenta conferências práticas por método e ajuda para revisão com
orientador, sem marcar confirmações ou alegar verificação automática dos
pressupostos. Tabelas de perdas, método e limitações ficam disponíveis em detalhes.
Avisos de bloqueio, cronologia e influência continuam visíveis.

A quarta etapa recalcula as análises preparadas a partir do workspace atual,
usando os mesmos testes e gates de confirmação. Modelos inválidos ou não
confirmados aparecem como pendentes, sem resumos inferenciais. Nenhum cálculo,
configuração persistida, exportação ou envio à IA é alterado por esta camada.

Validação em tests/result-reading.cjs: direção e zero, ordem dos grupos, perdas,
p muito pequeno, IC indisponível, ausência de causalidade/veredito por limiar,
revisão de modelo atual/pendente/inválido, ausência de códigos e mutações e
renderização dos componentes reais de glossário e ajuda.
Referência de interpretação:
https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf

## Assistente do projeto · primeira entrega

Painel lateral em Resultados, acessível em todas as quatro etapas. Conversa
contextual sem aplicação automática de sugestões. O estado de trabalho usa
somente contagens, nomes/tipos dos campos e situações das análises; códigos,
linhas da planilha, valores individuais e fichas de visitas não são enviados.
Mensagens livres têm limite de 1.200 caracteres e bloqueio de formatos comuns
de identificadores; isso não equivale a anonimização de texto livre.

POST /api/ai/assist com feature guide reutiliza modelo, franquia, limite diário,
reserva atômica, proteção financeira, timeout e liquidação já existentes.
Antes de reservar consumo, o servidor verifica owner_id do projeto, carrega
protocolo/resultados salvos e recompõe o histórico privado. O histórico recebido
no corpo do cliente é descartado. O rascunho é validado por lista de campos,
identificado como não verificado e apresentado separado dos dados salvos.
Somente um resumo de até 12 campos e três turnos anteriores entra no prompt.
Não há interpretação de resultados numéricos pelo modelo nesta entrega.

Histórico usa scholar_generation_artifacts + scholar_usage existentes, sem
migração. Ledger feature protocol, prompt guide.v1 e input_snapshot.feature guide
identificam as conversas. GET /api/ai/guide exige autenticação e propriedade do
projeto, filtra também usuário/projeto/status completed no join e retorna as
últimas 20 respostas em ordem temporal, com Cache-Control private, no-store.
Falhas permanecem no registro de uso, sem aparecer como respostas concluídas.
Exportação da conta e exclusão em cascata já abrangem os mesmos registros.

Fechar/reabrir preserva o rascunho na página. Carregamento de histórico não
chama a IA. Sem histórico disponível, envio fica bloqueado; falha no envio
preserva a pergunta e permite recarregar o histórico antes de repetir. Não há
retry automático de chamadas pagas. Cada troca de projeto monta outro painel.
Simulação é rotulada e não gera resposta científica. As conversas são gravadas
por solicitação concluída, independentemente de Salvar resultados; dados e
configurações de análise continuam com salvamento explícito.

Tests/project-guide.cjs cobre metadados sem dados individuais, descarte de
histórico forjado, autenticação/propriedade antes do consumo, filtros privados,
GET/POST reais com banco/provedor simulados, histórico concluído, modo de
simulação, falha/liquidação e handlers reais da UI para carga, envio duplicado e
preservação da pergunta. Verificação ao vivo na conta autenticada permanece
parte da avaliação do Preview.

### Janela flutuante do assistente

Botão fixo no canto inferior direito alterna abertura/fechamento e mantém o
rascunho local. Painel e botão usam portal no body, evitando estilos e contextos
de empilhamento dos cards de Resultados. Cabeçalho e envio compactos deixam a
conversa em uma área com rolagem independente; dimensões usam o viewport dinâmico
e safe areas, com ajustes para celular e telas baixas. Ao receber uma resposta,
o início da última troca é mostrado para não cortar o começo da orientação.
Escape e o botão Fechar devolvem foco ao botão flutuante. O teste do componente
verifica o portal, a alternância e a preservação do rascunho sem novos envios.

### Próxima tarefa e atalhos no assistente

A janela apresenta a próxima tarefa sugerida a partir do estado atual da coleta
e dos resultados. Outros atalhos ficam recolhidos para reduzir a carga visual.
Os destinos são fixos: ficha, participantes, CSV, visitas, análise e resultados.
A disponibilidade é verificada novamente pelo editor no clique. Navegar fecha
a janela, preserva a pergunta e os painéis montados; não altera o workspace,
salva, confirma testes nem chama o provedor. Os atalhos funcionam sem envio de IA.

### Preparação da ficha com sugestões selecionáveis

Na etapa Preparar a coleta, a revisão da ficha recebe uma descrição opcional do
estudo (até 2.000 caracteres), junto do protocolo e das definições existentes.
O contexto exclui registros e códigos de participantes. A IA pode propor tipos
de variável e critérios de inclusão/exclusão, com justificativas, sem inventar
categorias ou pontos de corte. Cada envio usa a franquia atual.

As sugestões começam desmarcadas. Selecionar e revisar não altera a ficha;
somente Confirmar e adicionar aplica o lote. Campos existentes são preservados,
critérios são acrescentados e duplicações são ignoradas. Se algum item for
inválido ou ultrapassar limites, todo o lote é recusado sem alteração parcial.
A revisão da ficha permanece aberta para completar categorias/unidades.
Salvar resultados continua sendo necessário para persistir na conta.

### Ajuda prática em três frentes

O assistente flutuante reúne conferência da coleta, caminhos de análise e texto
dos resultados em seções recolhidas. A conferência local conta pendências,
problemas de ficha/registros ativos e ausências entre incluídos, sem exibir
códigos ou modificar registros. Ausência não gera exclusão automática.

Os caminhos de análise indicam requisitos de estrutura (tipos e momentos),
sem declarar elegibilidade estatística; o botão abre a pergunta e a configuração
existente, que continua exigindo revisão e confirmação dos pressupostos.

O rascunho é derivado das leituras protegidas das análises confirmadas e válidas
na base atual. Análises pendentes ficam fora; texto pode ser editado e copiado,
sem inserir automaticamente no manuscrito. Mudança nas leituras bloqueia a cópia
do rascunho anterior até regenerar. Regenerar texto editado pede confirmação.
As três funções são locais e não fazem chamadas pagas de IA.

### Transferência revisada ao manuscrito

O botão Enviar ao manuscrito prepara uma prévia no mesmo navegador e projeto,
exigindo resultados salvos antes de navegar. A seção do manuscrito permite
editar ou descartar a prévia; confirmar acrescenta texto, sem substituir o
conteúdo atual, após salvar e preservar uma versão anterior. A base salva é
conferida novamente antes da aplicação; duplicação do mesmo texto é recusada.

A origem da última transferência fica no snapshot de versão, sem novo esquema
de banco. O manuscrito compara essa origem com a base salva ao carregar ou
Conferir atualização. O checklist da exportação consulta a base novamente,
avisa mudanças, análises pendentes e texto ainda não salvo, permitindo cancelar
ou gerar o documento para revisão. Alterações não salvas na tela de Resultados
não são visíveis em outra página até serem gravadas.

### Assistente global do projeto

O botão flutuante está disponível nas áreas autenticadas principais: Meu espaço,
Ideias, Radar, Biblioteca, Protocolo, Manuscrito, Documentos, Orientação e Conta.
Resultados mantém seu assistente específico, evitando dois botões na mesma tela.
O projeto da conversa fica visível; trocar projeto remonta a conversa para não
misturar históricos. Um ID de projeto não pertencente ao usuário não recebe
contexto de outro projeto por substituição silenciosa. Sem projetos, a ajuda
orienta a iniciar uma ideia, sem chamada de IA.

A conversa recebe uma área validada e orientações da tela, protocolo salvo,
resumo agregado dos resultados e, nas demais áreas, contagem deduplicada de
artigos vinculados e nomes das seções não vazias do manuscrito. O servidor
filtra todas as consultas por proprietário/projeto. Artigos, manuscrito, dados
individuais e textos em edição não são enviados automaticamente. Contagem não
determina suficiência científica. Consultas indisponíveis retornam estado
desconhecido, sem inventar progresso.

Ajuda da tela e atalhos funcionam sem IA. Próximo passo prepara uma pergunta
para envio explícito com a franquia existente. As ações de geração/refinamento
continuam nos módulos, com suas prévias e confirmações. Nenhuma ação de escrita
ou busca é executada só por abrir a conversa ou navegar pelos atalhos.

### Preparar uma busca pela conversa

O assistente pode devolver uma consulta em inglês com targetField guide_radar.
No servidor, destinos desconhecidos ou consultas inválidas perdem a ação.
O cliente valida novamente, permite editar e descartar a prévia e monta somente
a URL interna do Radar com parâmetros codificados. A confirmação abre o
formulário no mesmo projeto, com todos os períodos e tipos e sem filtros
adicionais. A consulta só ocorre quando o usuário clica em Pesquisar artigos.
O envio ao Radar não salva estratégia nem faz chamada adicional de IA.
Respostas em simulação não oferecem aplicação. O contexto da busca parte do
protocolo salvo e da pergunta enviada; não lê automaticamente os campos do Radar.

### Conversas sem projeto e vínculo opcional

Ideias, Meu espaço e Conta usam conversa geral, sem consultar projetos mesmo
que exista um ID na URL. Radar e Biblioteca permitem vínculo opcional; nenhuma
conversa começa automaticamente com o projeto mais recente. Nas áreas de
desenvolvimento, um projeto deve ser indicado para enviar perguntas.

Histórico sem projeto é filtrado por usuário, área e uso com project_id nulo;
não entra no histórico de projetos nem de outras áreas avulsas. O servidor
prepara apenas a mensagem, a ajuda da área e esse histórico, sem buscar
protocolos, dados ou artigos. Todas as modalidades usam os mesmos controles
de franquia, reserva, liquidação e falha. A busca preparada sem projeto abre
o Radar sem inserir um vínculo na URL. Trocar o vínculo remonta a conversa,
preservando os históricos separados.

### Da conversa de Ideias ao novo projeto

Em Ideias sem projeto, o assistente pode propor um rascunho estruturado após
esclarecer tema/pergunta. O servidor só libera a ação guide_idea nesse contexto,
com campos validados e sem referências inventadas. A prévia permite editar tema,
pergunta, objetivo, desenho, população, desfecho, método, análise e ética.

Confirmar prepara uma transferência vinculada à conta no navegador e abre o
fluxo existente de nova ideia no editor, com novo=1 e sem ID de projeto existente.
Não grava um projeto automaticamente: o usuário aplica ao novo rascunho e salva
no editor. A origem usa o ID da geração para rastreabilidade e a verificação
existente de duplicação de propostas. Campos desconhecidos continuam sujeitos
a confirmação, sem alegar validação de literatura, viabilidade ou ética.
Prévia e transferência não fazem outra chamada de IA.
