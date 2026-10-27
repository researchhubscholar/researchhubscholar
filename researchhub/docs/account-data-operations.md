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

## Exclusão de conta — pendente

O sistema registra/cancela pedidos e a operação lista pendências. Não há executor
homologado nesta entrega. Nenhuma conta real foi excluída e nenhum job automático
de exclusão foi ativado.

Antes da execução administrativa:

- Resolver no servidor a disputa entre cancelar e executar, respeitando o pedido
  pendente e os sete dias de segurança.
- Revisar cascatas, compartilhamentos, último diretor/responsável institucional
  e eventuais arquivos em Storage/serviços externos.
- Restringir execução ao responsável autorizado, com revisão explícita da conta.
- Registrar processamento/falha/repetição sem guardar o conteúdo científico excluído.
- Testar conta descartável com todos os módulos: autenticação removida, cascatas,
  acesso revogado e preservação das contas/projetos de terceiros.
- Documentar os limites de retenção em backups, logs e serviços externos sem
  prometer remoção imediata de tudo.

A etapa 2 segue aberta até esse fluxo, a conferência por ambiente e a validação
autenticada de uma exportação representativa estarem concluídos.
