# Etapa 3 — validação da jornada autenticada

Status: iniciada em 27/10/2026; **não validada no ambiente real**. A etapa 2
continua aberta, incluindo instalação e teste da exclusão de conta. A criação deste
roteiro não altera dados nem executa operações no Preview.

## Preparação

- Registrar data, endereço do Preview, ambiente e versão exibida no deploy. Usar
  duas contas descartáveis distintas (A e B) e, para orientação, uma terceira conta
  ou B como orientador convidado. Nunca registrar senhas ou dados de pacientes.
- Utilizar apenas projetos, ideias, referências e registros fictícios; guardar os
  identificadores dos dois projetos para conferir o isolamento.
- Confirmar as migrations necessárias no ambiente. O diagnóstico de estrutura não
  comprova histórico completo de aplicação. Atualizar todas as abas após migrations.
- Cada passagem tem três estados: **passou**, **falhou** ou **não testada**.
  Registrar mensagem, passo anterior, dispositivo e versão quando falhar, sem
  incluir conteúdo privado, credenciais ou dados identificáveis.

## Percurso e critérios

| Passagem | Ação | Resultado esperado |
| --- | --- | --- |
| Ideia | A cria uma proposta, altera e valida no Radar. | A proposta é salva antes da navegação; falha de salvamento impede a troca. |
| Radar e biblioteca | Fazer busca e guardar uma referência. | Busca concluída ou erro compreensível; artigo aparece na biblioteca de A. |
| Projeto | Criar projeto pela ideia e preencher o protocolo. | Projeto e origem correspondem à ideia; após sair e voltar, conteúdo permanece. |
| Seleção | Criar segundo projeto em A e alternar nas telas. | URL e título sempre correspondem ao projeto escolhido; ID inválido não abre outro. |
| Matriz | Associar referência e preencher uma nota. | Ao recarregar, vínculo e nota continuam no projeto correto. |
| Resultados | Inserir dados fictícios, salvar e recarregar. | Dados e análise persistem no projeto escolhido, sem misturar os demais. |
| Manuscrito | Escrever seções, salvar, criar versão e recarregar. | Texto, versão e citações permanecem; falha não produz gravação parcial. |
| Arquivos | Exportar documentos e dados da conta, abrir os arquivos. | Conteúdo e acentos conferem; manifesto indica qualquer seção parcial ou indisponível. |
| Contas | B abre links diretos de A e consulta seus próprios dados. | Acesso privado negado; nenhuma informação de A aparece nos dados de B. |
| Compartilhamento | Convidar B como orientador, comentar e revogar. | Acesso limitado ao convite; após revogação, os links privados deixam de funcionar. |
| Conflito | Editar o mesmo documento em duas abas e salvar ambas. | A segunda gravação avisa conflito e preserva o rascunho. |
| Falha | Interromper rede no salvamento e tentar sair. | A tela informa falha e mantém edição, sem afirmar que salvou. |
| Celular | Repetir navegação, edição, seleção e exportação em tela pequena. | Controles legíveis e utilizáveis, sem perda de conteúdo ou troca de projeto. |

Para cada linha, anotar estado, data/ambiente, conta (A ou B), dispositivo,
resultado observado e referência de evidência sem dados sensíveis. Falhas devem
ser corrigidas e as passagens afetadas repetidas. Não registrar a etapa concluída
até que os cenários essenciais passem com sessão real, duas contas e celular.

## Evidência automatizada inicial

`tests/journey-integration.cjs` aplica migrations em PostgreSQL sintético e
atravessa ideia salva, origem do projeto, biblioteca/matriz, resultados e
manuscrito, com leitura e escrita de outra conta bloqueadas. Outros testes
isolados cobrem componentes de Ideias/Radar, gravações, exportação, orientação,
conflitos e falhas. Nenhum desses testes é navegador autenticado de ponta a ponta;
provedores, deploy, comportamento visual e arquivos exportados reais ainda
precisam de verificação no ambiente apropriado.
