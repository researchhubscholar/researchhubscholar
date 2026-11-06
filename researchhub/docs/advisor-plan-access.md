# Orientadores convidados por plano — 05/11/2026

Prioridade autorizada pelo usuário: pausar a revisão de consolidação para aplicar
este benefício. Preços e franquias de IA permanecem inalterados.

| Licença do autor | Anuidade | Orientadores por projeto |
|---|---:|---:|
| Essencial | R$ 599 | 0 |
| Plus | R$ 799 | 1 |
| Premium | R$ 999 | 3 |

A pessoa convidada não compra uma licença: cria uma conta gratuita, confirma o
email e aceita o código em Orientação, inclusive sem ter projetos próprios.
Pode ler o projeto/manuscrito compartilhado e comentar. Não pode editar o texto,
criar atas, acessar biblioteca privada, dados brutos de coleta ou a franquia de IA
do autor. A leitura do protocolo continua disponível nas versões compartilhadas;
a interface de edição do protocolo permanece exclusiva do autor.

## Regras

- Benefício depende de licença vigente active/trial do autor, não do convidado.
  Se o autor tiver mais de uma licença elegível, prevalece o maior limite, sem somar.
  Vínculo institucional ativo também considera o plano da licença da organização;
  não há mudança nos preços, assentos ou permissões institucionais.
- Cada convite pendente não expirado reserva uma vaga. Não revogamos os outros
  convites ao criar um novo. É possível cancelar uma reserva; códigos duram 14 dias.
- Criação, aceite, cancelamento e retirada de acesso serializam no mesmo projeto.
  O aceite revalida licença, limite, validade e email confirmado/vinculado.
- Suspensão/expiração da licença interrompe acesso convidado, preservando histórico.
  Ao reduzir para um plano com menos vagas, continuam as primeiras por added_at e
  user_id; o autor pode retirar acessos para escolher quem continua.
- Renovação restaura acesso dos vínculos ativos dentro do limite, sem recriar comentários.
- O beta com acesso geral liberado não contorna o limite de orientadores.
- Sem a nova função de capacidade instalada, a interface bloqueia novos convites
  e informa indisponibilidade; a migração é necessária para enforcement no banco.

## Instalação e evidências

**Implementado no código, ainda não instalado nem homologado no Supabase real.**
Não houve acesso ao banco ResearchHub nesta entrega. Não usar outro projeto conectado.

No SQL Editor do Supabase exclusivo do ResearchHub, executar
`supabase/scholar_advisor_plan_limits.sql` após `scholar_access.sql` e
`scholar_advising.sql` já instalados. Não reexecutar esses instaladores antigos.
A nova migração é transacional e reexecutável; não altera preços nem exclui dados.
O manuscrito compartilhado exige também a instalação já existente de
`scholar_manuscript_review.sql`.

Testes sintéticos: migrations reais em PGlite, reexecução, limites 0/1/3, reserva e
cancelamento, convidado sem licença, email incorreto/não confirmado, reutilização,
RLS de projeto/manuscrito e biblioteca, comentários, bloqueio de escrita/atas,
revogação, expiração/redução/renovação, preservação do histórico e acesso anônimo.
Isso não substitui o teste autenticado no ambiente real nem comprova concorrência
entre conexões reais.

## Próximo teste após instalar

1. Autor com Essencial: não consegue criar convite, inclusive chamando o RPC.
2. Plus: um convite reserva a vaga; um segundo é bloqueado. Cancelar libera a vaga.
3. Aceitar com conta gratuita e email confirmado: abre apenas projeto compartilhado,
   lê manuscrito, comenta; não consegue alterar texto ou ver biblioteca do autor.
4. Premium: aceita três orientadores; quarto convite bloqueado.
5. Retirar acesso: convidado perde leitura ao atualizar, comentários permanecem.
6. Conferir os mesmos fluxos em português/espanhol e no celular.

Depois de validar este benefício, retomar a revisão de consolidação no teste de
orientação/leitura compartilhada. Não marcar todas as cinco etapas como concluídas.

Verificação local desta entrega: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build` e `npm run test:smoke` passaram. O teste de contexto de páginas
cobre também a entrada por convite com uma conta sem projeto próprio.

## Ajuste após teste do usuário — 06/11/2026

Usuário confirmou que o código e o acesso compartilhado funcionam. A navegação
de uma conta só de orientação agora se limita a projetos compartilhados e Conta;
autor com projeto próprio, licença, vínculo institucional ou administração mantém
a navegação completa. O papel em cada trabalho continua a depender do vínculo
e da propriedade do projeto, independentemente do menu da conta.

No manuscrito, orientadores leem e criam comentários de revisão; autores editam,
respondem e resolvem/reabrem pendências. Ninguém responde à própria publicação
inicial. Em Orientação, o autor pode registrar notas e manter atas/versões; o
convidado lê e comenta. O formulário de aceitar convite fica na seleção de
projetos. O histórico existente é preservado.

Executar `supabase/scholar_advisor_review_roles.sql` no Supabase do ResearchHub
para aplicar a separação também no banco. Teste com as duas contas já usadas:
convidado publica comentário e não vê Responder ou Resolver no próprio comentário;
autor responde e resolve, e o convidado vê ambos ao atualizar. Reteste pendente
no ambiente real.
