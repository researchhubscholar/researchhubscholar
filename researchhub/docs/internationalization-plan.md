# Português e espanhol — plano prioritário

Prioridade definida pelo usuário em 03/11/2026. Português brasileiro como padrão;
espanhol neutro latino-americano opcional. Uma aplicação, mesmos dados e funções.
A consolidação anterior permanece registrada e será retomada após esta prioridade.

| Etapa | Entrega | Estado |
| --- | --- | --- |
| 1 | Base central de traduções, tipos e preferência | Implementada; verificações locais abaixo |
| 2 | Seletor e tradução das telas, menus, mensagens e estados | Implementada; testes automatizados aprovados |
| 3 | Idioma do assistente e dos textos de IA, com os mesmos limites | Implementada; verificações automatizadas aprovadas; validação real na etapa 5 |
| 4 | Documentos gerados e formatos de datas/números | Implementada; verificações automatizadas aprovadas; validação real/visual na etapa 5 |
| 5 | Validação dos fluxos, terminologia científica e layout nos dois idiomas | Em andamento; integridade dos arquivos verificada; validação visual/autenticada e IA real pendentes |

## Etapa 1

`lib/i18n/catalog.ts`: chaves semânticas tipadas e catálogos português/espanhol,
inicialmente navegação e ações comuns. TypeScript exige paridade. Expandir o
catálogo junto da migração das telas, evitando traduções automáticas de DOM.
`lib/i18n/locale.ts`: validação estrita de pt-BR/es e fallback português; sem
detecção automática pelo idioma do navegador. Preferência `scholar_locale`,
Path=/, SameSite=Lax, um ano, Secure em HTTPS. Cookie sem dados científicos,
identificadores ou permissões. Preferência deste navegador, não sincronizada
entre dispositivos. Nenhum SQL necessário.

`lib/i18n/server.ts`: leitura por requisição com cookies do Next; layout fornece
a mesma preferência ao HTML e ao provider para evitar divergência na hidratação.
Isso torna o layout dependente da requisição; páginas públicas passam a renderizar
por requisição quando envolvidas por ele. Não usar cache compartilhado de respostas
localizadas sem variar por idioma. Metadados continuam em português até sua revisão.

`LanguageProvider` disponibiliza locale, setLocale e t aos componentes clientes.
Componentes servidor poderão usar getRequestLocale/translate. Não há seletor
visível nesta entrega, nem promessa de interface toda traduzida. Na etapa 2,
a ação do seletor também deve atualizar os componentes servidor com router.refresh,
preservando rascunhos e proteções de navegação. Não usar reload que descarte edição.

Conteúdo de artigos, títulos, resumos, notas e projetos do usuário permanece
intacto. Idioma de interface não equivale a idioma das fontes ou dos dados.

Verificação: teste de padrão português, entradas inválidas, paridade dos catálogos,
traduções e cookie sem injeção; smoke HTTP verifica pt-BR sem cookie, es explícito,
fallback de cookie inválido e ausência de vazamento para requisição seguinte.
Além de typecheck, lint, contrato de navegação e build. Validação visual dos dois
idiomas pertence à etapa 5; ainda não foi realizada.

## Etapa 2 — primeiro bloco

Seletor português/espanhol na navegação pública e interna. Usa o cookie da etapa 1
e atualiza o contexto no cliente; router.refresh atualiza o layout servidor sem
reload completo. Não muda URL, chave de projeto, permissões, campos ou conteúdo.
Textos estáticos podem usar InterfaceText com chave explícita; não há varredura
nem tradução de DOM e nunca se passa título/resumo/nota do usuário ao catálogo.

Entregue neste bloco: navegação pública/interna, sair, atalhos de retorno e planos,
rodapé, login, textos principais do cadastro e Biblioteca (cabeçalho, filtros,
abas, métricas, notas e ações principais). A preferência de espanhol mostra aviso
de tradução em andamento, pois esta entrega ainda tem cobertura parcial.

Falta na própria etapa 2: Meu espaço, Ideias, Radar, Projeto, Resultados, Manuscrito,
Orientação, Conta, Operação, Documentos, Residência/diagnóstico, páginas públicas
e recuperação de senha. Também completar Biblioteca (matriz, organização,
comparação, diálogos, estados dinâmicos, rótulos acessíveis e desenhos de estudo),
mensagens de validação/API e falhas do provedor de autenticação. Não declarar
espanhol completo nem iniciar etapa 3 antes de concluir essa lista.

