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


## Biblioteca no assistente — fontes escolhidas

- Marcar de um a três artigos e abrir “Revisar fontes no assistente” prepara a pergunta sem chamar IA. É possível retirar fontes ou limpar a seleção.
- O envio transmite IDs; o servidor verifica a conta e busca somente resumos e anotações salvas dos artigos escolhidos. Artigo ausente, sem conteúdo utilizável ou de outra conta bloqueia antes da reserva. Sem texto completo, importação externa ou alterações não salvas.
- Limites por artigo: 2.000 caracteres de resumo e 800 de anotações. O histórico registra quais fontes e tipos de conteúdo foram recebidos, identificadores e eventual truncamento.
- Recomendações com fontes devem trazer um trecho literal validado no servidor, distinguindo resumo de anotação do pesquisador. Isso confere a existência do trecho, não garante a interpretação científica. Fonte ou trecho inválido segue o tratamento existente de falha de geração; não há repetição paga automática.
- Cobertura automatizada: seleção e limpeza no componente real, envio só de IDs, isolamento por proprietário antes da reserva, limites, histórico e rejeição de trechos fabricados. Validação visual com sessão autenticada continua a ser feita no Preview.


## Assistente restrito à pesquisa e ao ResearchHub

- Política versionada `guide.v2-research-scope`, enviada como instrução de maior prioridade. Abrange trabalhos científicos em qualquer área e uso da plataforma; não exige projeto criado para dúvidas gerais.
- Uma classificação obrigatória na mesma geração separa pesquisa, esclarecimento, assunto externo, conduta clínica individual, fraude acadêmica e tentativa de contornar instruções. Nenhuma chamada adicional de classificação ou mudança de modelo.
- Decisões de recusa substituem todo o conteúdo gerado por uma orientação fixa no servidor, com ações vazias. Não dependem de trechos de artigos para conseguir recusar. Classificação ausente/inválida não exibe resposta e segue o tratamento existente de falha/reserva. Histórico antigo permanece legível.
- Esclarecimentos não oferecem ações de transferência. Perguntas clínicas impessoais de pesquisa, educação sobre integridade/segurança e dados sintéticos rotulados são permitidos. Não são permitidas condutas para pessoa específica, fabricação de resultados ou referências e tentativas de obter dados não autorizados.
- O chat informa o escopo e que cada envio, inclusive um redirecionamento, consome a franquia normal; não existe nova taxa/chamada.
- Testes automatizados verificam instruções e schema enviados, substituição integral de resposta e ações para cada recusa, persistência, compatibilidade com fontes selecionadas, esclarecimento sem ações e falha fechada na ausência de classificação. A decisão semântica ainda depende do modelo: não equivale a uma garantia absoluta contra falhas ou alucinações.
- Avaliação manual no Preview: testar dúvida legítima de estatística/ciências humanas, saudação, pedido de receita culinária sem contexto científico, pergunta curta em continuação, conduta para paciente específico, pedido de inventar DOI/resultados e tentativa de ignorar regras; conferir resposta breve e retorno ao trabalho científico. Repetir com fontes selecionadas e sem projeto.
