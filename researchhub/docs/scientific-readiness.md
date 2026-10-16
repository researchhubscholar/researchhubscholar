# Preparação científica — 14/10/2026

A prioridade acordada é resultados/figuras, exportações, qualidade/limites de IA,
institucional e alertas. Compra/acesso ficam para depois.

## Instalação incremental

1. `scholar_results.sql` — após scholar_access.sql: workspace privado por projeto.
2. `scholar_institutional_roles.sql` — coordenação, orientação institucional e auditoria.
3. `scholar_ai_evaluation.sql` — avaliação científica das próprias gerações.
4. `scholar_ai_budgets.sql` — se ainda não executado; não liga orçamento automaticamente.

Os três primeiros arquivos podem ser reexecutados. Não excluem dados existentes.
O orçamento permanece com a configuração vigente: não é ativado sem tarifas reais.

## Dados e figuras

Meu projeto → Resultados e figuras. CSV com cabeçalho, 1,5 MB, 5.000 observações,
80 variáveis. Remover dados identificáveis antes do upload. Colunas textuais são
categóricas; números completos sugerem variável numérica. Códigos numéricos podem
ser categorias: escolher frequência em vez de histograma e revisar interpretação.
Vazios são ausentes, não zeros. Médias e DP amostral apenas para colunas numéricas;
DP indisponível quando N < 2. Não inclui testes inferenciais nem recomendações clínicas.

Frequências absolutas: até 12 barras, com categorias excedentes agregadas em
"Outras categorias". Histograma com até 10 intervalos, último inclui máximo.
Títulos/legendas editáveis, SVG vetorial, PNG a 3x. Fluxo genérico configurável:
contagens fornecidas pelo pesquisador; não é PRISMA completo. Workspace salvo
na conta, isolado por projeto; conta institucional não recebe acesso aos dados.

Importação XLSX ainda não implementada: exportar a planilha original como CSV.
Esta versão mantém uma figura configurada por projeto, editável a qualquer momento.

## Exportações nativas

Central de documentos: DOCX para protocolo/resumo/reunião; XLSX para matriz;
manuscrito consolidado com seções salvas, referências vinculadas ao projeto,
tabela descritiva e figura. Referências vinculadas não equivalem à lista final
selecionada de citações: revisar duplicações com seção Referências do manuscrito.
OOXML real com ZIP STORE, texto escapado, fórmulas XLSX mantidas como texto.
A figura pode ser anexada ao artigo; não é inserida automaticamente na seção
Resultados para não sobrescrever o texto do usuário. Exportações rápidas legadas
fora da central continuam disponíveis.

## Qualidade e limites

Operação → Qualidade, IA e limites: últimas até 2.000 operações live em 7 dias,
P95/consumo/custo estimado, envelope reservado no dia UTC, status da instalação
financeira e tarifas. Custos são estimativas configuradas, não faturas do provedor;
a amostragem não substitui relatório contábil. Limites SQL são atômicos e testados.
A página não faz gerações pagas e não altera configurações financeiras.

Detalhes da geração → Avaliar qualidade científica: recorte, coerência de método,
viabilidade, fontes, utilidade (1–5) e observações. Rubrica `scientific.v1`.
Seis cenários sintéticos documentados; precisam ser executados com o modelo e
avaliados com casos reais antes de declarar qualidade científica validada.

## Institucional

Diretor: gestão vigente + alteração de perfis. Coordenador: turmas/convites,
vínculos e leitura de projetos compartilhados; sem distribuição de tokens.
Orientador: vínculo institucional não concede acesso geral aos projetos; convite
explícito por projeto continua necessário. Residente permanece com dados privados.
Staff deve possuir vínculo ativo antes de promover perfil. Últimas 50 ações de
vínculos/turmas/convites/compartilhamentos/franquia ficam em log sem edição por clientes.
Não registra códigos de convite, conteúdo científico ou cada liquidação de tokens.

## Alertas por e-mail — dependência externa

Alertas internos e cron existentes preservados. Consulta MCP não encontrou integração
Resend no workspace Scholar; CLI de descoberta exige autenticação neste ambiente.
Ainda é preciso conectar um serviço de e-mail e validar remetente. Não há envio
implementado nem entrega verificada neste bloco; não marcar este item como concluído.
Antes de integrar: serviço real, domínio/remetente validado, preferências explícitas,
fila idempotente, retry, registro de entrega/bounce, descadastro e teste em conta própria.