Verificação: tipos, lint, testes existentes e catálogo; smoke HTTP português/espanhol
no login e leitura de preferência, mantendo os nomes dos campos de autenticação.
Build e smoke devem passar antes da publicação. Conferência visual autenticada,
teclado, troca de idioma com rascunhos e ausência de remount em cada fluxo ainda
precisam de validação real; preservar estrutura/chaves no código não comprova
validação manual. Etapas 3, 4 e 5 permanecem pendentes.

## Etapa 2 — ampliação e limite de cobertura

Migração explícita de cerca de 400 nós JSX e de botões/rótulos condicionais para
um catálogo adicional tipado. Inclui textos fixos principais de Meu espaço,
Ideias, Radar e recuperação de senha; amplia Biblioteca, Conta, Orientação,
Documentos e Manuscrito, além de textos comuns em outras páginas. Configurações
autorais das ferramentas do dashboard usam AuthoredText; títulos e textos de
projetos/artigos continuam como dados originais. Os valores de enums, filtros,
nomes de campos e operações de banco não foram traduzidos. EXCLUIR continua o
texto literal exigido para confirmar a exclusão, conforme a regra existente.

A etapa 2 NÃO está concluída. O inventário reproduzível em
`scripts/audit-i18n.cjs --write` registra os candidatos literais restantes em
`i18n-pending.json`. Inclui nomes neutros que podem permanecer iguais; não mede
as mensagens dinâmicas, APIs ou constantes importadas. Não equivale a percentual
de tradução. Ainda faltam módulos avançados de Projeto/Resultados/coleta,
Operação, Residência/diagnóstico, páginas públicas, constantes e mensagens
dinâmicas, além de acabamento nas telas já migradas. O aviso de tradução em
andamento permanece visível no espanhol. Próxima ação continua sendo etapa 2.

Testes: provider real exercitado com hooks isolados para alternar/restaurar idioma,
cookie e identidade dos filhos com rascunhos; seletor verifica refresh sem
navegação/reload. Mocks de apresentação dos testes existentes resolvem as chaves
para português, preservando os handlers reais. Testes HTTP continuam verificando
o HTML de login nos dois idiomas. A etapa 5 ainda exige teste visual autenticado.

## Encerramento da implementação da etapa 2 — 03/11/2026

Esta seção substitui o estado de cobertura parcial registrado acima. Português
continua padrão. Espanhol cobre a navegação, páginas públicas e legais, acesso,
Meu espaço, Ideias, Radar, Biblioteca, Projeto, Orientação, Conta, Operação,
Residência, diagnóstico, controles de Resultados/coleta e Manuscrito. Foram
incluídos rótulos acessíveis, placeholders, estados, confirmações destrutivas e
explicações de interface dos módulos avançados. Nenhuma operação de banco, enum,
valor de formulário, consulta científica ou cálculo estatístico foi traduzido.

Textos constantes usam chaves explícitas. Configurações autorais e avisos são
localizados apenas em limites de apresentação revisados, por AuthoredText.
Mensagens com variáveis usam modelos explícitos e mantêm nomes, números e datas
interpolados. Não há tradução de DOM, serviço de tradução externo ou envio
adicional de dados. Diagnósticos externos desconhecidos mantêm o texto original.
Artigos, nomes de projetos, conteúdo escrito pelo usuário, nomes de variáveis,
categorias e texto científico gerado permanecem no idioma original. A geração
com IA é etapa 3; documentos e formatos, etapa 4. Conteúdo científico em tabelas,
figuras ou rascunhos usa os valores/originais; a revisão de saídas é etapa 4.

O inventário estático audit:i18n registrou zero literal/atributo pendente fora do
assistente. Termos que coincidem nos dois idiomas e identificadores técnicos
foram revisados e mantidos; não contam como textos faltantes. O inventário não é
uma prova visual nem substitui os testes de mensagens/configurações.

Verificações: catálogo tipado com paridade português/espanhol; testes de troca de
idioma e preservação de filhos/rascunhos; modelos com singulares/plurais, valores
interpolados e confirmações; suíte funcional existente, tipos, lint, build e smoke
HTTP. Os testes isolados de componentes receberam apenas mocks da apresentação
localizada, sem remover verificações de salvamento, dados ou permissões. O
componente de leitura de resultados continua síncrono e usa contexto no cliente.

Próxima: etapa 3, idioma do assistente e respostas de IA. Restam etapa 4,
documentos e formatos; e etapa 5, validação humana, revisão terminológica e
conferência visual autenticada nos dois idiomas em desktop/celular. A etapa 2
está implementada e verificada automaticamente; validação real segue na etapa 5.

## Etapa 3 — primeira implementação

