# Banco do ResearchHub Scholar

Esta pasta ainda contém o SQL histórico do ResearchHub institucional. No Supabase exclusivo do Scholar, use apenas os arquivos cujo nome começa com `scholar_`.

## Instalação nova

Para um projeto Supabase vazio, execute no SQL Editor, uma vez e nesta ordem:

1. `scholar_install.sql` — perfil, projetos, biblioteca, matriz, histórico e versões de ideias;
2. `scholar_access.sql` — organizações, turmas, licenças, franquias e compartilhamento;
3. `scholar_productivity.sql` — buscas salvas, jornada, biblioteca avançada e preparação para IA;
4. `scholar_phase1_journey.sql` — diagnóstico e personalização do onboarding;
5. `scholar_radar_upgrade.sql` — estratégia e configuração avançada das buscas;
6. `scholar_library_upgrade.sql` — vínculos múltiplos entre artigos e projetos;
7. `scholar_journey_checklist.sql` — checklist e progresso das etapas;
8. `scholar_advising.sql` — orientadores, comentários, reuniões e versões;
9. `scholar_public.sql` — limite do Radar público e solicitações de contato.
10. `scholar_library_duplicates.sql` — união transacional de registros duplicados da Biblioteca.
11. `scholar_search_alerts.sql` — linha de base e central privada de novas publicações.
12. `scholar_account_support.sql` — conta, exportação, exclusão agendada e suporte privado.
13. `scholar_operations.sql` — telemetria mínima, erros e painel operacional restrito.

`scholar_idea_history.sql` é uma migração de compatibilidade para instalações antigas. A instalação atual já contém essa estrutura; não a execute novamente em uma instalação nova.

## Banco já instalado

Não rode novamente a sequência inteira. Alguns arquivos usam `create table` e foram desenhados para execução única. Registre quais migrações já foram aplicadas e execute somente uma migração nova, depois de revisar sua dependência e testar em Preview.

## Verificação mínima após uma migração

1. o SQL Editor deve retornar `Success`;
2. confirme que RLS permanece habilitada nas tabelas criadas;
3. crie ou use uma conta de teste, salve um projeto e um artigo;
4. saia e entre novamente para confirmar persistência;
5. confirme que outra conta não consegue ler nem alterar esses registros;
6. valide o fluxo afetado no deploy de Preview antes de promover para produção.

## Regras

- nunca execute `install.sql` nem os arquivos numerados no banco do Scholar;
- nunca exponha a chave `service_role` no navegador ou na Vercel como `NEXT_PUBLIC_*`;
- toda tabela com dados de usuário deve ter RLS e políticas testadas;
- mudanças futuras devem ser adicionadas em novos arquivos de migração, sem editar uma migração já aplicada em produção.
