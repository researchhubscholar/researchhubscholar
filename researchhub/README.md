# ResearchHub — MVP completo + modelo "uma instância por universidade"

Plataforma de descoberta científica. Camada 1 (busca, navegação
científica) validada com testes reais. Camada 3 completa: autenticação,
onboarding, gestão de projetos, painel por perfil, coordenador com
workflow de aprovação, professor autossuficiente, criação/edição de
conteúdo, favoritos, e agora **setup inicial + papel Admin** — o
suficiente para vender isso como "um ResearchHub por universidade".

## Modelo de negócio: uma instância por universidade

Decisão tomada: em vez de multiuniversidade compartilhada num banco só,
**cada universidade cliente tem seu próprio projeto Supabase** (inicialmente
no plano grátis, com caminho de upgrade depois). Isso simplifica o
isolamento de dados (vantagem de venda para instituições, relevante para
LGPD) e evita construir multi-tenancy complexo antes de precisar.

### Provisionando uma universidade nova

1. Crie um projeto Supabase novo e vazio.
2. Rode **`supabase/install.sql`** — um único arquivo com tudo (schema +
   todas as políticas de RLS). Substitui colar 12 arquivos separados.
3. Configure as env vars do deploy (Vercel) apontando pra esse projeto.
4. Acesse o site, crie uma conta, vá em **`/configuracao`** — a primeira
   pessoa a fazer isso cadastra a universidade e vira **administrador**
   automaticamente. Não precisa editar SQL nem seed por universidade.
5. Como admin, crie o primeiro departamento em `/departamentos/novo`.
6. A partir daí, professores se cadastram sozinhos (`/professores/criar`),
   coordenadores também, e o site se popula organicamente.

`supabase/seed.sql` continua existindo, mas agora é **só para
desenvolvimento local** — dados fictícios de Cardiologia para testar sem
precisar cadastrar tudo manualmente. Uma universidade real nunca deveria
rodar esse arquivo.

### Papel Admin (novo)

- Dono da universidade (definido no momento do `/configuracao`)
- Cria e edita departamentos
- Vê contagem total de departamentos, professores e projetos
- **Segurança**: só é possível existir UM admin por instância, criado
  apenas durante o setup inicial (bootstrap). A policy de RLS impede
  qualquer pessoa de se autopromover a admin depois disso — precisa ter
  sido quem criou a universidade (fechamos uma brecha real: antes,
  tecnicamente qualquer pessoa logada podia trocar o próprio `role` via
  requisição direta ao Supabase).

## Papéis existentes hoje

| Papel | Como se torna | O que faz |
|---|---|---|
| Aluno | Cadastro direto | Busca, favorita, manifesta interesse, escolhe interesses |
| Professor | Cadastro + `/professores/criar` ou `/vincular` | Cria/edita projetos, linhas, laboratórios; aprova quando necessário |
| Coordenador | Cadastro + escolhe departamento | Aprova/rejeita projetos enviados pra revisão no departamento |
| Admin | Só via `/configuracao` (setup único) | Cria departamentos, dono da universidade |

## Estrutura das migrações SQL

1. `1_schema.sql` — todas as tabelas
2. `2_seed.sql` — dados fictícios, **só para dev local**
3. `3_rls.sql` — leitura pública
4. `4_auth.sql` — cada pessoa gerencia os próprios dados
5. `5_interests.sql` — aluno gerencia interesses
6. `6_projects.sql` — professor gerencia projetos; interesse registrado
7. `7_professor_selfcreate.sql` — professor cria perfil do zero
8. `8_coordinator.sql` — papel coordenador + workflow de aprovação
9. `9_research_content.sql` — professor cria linha/laboratório
10. `10_edit_content.sql` — edição de linha/laboratório
11. `11_saved_items.sql` — favoritos
12. `12_admin.sql` — setup inicial + papel admin
13. `13_publications.sql` — publicações científicas
14. `14_bulk_import.sql` — importação em massa de professores
15. `15_admin_dashboard.sql` — visão completa do admin
16. `16_fix_recursion.sql` — correção segura da policy de usuários
17. `17_coordinator_dashboard.sql` — visão completa do coordenador
18. `18_user_management.sql` — gestão institucional de usuários
19. `19_suspend_enforcement.sql` — bloqueio real de contas suspensas
- `install.sql` — **tudo acima (exceto seed) num arquivo só**, para
  provisionar clientes novos rapidamente

## Rodando localmente (desenvolvimento, com dados de exemplo)

