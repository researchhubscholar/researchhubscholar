# Português e espanhol — plano prioritário

Prioridade definida pelo usuário em 03/11/2026. Português brasileiro como padrão;
espanhol neutro latino-americano opcional. Uma aplicação, mesmos dados e funções.
A consolidação anterior permanece registrada e será retomada após esta prioridade.

| Etapa | Entrega | Estado |
| --- | --- | --- |
| 1 | Base central de traduções, tipos e preferência | Implementada; verificações locais abaixo |
| 2 | Seletor e tradução das telas, menus, mensagens e estados | Em andamento: primeiro bloco implementado |
| 3 | Idioma do assistente e dos textos de IA, com os mesmos limites | Pendente |
| 4 | Documentos gerados e formatos de datas/números | Pendente |
| 5 | Validação dos fluxos, terminologia científica e layout nos dois idiomas | Pendente |

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
