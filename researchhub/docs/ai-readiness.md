# Direção do Scholar e preparação para IA

Objetivo: transformar interesse em pergunta delimitada, viável e fundamentada.

## Contratos atuais

- Context em lib/ideas/generate.ts contém problema, população, acesso, prazo,
  exposição, desfecho, contexto, medida, volume acessível, orientação,
  autorização e requisitos do curso. Campo desconhecido fica pendente;
  não preencher com fatos inventados.
- Evidence conserva artigo e anotações do usuário com proveniência explícita.
- Idea contém proposta, plano, pendências e referências selecionadas reais.
- generate é o provedor guiado atual. Uma futura rota autenticada no servidor
  poderá devolver o mesmo contrato; a chave nunca será enviada ao navegador.
- idea_versions armazena snapshots imutáveis por usuário e série. A geração
  não salva automaticamente: o usuário decide quais versões preservar.
- Histórico depende de supabase/scholar_idea_history.sql. O instalador inicial
  também inclui essa tabela para novas instalações. Não repetir o instalador
  inicial em uma base já criada.

## IA futura por fase

Radar: ajudar termos e recortes, mantendo contagens e resultados das bases.
Biblioteca: resumir somente o conteúdo disponível, mostrar trechos de suporte
 e distinguir resumo de texto completo.
Matriz: comparar evidências e sinalizar divergências, sem declarar lacunas
 comprovadas a partir de uma pequena seleção.
Ideias: perguntar sobre informações decisivas que faltam, gerar alternativas
 delimitadas e explicar adaptações ao prazo, acesso e recursos.
Projeto: revisar coerência entre pergunta, objetivo, medida, coleta e análise.
Escrita: organizar e revisar conteúdo do usuário, sem inventar dados/resultados.

Antes de ativar: validação do contrato no servidor, autenticação, controle de
 acesso inicial a contas de teste, limite de entrada+saída (até 10.000 tokens
 por geração), contagem real de uso, teto de gasto aplicado no aplicativo,
 rastreabilidade de modelo/custo/proposta e consentimento sobre dados enviados.
Nenhum desses controles pagos está ativado nesta versão.

## Verificação na conta do usuário

1. Executar a migration de histórico e entrar no Scholar.
2. Preencher diagnóstico e gerar propostas com desfecho e contexto específicos.
3. Salvar versão, mudar prazo/acesso, atualizar e salvar outra com motivo.
4. Sair/entrar; retomar versões e conferir conteúdo, referências e anotações.
5. Levar a proposta a Meu Projeto, salvar e recuperar em outra sessão.
6. Comparar dois artigos na matriz e salvar suas anotações individualmente.
7. Em outra conta, confirmar biblioteca, projetos e histórico vazios/isolados.

Testes automatizados verificam regras e armazenamento simulado. Este roteiro
 exige sessão autenticada real e não é substituído por uma compilação.
