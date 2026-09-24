# ResearchHub Scholar

Plataforma para estudantes de medicina, residentes e programas de residência estruturarem a produção científica — da ideia à busca de literatura, organização das evidências, execução do projeto e orientação.

O Scholar é um produto independente do ResearchHub institucional antigo. O código ativo usa Supabase próprio e é publicado em [researchhubscholar.vercel.app](https://researchhubscholar.vercel.app/).

## Estado atual

- cadastro, confirmação de e-mail e recuperação de senha;
- onboarding e diagnóstico de viabilidade por regras;
- gerador estruturado e comparação de ideias;
- Radar com PubMed, Crossref e localização legal de texto aberto por Unpaywall, Europe PMC e SciELO;
- biblioteca, matriz de evidências e exportações;
- jornada do projeto com etapas e checklists;
- colaboração com orientadores;
- licenças individuais e programas de residência;
- estrutura de franquia e auditoria de consumo pronta para futura IA;
- landing page, Radar público limitado e formulário de contato.

IA e cobrança ainda não estão ativas.

## Desenvolvimento local

Requisitos: Node.js 20+ e um projeto Supabase Scholar configurado.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL e a chave publicável do seu projeto. Nunca coloque a `service_role` em variável `NEXT_PUBLIC_*`.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

O build exige as variáveis públicas do Supabase. No CI e na Vercel elas devem vir do ambiente, não do repositório.

## Banco de dados

Os arquivos ativos estão em [`supabase/`](supabase/). A sequência, dependências e regras para bancos novos ou existentes estão em [`supabase/README.md`](supabase/README.md).

Os arquivos numerados (`1_schema.sql` a `20_scholar.sql`) e `install.sql` pertencem ao produto institucional anterior. Eles são mantidos apenas como histórico e **não devem ser executados** no Supabase do Scholar.

## Variáveis de ambiente

Veja [`.env.example`](.env.example). Para produção, configure as variáveis nos ambientes Production e Preview da Vercel.

## Publicação

O deploy de produção deve sair da branch principal do repositório exclusivo do Scholar. Antes de publicar:

1. execute lint, typecheck, testes e build;
2. confira as variáveis do ambiente de destino;
3. valide cadastro, login, Radar, Biblioteca e persistência de um projeto;
4. publique primeiro em Preview e depois promova o mesmo commit para Production.

## Princípios de segurança

- identidade baseada diretamente em `auth.users.id`;
- RLS habilitada nas tabelas do Scholar;
- dados científicos privados por padrão;
- compartilhamento institucional e com orientador exige vínculo explícito;
- APIs científicas autenticadas; somente o Radar demonstrativo é público e limitado;
- chaves privadas e credenciais administrativas nunca chegam ao navegador.
