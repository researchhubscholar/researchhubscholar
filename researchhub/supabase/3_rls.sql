-- ============================================================
-- RLS — trava a anon key para SOMENTE LEITURA
-- ============================================================
-- Rode isso ANTES de divulgar a URL pública (Vercel) para alunos.
-- Sem isso, a anon key (que fica exposta no navegador) consegue
-- inserir/editar/apagar direto na API do Supabase.
--
-- Depois de rodar: você continua editando dados normalmente pelo
-- SQL Editor (que roda como admin e ignora RLS). O app só precisa
-- de leitura, então nada quebra.
-- ============================================================

alter table universities enable row level security;
alter table campuses enable row level security;
alter table departments enable row level security;
alter table laboratories enable row level security;
alter table research_lines enable row level security;
alter table professors enable row level security;
alter table projects enable row level security;
alter table professor_research_lines enable row level security;
alter table professor_laboratories enable row level security;
alter table laboratory_research_lines enable row level security;

-- Tabelas que o app ainda não usa na UI, mas já protege por padrão
alter table users enable row level security;
alter table students enable row level security;
alter table project_members enable row level security;
alter table publications enable row level security;
alter table publication_authors enable row level security;
alter table publication_projects enable row level security;
alter table opportunities enable row level security;
alter table interests enable row level security;
alter table saved_items enable row level security;
alter table announcements enable row level security;
alter table documents enable row level security;
alter table tags enable row level security;
alter table entity_tags enable row level security;

-- Leitura pública apenas nas tabelas que o app de fato consulta
create policy "Leitura pública" on universities for select using (true);
create policy "Leitura pública" on campuses for select using (true);
create policy "Leitura pública" on departments for select using (true);
create policy "Leitura pública" on laboratories for select using (true);
create policy "Leitura pública" on research_lines for select using (true);
create policy "Leitura pública" on professors for select using (true);
create policy "Leitura pública" on projects for select using (true);
create policy "Leitura pública" on professor_research_lines for select using (true);
create policy "Leitura pública" on professor_laboratories for select using (true);
create policy "Leitura pública" on laboratory_research_lines for select using (true);

-- As demais ficam com RLS ligado e SEM policy — ou seja, bloqueadas
-- por completo via anon key, até que tenham UI própria e regras
-- de acesso pensadas (isso é Camada 3, mais adiante no roadmap).
