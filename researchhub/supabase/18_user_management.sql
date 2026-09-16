-- ============================================================
-- Admin gerencia usuários (item novo)
-- ============================================================
-- Rode depois de 17_coordinator_dashboard.sql.
--
-- Até agora, trocar o papel de alguém (promover a coordenador,
-- rebaixar, suspender uma conta) só era possível mexendo direto no
-- SQL Editor. Isso dá ao admin uma forma de fazer isso pela interface.
--
-- Restrição de propósito: essa policy NUNCA permite promover alguém a
-- 'admin' — isso preserva a regra de "um admin só por instância",
-- criada como bootstrap único em 12_admin.sql. Só quem passou pelo
-- /configuracao original é admin; não existe caminho para criar um
-- segundo depois disso.

create policy "Admin gerencia usuários" on users
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin() and role <> 'admin');
