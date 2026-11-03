# Português e espanhol — plano prioritário

Prioridade definida pelo usuário em 03/11/2026. Português brasileiro como padrão;
espanhol neutro latino-americano opcional. Uma aplicação, mesmos dados e funções.
A consolidação anterior permanece registrada e será retomada após esta prioridade.

| Etapa | Entrega | Estado |
| --- | --- | --- |
| 1 | Base central de traduções, tipos e preferência | Implementada; verificações locais abaixo |
| 2 | Seletor e tradução das telas, menus, mensagens e estados | Próxima |
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
