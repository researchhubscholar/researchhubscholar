# Regressão da jornada — 15/10/2026

## Resultado desta rodada

Suíte completa `npm test`, `node tests/project-delete.cjs`,
`node tests/manuscript-flow.cjs`, typecheck, lint, build e smoke passaram.
Nenhum projeto real foi apagado; testes de banco usam PostgreSQL isolado (PGlite).
Não houve geração de IA real nesta rodada.

| Passagem | Evidência automatizada | Limite |
|---|---|---|
| Ideia → refino → histórico → projeto → Radar | tests/ideas-flow.cjs, tests/exports.cjs | Contratos/testes isolados; sem geração real |
| Estratégia → PubMed → paginação | tests/radar.cjs | Provedores simulados |
| Biblioteca → matriz → múltiplos projetos | tests/library-store.cjs, tests/access.cjs | Banco e armazenamento isolados |
| Orientação e papéis institucionais | tests/access.cjs | RLS real em PostgreSQL isolado |
| Manuscrito → salvar → criar versão | tests/manuscript-flow.cjs | Falha/concorrência simuladas; sem browser |
| Dados → estatística → exportação | tests/results.cjs, tests/exports.cjs | Casos de referência e arquivos gerados; revisão visual pendente |
| Exclusão do projeto | tests/access.cjs, tests/project-delete.cjs | Schema completo + RLS; requer migration instalada no Supabase |
| Rotas e retorno ao painel | tests/navigation.cjs, tests/smoke.mjs | HTTP sem sessão; não prova navegação privada autenticada |

## Correção encontrada

Criar versão no manuscrito ignorava retorno falso de salvamento. Agora a operação
interrompe quando a sincronização falha, preserva um snapshot anterior à espera e
bloqueia cliques duplicados enquanto cria a versão. Alterações feitas durante o
salvamento continuam no editor para próximo salvamento/versão.

## Validação autenticada ainda necessária

O navegador disponível chegou à proteção/login da Vercel na tentativa anterior.
Não existe sessão Scholar autenticada disponível para este teste. Não declarar
este ponto concluído por ausência de erros em logs: a consulta Preview de 30 minutos
não retornou registros, o que só demonstra ausência de registros nessa janela.

### Roteiro com projeto descartável

1. Residente: criar/refinar ideia, salvar, expandir em projeto e abrir Radar;
   conferir se o tema refinado aparece. Salvar referência na biblioteca.
2. Preencher matriz e protocolo; sair/entrar e conferir conteúdo persistido.
3. Escrever duas seções, inserir citação no meio do texto, salvar e criar versão;
   recarregar e conferir texto, referências e histórico.
4. Importar CSV fictício em Resultados, salvar, recarregar e exportar Word/Excel;
   abrir arquivos e conferir tabelas, acentos, referências e figuras.
5. Orientador: aceitar convite específico, comentar; residente: responder e resolver.
   Retirar compartilhamento e conferir que acesso direto do orientador é negado.
6. Coordenador/diretor: conferir somente projetos compartilhados, residentes e
   permissões de vagas/franquia. Confirmar que outra conta não lê dados privados.
7. Repetir navegação em largura de celular e tablet: menu, seletores, matriz,
   editor/citações e tabelas; ausência de rolagem horizontal da página inteira.
8. Excluir somente o projeto descartável. Conferir biblioteca/matriz preservadas,
   manuscrito/resultados removidos e projeto ausente após novo login.

Critério de fechamento: registrar evidência por etapa nas contas reais de teste,
corrigir bloqueadores e repetir apenas as passagens afetadas. Nenhuma senha deve
ser enviada no chat.
