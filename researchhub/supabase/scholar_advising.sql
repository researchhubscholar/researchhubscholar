-- RESEARCHHUB SCHOLAR — orientação, comentários, reuniões e versões
-- Execute após scholar_access.sql e scholar_productivity.sql.
begin;

create table if not exists public.scholar_advisor_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  email text,
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  check(email is null or length(email) between 3 and 320)
);

create table if not exists public.scholar_project_collaborators (
  project_id uuid not null references public.research_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'advisor' check(role='advisor'),
  active boolean not null default true,
  added_at timestamptz not null default now(),
  primary key(project_id,user_id)
);

create table if not exists public.scholar_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null check(section_key in ('general','question','objective','methods','analysis','ethics','writing')),
  body text not null check(length(trim(body)) between 2 and 4000),
  status text not null default 'open' check(status in ('open','resolved')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists scholar_project_comments_project_idx on public.scholar_project_comments(project_id,created_at desc);

create table if not exists public.scholar_advisor_meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null,
  title text not null check(length(trim(title)) between 2 and 160),
  notes text not null check(length(trim(notes)) between 2 and 10000),
  next_steps text check(next_steps is null or length(next_steps) <= 6000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scholar_advisor_meetings_project_idx on public.scholar_advisor_meetings(project_id,occurred_on desc);

create table if not exists public.scholar_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null check(length(trim(label)) between 2 and 120),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check(jsonb_typeof(snapshot)='object')
);
create index if not exists scholar_project_versions_project_idx on public.scholar_project_versions(project_id,created_at desc);

create or replace function public.scholar_is_project_advisor(p_project uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.scholar_project_collaborators where project_id=p_project and user_id=auth.uid() and active and role='advisor');
$$;

create or replace function public.scholar_can_access_advising(p_project uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.scholar_owns_project(p_project) or public.scholar_is_project_advisor(p_project);
$$;

alter table public.scholar_advisor_invites enable row level security;
alter table public.scholar_project_collaborators enable row level security;
alter table public.scholar_project_comments enable row level security;
alter table public.scholar_advisor_meetings enable row level security;
alter table public.scholar_project_versions enable row level security;

drop policy if exists "Scholar owner sees advisor invites" on public.scholar_advisor_invites;
create policy "Scholar owner sees advisor invites" on public.scholar_advisor_invites for select to authenticated
  using(public.scholar_owns_project(project_id));

drop policy if exists "Scholar advising collaborators visibility" on public.scholar_project_collaborators;
create policy "Scholar advising collaborators visibility" on public.scholar_project_collaborators for select to authenticated
  using(user_id=auth.uid() or public.scholar_owns_project(project_id));

drop policy if exists "Scholar advising comments read" on public.scholar_project_comments;
create policy "Scholar advising comments read" on public.scholar_project_comments for select to authenticated
  using(public.scholar_can_access_advising(project_id));
drop policy if exists "Scholar advising comments create" on public.scholar_project_comments;
create policy "Scholar advising comments create" on public.scholar_project_comments for insert to authenticated
  with check(author_id=auth.uid() and public.scholar_can_access_advising(project_id));

drop policy if exists "Scholar advising meetings read" on public.scholar_advisor_meetings;
create policy "Scholar advising meetings read" on public.scholar_advisor_meetings for select to authenticated
  using(public.scholar_can_access_advising(project_id));
drop policy if exists "Scholar advising meetings create" on public.scholar_advisor_meetings;
create policy "Scholar advising meetings create" on public.scholar_advisor_meetings for insert to authenticated
  with check(created_by=auth.uid() and public.scholar_can_access_advising(project_id));
drop policy if exists "Scholar advising meetings edit own" on public.scholar_advisor_meetings;
create policy "Scholar advising meetings edit own" on public.scholar_advisor_meetings for update to authenticated
  using(created_by=auth.uid() and public.scholar_can_access_advising(project_id))
  with check(created_by=auth.uid() and public.scholar_can_access_advising(project_id));

drop policy if exists "Scholar advising versions read" on public.scholar_project_versions;
create policy "Scholar advising versions read" on public.scholar_project_versions for select to authenticated
  using(public.scholar_can_access_advising(project_id));

drop policy if exists "Scholar advisor reads project" on public.research_projects;
create policy "Scholar advisor reads project" on public.research_projects for select to authenticated
  using(public.scholar_is_project_advisor(id));

create or replace function public.scholar_create_advisor_invite(p_project uuid,p_email text default null) returns text
language plpgsql security definer set search_path=public,extensions as $$
declare code text; normalized text;
begin
  if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
  normalized:=lower(nullif(trim(p_email),''));
  if normalized is not null and (length(normalized)<3 or length(normalized)>320) then raise exception 'E-mail inválido'; end if;
  update public.scholar_advisor_invites set revoked=true where project_id=p_project and redeemed_at is null and not revoked;
  code:=encode(gen_random_bytes(16),'hex');
  insert into public.scholar_advisor_invites(project_id,created_by,code_hash,email,expires_at)
  values(p_project,auth.uid(),encode(digest(lower(code),'sha256'),'hex'),normalized,now()+interval '14 days');
  return code;
end $$;

create or replace function public.scholar_redeem_advisor_invite(p_code text) returns uuid
language plpgsql security definer set search_path=public,extensions as $$
declare inv public.scholar_advisor_invites; who uuid:=auth.uid(); account_email text;
begin
  if who is null then raise exception 'Entre na sua conta'; end if;
  select * into inv from public.scholar_advisor_invites where code_hash=encode(digest(lower(trim(p_code)),'sha256'),'hex') for update;
  if inv.id is null or inv.revoked or inv.redeemed_at is not null or inv.expires_at<=now() then raise exception 'Convite inválido, expirado ou utilizado'; end if;
  if public.scholar_project_owner(inv.project_id)=who then raise exception 'O proprietário não pode ser o próprio orientador'; end if;
  select lower(email) into account_email from auth.users where id=who and email_confirmed_at is not null;
  if account_email is null or (inv.email is not null and inv.email<>account_email) then raise exception 'Confirme o e-mail autorizado para este convite'; end if;
  insert into public.scholar_project_collaborators(project_id,user_id,role,active) values(inv.project_id,who,'advisor',true)
  on conflict(project_id,user_id) do update set active=true,added_at=now();
  update public.scholar_advisor_invites set redeemed_by=who,redeemed_at=now() where id=inv.id;
  return inv.project_id;
end $$;

create or replace function public.scholar_revoke_advisor(p_project uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
  update public.scholar_project_collaborators set active=false where project_id=p_project and user_id=p_user and role='advisor';
  if not found then raise exception 'Orientador não encontrado'; end if;
end $$;

create or replace function public.scholar_resolve_project_comment(p_comment uuid,p_resolved boolean) returns void
language plpgsql security definer set search_path=public as $$
declare target public.scholar_project_comments;
begin
  select * into target from public.scholar_project_comments where id=p_comment;
  if target.id is null or not public.scholar_can_access_advising(target.project_id) then raise exception 'Comentário indisponível'; end if;
  update public.scholar_project_comments set status=case when p_resolved then 'resolved' else 'open' end,resolved_at=case when p_resolved then now() else null end,resolved_by=case when p_resolved then auth.uid() else null end where id=p_comment;
end $$;

create or replace function public.scholar_create_project_version(p_project uuid,p_label text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid; content jsonb;
begin
  if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
  if length(trim(p_label))<2 or length(trim(p_label))>120 then raise exception 'Identifique esta versão'; end if;
  select to_jsonb(p)-array['owner_id','created_at','updated_at'] into content from public.research_projects p where p.id=p_project;
  insert into public.scholar_project_versions(project_id,owner_id,label,snapshot) values(p_project,auth.uid(),trim(p_label),content) returning id into result;
  return result;
end $$;

create or replace function public.scholar_project_advisors(p_project uuid)
returns table(user_id uuid,name text,email text,active boolean,added_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.scholar_can_access_advising(p_project) then raise exception 'Projeto indisponível'; end if;
  return query select c.user_id,p.name,u.email,c.active,c.added_at from public.scholar_project_collaborators c join auth.users u on u.id=c.user_id left join public.profiles p on p.id=c.user_id where c.project_id=p_project order by c.added_at;
end $$;

drop trigger if exists scholar_advisor_meetings_updated on public.scholar_advisor_meetings;
create trigger scholar_advisor_meetings_updated before update on public.scholar_advisor_meetings
  for each row execute procedure public.set_updated_at();

revoke all on public.scholar_advisor_invites,public.scholar_project_collaborators,public.scholar_project_comments,public.scholar_advisor_meetings,public.scholar_project_versions from anon,authenticated;
grant select on public.scholar_advisor_invites,public.scholar_project_collaborators,public.scholar_project_comments,public.scholar_advisor_meetings,public.scholar_project_versions to authenticated;
grant insert on public.scholar_project_comments,public.scholar_advisor_meetings to authenticated;
grant update on public.scholar_advisor_meetings to authenticated;
grant execute on function public.scholar_create_advisor_invite(uuid,text),public.scholar_redeem_advisor_invite(text),public.scholar_revoke_advisor(uuid,uuid),public.scholar_resolve_project_comment(uuid,boolean),public.scholar_create_project_version(uuid,text),public.scholar_project_advisors(uuid) to authenticated;

commit;