Preferência de idioma validada no servidor para assistente, ideias e refinamento.
Espanhol passa a ser idioma de saída permitido, mantendo inglês quando escolhido
explicitamente para geração científica. Prompts preservam chaves, identificadores,
termos MeSH, consultas PubMed, citações e dados originais. Redirecionamentos de
escopo e segurança possuem versão espanhola; a classificação e as ações permitidas
continuam as mesmas. O atalho de início fixo em português não substitui uma resposta
em espanhol. Provedor, limites financeiros e proteção de contexto não foram alterados.

Ainda faltam nesta etapa: interface da janela, mensagens operacionais e simulações,
atalhos didáticos em espanhol e revisão das escolhas explícitas de idioma nos formulários.
Não houve chamada real ao modelo nem publicação deste incremento.

Verificação deste incremento: testes de idioma/segurança, IA, conversa contextual,
trechos e reserva financeira aprovados; typecheck e lint aprovados. Sem validação
real de resposta do provedor nesta fase.

## Encerramento da implementação da etapa 3 — 03/11/2026

Esta seção substitui as pendências da primeira implementação acima.

- Janela, controles acessíveis, carregamento, mensagens, ajuda por área, prévias de
  busca/proposta, revisão de trechos, avaliação e atalhos usam o idioma da interface.
- Assistente e ações de IA recebem a preferência validada no servidor. Ideias,
  refinamento e escrita permitem seguir o idioma do sistema ou escolher português,
  espanhol e inglês explicitamente. Português continua padrão.
- Simulações, início didático, recusas de escopo e avisos de reserva têm versão
  espanhola. Recusas mantêm ações bloqueadas e a política científica é a mesma.
- Idioma da geração fica no registro da operação e acompanha novas propostas do
  assistente no histórico e na transferência. Trocar a interface não traduz
  respostas antigas, artigos, citações, nomes de projeto ou textos do pesquisador.
- Termos PubMed/MeSH, chaves, enums e destinos continuam canônicos. Citações
  verificáveis preservam título e trecho original, com rótulo de fonte localizado.
- Identificadores de coluna em espanhol também são bloqueados na coleta. A
  verificação de objetivo reconhece verbos científicos em português, espanhol e inglês.
- Compatibilidade com banco existente: espanhol é preservado em
  `scholar_project_origins.snapshot.language`; a coluna legada limitada a pt-BR/en
  recebe null nesse caso. Não exige novo SQL nem altera permissões/RLS.

Verificação: suíte funcional automatizada, casos de idioma/recusas/simulação,
privacidade, citações literais, metadados de origem, preferências explícitas,
typecheck, lint, inventário estático incluindo assistente, build e smoke HTTP.
O inventário não mede textos dinâmicos nem garante a qualidade de uma resposta
real do modelo. Sem chamadas reais ao provedor ou validação visual autenticada;
essas verificações continuam previstas na etapa 5.

Próxima: etapa 4 — documentos e formatos de datas/números. Depois, etapa 5 —
validação real dos fluxos, respostas, terminologia e layout em português/espanhol.

## Etapa 4 — base inicial

Formatadores puros de datas ISO e números usam português brasileiro ou espanhol
latino-americano. Datas sem horário são interpretadas em UTC, com rejeição de datas
inexistentes. Nenhum valor de pesquisa é convertido ou salvo pelo formatador.

A Biblioteca passa o idioma atual aos cabeçalhos CSV, preservando as linhas de
artigos, enums, identificadores e notas. Word aceita idioma explícito com padrão
português e validação estrita; o editor de manuscrito e a central de documentos
encaminham a preferência atual. Rótulos automáticos do manuscrito são localizados;
títulos, seções editadas, parágrafos e referências continuam originais.

Ainda faltam nesta etapa: tradução dos modelos de protocolo/resumo/orientação e
matriz, integração dos formatadores nas telas e saídas estatísticas, revisão dos
demais pontos de exportação e verificação visual dos arquivos em ambos os idiomas.
Próxima após concluir a etapa 4: etapa 5, validação real de todos os fluxos.

## Etapa 4 — modelos e apresentação

Protocolo estruturado, resumo executivo, relatório para orientação, protocolo do
editor e matriz passam a aceitar idioma explícito, com português como padrão.
A central de documentos encaminha a preferência atual. Rótulos, seções, mensagens
de ausência e cabeçalhos são traduzidos antes de compor o HTML/CSV; nunca se
substituem palavras em documentos já montados. Conteúdo do pesquisador, nomes de
etapas editadas, notas, metadados e enumerações dos artigos são preservados.

