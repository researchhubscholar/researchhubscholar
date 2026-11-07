# Dados da conta — etapa 2

## Exportação v2

Conta → Baixar meus dados. Usa a sessão/RLS do próprio usuário, sem chave
administrativa. Não exporta integralmente projetos de terceiros como se fossem
seus, mesmo quando visíveis à coordenação ou orientação.

Inclui resultados (ficha, coleta, visitas, análises e configuração de figura),
manuscrito/seções/versões, origem da proposta, reuniões, comentários/respostas e
vínculos dos projetos próprios, além das seções antigas da conta. Registros de
autoria em outros projetos entram somente enquanto a política do banco permitir.
Hashes de convites, rascunhos locais e arquivos externos não entram.

Pagina por chave, inclusive composta, continuando após páginas curtas até obter
uma página vazia. Isso evita truncar quando o limite do servidor é menor que o
pedido. Páginas de resultados e versões grandes são pequenas. A resposta é em
fluxo para não acumular toda a conta no servidor.

O manifesto relata quantidade/situação por seção. Módulo ausente, falha de leitura,
dependência incompleta ou prazo de execução produzem estado parcial. A tela avisa
o que faltou e o nome contém `parcial`. JSON interrompido ou manifesto inconsistente
impede oferecer o arquivo como válido. A saída da tela cancela a requisição.

Limite operacional: quatro minutos, com até vinte segundos por consulta. Acima
disso a exportação é explicitamente parcial, sem promessa de volume ilimitado.
A leitura é ao vivo, sem snapshot transacional; evitar edições concorrentes.
O JSON é portabilidade/conferência, não um backup restaurável. Alguns comentários
podem constar no contexto do projeto e também na seção de autoria.

## Exclusão administrativa — implementada, homologação pendente

Instalar `supabase/scholar_account_deletion.sql` depois de conta/suporte,
operação, acesso, manuscrito e resultados. Reexecutável; instalar não processa
nenhum pedido, não concede papéis e não ativa cron de exclusão.

Operação → Revisar exclusões é restrito ao papel `owner`. Revisar a conta e seus
contadores, digitar o e-mail atual e clicar em excluir. A API valida sessão,
papel e origem; o banco valida novamente papel, pedido pendente, e-mail, sete
dias desde a solicitação e data prevista. O alvo vem do banco, não do navegador.
A conta do próprio operador e contas com papel de gestão são bloqueadas.

A admissão trava o pedido e muda para `processing`, impedindo cancelamento ou
execução duplicada. Também bloqueia último diretor ativo, operações de IA
reservadas e arquivos no Storage, inclusive propriedade legada. Arquivos nunca
são removidos diretamente por SQL: resolver a propriedade/remoção pelo fluxo
adequado de Storage antes de excluir. As condições são revalidadas por trigger
na transação efetiva do Auth, para cobrir mudanças após a admissão.

A exclusão usa `auth.admin.deleteUser(id, false)` somente no backend. As cascatas
removem os registros vinculados à conta e aos seus projetos. O comprovante fica
em tabela separada, sem FK ao usuário/pedido, sem e-mail e sem conteúdo científico:
identificadores técnicos, situação, datas, tentativas e código de falha.

`Verificar resultado` consulta a existência no banco e atualiza o comprovante;
nunca chama a exclusão. Falha definitiva 4xx (exceto timeout) pode devolver o
pedido a pendente para revisão/cancelamento. Falha de rede, 5xx ou perda da
resposta mantém processamento e bloqueia repetição/cancelamento automáticos.
Se o usuário já foi removido e faltou atualizar o comprovante, verificar conclui
o registro. Se a conta ainda existe com resultado incerto, investigar o Auth e
seus logs antes de qualquer liberação administrativa; não há botão de forçar.

A tela Conta diferencia pedido pendente de processamento iniciado. Novos pedidos
não duplicam um processamento existente. Comprovantes do próprio usuário entram
na exportação, sujeitos à RLS; nenhum cliente pode alterar ou iniciar execuções
pela tabela de comprovantes ou pelas funções privadas.

Diagnóstico estrutural: identifica ambiente, hostname público do banco, horário,
tabelas, RLS e funções essenciais. Não comprova políticas completas nem histórico
de execução de todas as migrations; essa conferência por ambiente segue aberta.

### Verificações antes de concluir a etapa 2

- Instalar a migration e homologar no Preview com conta descartável, sem dados reais.
- Conferir SDK/Auth reais, sessão inválida após remoção, Storage e preservação de terceiros.
- Validar cancelamento antes da admissão, bloqueio após início, impedimentos e recuperação.
- Conferir exportação autenticada e registrar evidência por ambiente/migration.
- Revisar retenção dos comprovantes e procedimentos para resultados incertos.

Os testes automatizados instalam os módulos de schema em PostgreSQL de teste e
simulam a transação do Auth, além de exercer a API e os componentes reais com
serviços simulados. Não constituem exclusão de conta real nem validação de
permissões do projeto Supabase em produção. Nenhuma conta real foi excluída.

Downloads, cópias locais do navegador e retenção em backups/logs/serviços externos
não são apagados por esse fluxo. Um JWT pode permanecer válido até expirar; o
aplicativo verifica o usuário nos fluxos protegidos e não promete apagar dados
já carregados em outros dispositivos.

Referências oficiais consultadas:
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- https://supabase.com/docs/guides/auth/managing-user-data
