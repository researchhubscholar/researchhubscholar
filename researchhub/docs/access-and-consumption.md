# Licenças, residências e franquias

## Ativação da base

Executar apenas supabase/scholar_access.sql em uma base Scholar já instalada.
Este arquivo é uma migration única (policies não devem ser repetidas).
Não rodar scholar_install.sql de novo. Não altera nem apaga material existente.

As telas /licenca e /residencia não concedem licenças nem aceitam pagamentos.
Provisionamento é uma operação do SQL Editor ou backend confiável; usuários
não podem escolher um plano pago e se autoconceder acesso.

## Teste pessoal, sem cobrança (SQL Editor)

Substituir EMAIL_DA_CONTA pelo e-mail de uma conta já cadastrada e confirmada:

```sql
select public.scholar_provision(
 (select id from auth.users where lower(email)=lower('EMAIL_DA_CONTA')),
 'essential'
);
```

A conta receberá licença de simulação por 30 dias e 3 milhões de tokens.
Não confirma pagamento, não envia dados à OpenAI e não cobra API.
Uma conta pode ter licença pessoal e vínculos com várias residências.

## Teste de residência, 30 vagas (SQL Editor)

```sql
select public.scholar_provision(
 (select id from auth.users where lower(email)=lower('EMAIL_DA_COORDENACAO')),
 'essential', 'Residência de teste', 30
);
```

A coordenação usa /residencia para criar turmas, gerar códigos, revogar convites,
alterar turmas/vínculos e redistribuir a franquia. Códigos são aleatórios,
guardados como hash, válidos até 7 dias, com contador de usos. Com e-mail
específico, somente a conta confirmada desse e-mail pode resgatar, uma vez.
Todos os resgates bloqueiam a licença para conferir as vagas de forma atômica.
O código não é enviado por e-mail automaticamente: a coordenação o copia.

O residente resgata o código em /residencia e escolhe os projetos que compartilha
no construtor. A coordenação lê o protocolo salvo em uma página sem edição.
Não recebe acesso à biblioteca, ideias, senha ou projetos não compartilhados.
Desativar o vínculo retira os compartilhamentos. Dados pessoais permanecem.
A coordenação não altera os dados do projeto nem os papéis de outros diretores.

## Simular consumo (SQL Editor)

Substituir EMAIL_DO_RESIDENTE e ID_DA_LICENCA_INSTITUCIONAL pelos dados de teste:

```sql
select public.scholar_simulate(
 gen_random_uuid(),
 (select w.id from public.scholar_wallets w join auth.users u on u.id=w.user_id
  where lower(u.email)=lower('EMAIL_DO_RESIDENTE') and w.license_id='ID_DA_LICENCA_INSTITUCIONAL'::uuid),
 (select id from auth.users where lower(email)=lower('EMAIL_DO_RESIDENTE')),
 4000, 6000
);
```

Usar o mesmo UUID de operação para repetir uma solicitação de forma idempotente.
O teste usa saldo marcado como simulação e registra custo zero. Não há botão
público para debitar livremente franquias nem acesso público ao provisionamento.

## Contrato do backend de IA futuro

1. Autenticar usuário no servidor e verificar qual carteira ele escolheu.
   A escolha atual é mantida na sessão do navegador, separada por usuário;
   ainda não é consumida pelas ferramentas, pois IA permanece desligada.
2. Contar entrada completa (instruções, contexto e referências) e reservar
   orçamento de entrada+saída de no máximo 10.000 tokens por operação.
   A saída inclui raciocínio contabilizado pelo provedor. Modelo não ganha
   10.000 tokens extras de saída. Cada proposta completa é uma operação.
3. scholar_reserve aplica saldo, validade, vínculo ativo, uma operação simultânea
   por usuário e 20 tentativas diárias em UTC. Falhas também contam no diário.
4. Checar a operação existente em um retry: reutilizar UUID não autoriza chamar
   o provedor novamente se a geração já começou ou terminou.
5. Chamar provedor e finalizar com scholar_settle uma única vez. Guardar uso real,
   modelo, ferramenta, projeto, ID do provedor e custo USD. Falhas devolvem saldo
   ao usuário, preservando o custo que eventualmente tivemos.
6. Operações interrompidas precisam de reconciliação no backend; não liberar
   reservas automaticamente enquanto uma chamada ainda puder ser concluída.
7. Aplicar ainda um teto financeiro global/institucional na futura integração;
   quotas de tokens não substituem controle de gasto quando modelos diferem.

RPCs reserve/settle/simulate/provision/recharge são exclusivos do backend ou SQL
Editor. Uma chave service_role não é necessária no navegador nem nesta versão.
No futuro ela só poderá existir no servidor. RLS impede escrita direta do cliente.

Recargas têm chave idempotente e mesma validade da licença; na instituição,
aumentam a parcela não distribuída até a coordenação alocar. Ativação/renovação
anual, pagamento, inadimplência e webhook deverão ser integrados após a definição
comercial; não alterar saldos ou períodos manualmente com chamadas em andamento.

## Configuração comercial inicial (sem checkout)

Individual: Essencial R$599/3M, Plus R$899/6M, Premium R$1499/12M por ano.
Recarga proposta: R$79/1M até o fim da licença.
Referência institucional: 30 vagas Essencial por R$14.400/ano (90M tokens),
coordenação incluída. Preços sujeitos a validação com o público.
Licença anual parcelada não equivale a assinatura mensal cancelável.

Recomendação inicial de modelos: avaliar GPT-5.6 Terra nas propostas completas
 e GPT-5.6 Luna em tarefas menores, com exemplos reais antes de decidir o padrão.
Nenhum modelo está conectado e nenhum preço de provedor está fixado no código.

## Verificação

npm run test:access executa PostgreSQL em WASM com PGlite: policies/RLS, vagas,
compartilhamento, permissões, reservas, liquidação, falha e limite diário.
Funções pgcrypto são substituídas somente nesse teste, pois a extensão não está
no runtime WASM. O teste não comprova concorrência entre conexões nem substitui
resgate real com duas contas no Supabase.