Datas e números das telas com formatação explícita passaram a usar português
brasileiro ou espanhol latino-americano. Isso inclui histórico, projetos, conta,
licença, operação, orientação, assistente, editor e as tabelas numéricas simples
de Resultados/comparação. A data de geração dos documentos viaja como ISO e é
apresentada no fuso de São Paulo; prazos sem horário permanecem em UTC. O CSV
do Radar recebe a preferência sem mudar os dados ou o formato RIS/BibTeX.

Continuam pendentes nesta etapa os textos estatísticos calculados, suas tabelas
e figuras exportadas, além da conferência dos últimos pontos de exportação.
Nenhum cálculo, arredondamento estatístico de origem, dado ou permissão foi alterado.
Após concluir essas pendências, a próxima etapa é a 5, validação real e visual
dos fluxos e arquivos nos dois idiomas.

Verificação desta continuação: 55 scripts funcionais aprovados (incluindo a
correção da dependência de formatação no teste isolado do assistente), typecheck,
lint, inventário de interface, build e smoke HTTP. Casos específicos verificam
protocolo, resumo, relatório e matriz em espanhol sem modificar os dados de entrada.

## Encerramento da implementação da etapa 4 — 03/11/2026

Esta seção substitui as pendências de implementação registradas acima.

- Leituras e textos calculados de comparação geral, antes/depois, vários momentos
  e regressão ajustada recebem o idioma escolhido. Resumos, intervalos, valores p,
  avisos de ausência e limitações usam modelos traduzidos com valores interpolados
  literalmente. Não se traduzem documentos montados nem textos do pesquisador.
- Tabelas e planilhas de perfil, acompanhamento, comparação, pares, medidas
  repetidas e regressão seguem o idioma. Números de células continuam numéricos,
  e campos técnicos de dados, códigos e enumerações persistidos não mudam.
- SVG/PNG, histogramas e fluxos usam títulos/legendas do sistema e números no
  idioma; títulos, categorias, unidades e rótulos editáveis continuam originais.
  A geometria e as contagens são idênticas nos dois idiomas.
- Os pontos de exportação de Resultados, módulos clínicos, Manuscrito e Central
  de documentos encaminham a preferência até Word, Excel e figuras. O rascunho
  factual do assistente de resultados também utiliza o idioma, preservando textos
  já editados e exigindo revisão quando o contexto muda.
- Os motores de cálculo permanecem iguais. Testes comparam estimativas, ICs, p,
  dados de origem e geometria entre os idiomas e mantêm os bloqueios de análises
  sem confirmação.

Verificação: 56 scripts funcionais, tipos, lint, inventário de interface, build e
smoke HTTP. Sem novo SQL, chamadas reais de IA ou alteração de permissões.
Validação visual autenticada, revisão humana da terminologia e respostas reais
continuam na etapa 5, que é a próxima e última etapa deste plano.

## Etapa 5 — primeiro bloco de validação — 03/11/2026

Relatório e roteiro reproduzível em `docs/i18n-validation.md`. Foram gerados seis
arquivos sintéticos (XLSX, DOCX e SVG nos dois idiomas) pelos exportadores reais e
inspecionados independentemente com ZIP/XML do Python. CRC, XML, abas, idioma do
Word, dados brutos, células numéricas e geometria passaram. Isso não comprova
renderização no Office ou layout no navegador. Corrigido o cabeçalho “Data” do
histórico em espanhol para “Fecha”, com regressão reproduzida antes da correção.

Tipos, lint, auditoria estática e testes direcionados de documentos, coleta,
navegação, idioma da IA e preservação de rascunhos passaram. O preview redirecionou
este navegador para login da Vercel; sem sessão autenticada, não foram validados
layout, respostas reais nem persistência real dos fluxos. A proteção não foi
alterada e nenhum link de acesso ampliado foi criado. A etapa 5 permanece aberta.

Próximo bloco: seguir o roteiro visual/autenticado nos dois idiomas, começando
pela landing e troca de idioma, depois Ideias → Radar → Biblioteca → Projeto.
Também faltam conferência visual dos arquivos e avaliação das respostas reais da
IA/terminologia. Não há etapa 6 neste plano; depois da aprovação, retomar a
consolidação anterior registrada em `docs/consolidation-plan.md`.

## Etapa 5 — segundo bloco

Regressões de navegação, Ideias → Radar e escolha de projeto agora usam os
catálogos reais em PT e ES. Verificam salvamento/erro/nova tentativa, conteúdo
original, carregamento, consultas canônicas e isolamento entre contas. Corrigidas
a contagem singular/plural de projetos e a opção sem título no seletor espanhol.
Detalhes e limites em `docs/i18n-validation.md`. Persistência, autenticação e busca
nesses testes são simuladas; a etapa 5 continua aberta para validação visual,
jornada completa autenticada, revisão dos arquivos e respostas reais da IA.