1. Crie um projeto em [supabase.com](https://supabase.com) (gratuito).
2. No SQL Editor, rode nesta ordem: `1_schema.sql`, `2_seed.sql`, depois
   `3` até `19` em ordem numérica (ou use `install.sql` + rode `2_seed.sql`
   separadamente se quiser os dados de exemplo).
3. Em **Authentication → Providers → Email**, desmarque "Confirm email"
   enquanto testa.
4. Copie `.env.local.example` para `.env.local` e preencha com a URL e a
   anon key do seu projeto.
5. `npm install && npm run dev`

## Testando o setup de uma universidade nova (sem seed)

1. Rode `1_schema.sql` + `3` a `19` (pule o `2_seed.sql`) — ou simplesmente
   `install.sql`
2. Cadastre uma conta qualquer → acesse `/configuracao` → preencha o nome
   da universidade → confirme que você vira admin e cai no painel
3. Crie um departamento em `/departamentos/novo`
4. Teste a importação em massa: no departamento criado, clique em
   "Importar professores em massa", cole 2-3 linhas de exemplo, confirme
   a prévia e importe
5. Cadastre uma conta como Professor → `/professores/vincular` → confirme
   que os nomes importados aparecem na lista para reivindicar
6. Tente acessar `/configuracao` de novo (com uma outra conta) → confirme
   que redireciona pra home, já que o setup só roda uma vez

## Próximos passos possíveis

- ✅ ~~Publicações científicas~~ — feito. `/publicacoes/novo` (professor
  cadastra, vira autor automaticamente, pode vincular a um projeto
  próprio), `/publicacoes/[id]` (detalhe, com autores e projeto
  conectado), `/publicacoes/[id]/editar` (qualquer autor edita). Aparece
  no perfil do professor e na página do projeto vinculado.
- ✅ ~~Edição de dados institucionais da universidade pelo admin~~ —
  feito. `/universidade/editar`, link no painel do admin.
- ✅ ~~Importação em massa~~ — feito, mas de forma simples: colar texto
  (uma pessoa por linha, `Nome, email, especialidade`) em vez de upload
  de arquivo `.xlsx` de verdade — evita depender de bibliotecas de
  parsing de Excel no navegador. Em `/departamentos/[id]/importar`,
  acessível para o admin (qualquer departamento da própria universidade)
  ou o coordenador (só o próprio departamento). Os professores entram
  como "não reivindicados", exatamente como os do seed — cada um vincula
  a própria conta depois em `/professores/vincular`.
- ✅ ~~Notificações por e-mail~~ — feito, via [Resend](https://resend.com).
  Quando um aluno manifesta interesse, o professor responsável recebe um
  e-mail automático (`app/api/notify-interest/route.ts`, roda só no
  servidor — a API key nunca é exposta no navegador).

  **Configuração necessária (Vercel → Settings → Environment Variables):**
  - `RESEND_API_KEY` — pegue em [resend.com/api-keys](https://resend.com/api-keys)
  - `RESEND_FROM_EMAIL` — sem domínio verificado no Resend, deixe como
    `onboarding@resend.dev` (só entrega no e-mail da sua própria conta
    Resend, útil pra testar). Depois de verificar um domínio (Resend →
    Domains → Add Domain, com os registros DNS), troque para algo como
    `notificacoes@seudominio.com`
  - `NEXT_PUBLIC_SITE_URL` — a URL do seu deploy, usada no link dentro
    do e-mail

  Se essas variáveis não estiverem configuradas, o interesse continua
  sendo registrado normalmente — só não dispara o e-mail (falha
  silenciosa, não trava a ação principal do aluno).
- ✅ ~~Dashboard completo do admin~~ — feito. Antes o admin só via nome
  de departamento; agora o painel mostra: contagem geral (departamentos,
  professores, alunos, coordenadores, projetos, publicações, interesses
  manifestados), quantos projetos estão "Recrutando/Publicados", lista
  de departamentos com número de professores e projetos em cada um, um
  alerta de projetos aguardando aprovação em qualquer departamento
  (útil pra saber se algum ficou "esquecido" sem coordenador), e um feed
  de interesses recentes de toda a universidade — não só de um
  departamento. Exigiu 3 políticas de RLS novas (`15_admin_dashboard.sql`)
  para o admin enxergar dados que antes só dono/coordenador viam.

## Segurança de contas suspensas

Depois de executar `19_suspend_enforcement.sql`, uma conta suspensa é
bloqueada nas escritas pelo banco e direcionada para
`/conta-suspensa` pela aplicação. As rotas de login, recuperação de
senha e logout continuam acessíveis para evitar loops.

O arquivo também impede que usuários comuns alterem diretamente os
próprios campos de papel, status, universidade e departamento. Para
instalações novas, essa proteção já está consolidada em `install.sql`.

## Design

Direção intencional: "caderno de laboratório" — papel (`#FAFAF7`), tinta
(`#14213D`), teal científico (`#0F6E66`) como acento, serifada `Source Serif 4`
para display + `Inter` para UI + `IBM Plex Mono` para keywords/tags.
O elemento de assinatura é o **fio pontilhado** (`.thread` em `globals.css`)
que conecta os cards — reflete a filosofia central do produto: "organiza
relações, não documentos".
