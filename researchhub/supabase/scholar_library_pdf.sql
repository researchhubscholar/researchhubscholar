begin;
-- Private PDF attachments; object names are <user UUID>/<article UUID>.pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-pdfs', 'library-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists library_pdf_insert on storage.objects;
create policy library_pdf_insert on storage.objects for insert to authenticated
with check (bucket_id = 'library-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$');

drop policy if exists library_pdf_select on storage.objects;
create policy library_pdf_select on storage.objects for select to authenticated
using (bucket_id = 'library-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists library_pdf_delete on storage.objects;
create policy library_pdf_delete on storage.objects for delete to authenticated
using (bucket_id = 'library-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Keep existing deletion guards intact; only the authorized claim can defer PDF cleanup.
create or replace function public.scholar_deletion_blockers(p_user uuid, p_skip_library_pdfs boolean) returns text[]
language plpgsql security definer set search_path=public as $$
declare reasons text[]:='{}'; owned boolean; col text; inspected boolean:=false;
begin
 if not exists(select 1 from auth.users where id=p_user and length(trim(coalesce(email,'')))>0) then reasons:=array_append(reasons,'IDENTITY_REVIEW_REQUIRED'); end if;
 if exists(select 1 from public.scholar_platform_admins where user_id=p_user) then reasons:=array_append(reasons,'PLATFORM_STAFF'); end if;
 if exists(select 1 from public.scholar_memberships m where m.user_id=p_user and m.active and m.role='director'
  and not exists(select 1 from public.scholar_memberships other where other.organization_id=m.organization_id and other.user_id<>p_user and other.active and other.role='director')) then reasons:=array_append(reasons,'SOLE_DIRECTOR'); end if;
 if exists(select 1 from public.scholar_usage where user_id=p_user and status='reserved') then reasons:=array_append(reasons,'ACTIVE_OPERATION'); end if;
 -- Do not alter retained/restricted records as a side effect of account cleanup.
 if to_regclass('public.scholar_payment_events') is not null then
  execute 'select exists(select 1 from public.scholar_payment_events e join public.scholar_purchase_requests p on p.id=e.purchase_request_id where p.requester_id=$1)' into owned using p_user;
  if owned then reasons:=array_append(reasons,'RESTRICTED_DEPENDENCIES'); end if;
 end if;
 if to_regclass('public.scholar_coupon_redemptions') is not null then
  execute 'select exists(select 1 from public.scholar_coupon_redemptions r join public.scholar_purchase_requests p on p.id=r.purchase_request_id where r.user_id=$1 or p.requester_id=$1)' into owned using p_user;
  if owned and not ('RESTRICTED_DEPENDENCIES'=any(reasons)) then reasons:=array_append(reasons,'RESTRICTED_DEPENDENCIES'); end if;
 end if;
 if to_regclass('storage.objects') is not null then
  for col in select column_name from information_schema.columns where table_schema='storage' and table_name='objects' and column_name in ('owner_id','owner') loop
   inspected:=true;
   execute format('select exists(select 1 from storage.objects o where %I::text=$1 and not ($2 and coalesce(to_jsonb(o)->>''bucket_id'','''')=''library-pdfs'' and split_part(coalesce(to_jsonb(o)->>''name'',''''),''/'',1)=$1))',col) into owned using p_user::text,p_skip_library_pdfs;
   if owned then reasons:=array_append(reasons,'STORAGE_OBJECTS'); exit; end if;
  end loop;
  if not inspected then reasons:=array_append(reasons,'STORAGE_REVIEW_REQUIRED'); end if;
 end if;
 return reasons;
end $$;
revoke all on function public.scholar_deletion_blockers(uuid,boolean) from public,anon,authenticated;
create or replace function public.scholar_deletion_claim(p_actor uuid,p_request uuid,p_confirmation text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare req public.scholar_account_requests; run public.scholar_account_deletion_runs; email text; reasons text[];
begin
 perform public.scholar_deletion_require_owner(p_actor);
 -- Cancellation and claim serialize on this row. No work is started by installation.
 select * into req from public.scholar_account_requests where id=p_request for update;
 select * into run from public.scholar_account_deletion_runs where request_id=p_request for update;
 if found and run.state='completed' then return jsonb_build_object('state','completed','requestId',p_request); end if;
 if run.state='processing' then raise exception 'DELETION_BUSY'; end if;
 if req.id is null or req.status<>'pending' then raise exception 'DELETION_NOT_PENDING'; end if;
 if req.owner_id=p_actor then raise exception 'DELETION_SELF_BLOCKED'; end if;
 if now()<greatest(req.scheduled_for,req.requested_at+interval '7 days') then raise exception 'DELETION_TOO_EARLY'; end if;
 select u.email into email from auth.users u where u.id=req.owner_id;
 if email is null or lower(trim(email))<>lower(trim(coalesce(p_confirmation,''))) then raise exception 'DELETION_CONFIRMATION_REQUIRED'; end if;
 reasons:=public.scholar_deletion_blockers(req.owner_id,true);
 if cardinality(reasons)>0 then raise exception 'DELETION_BLOCKED'; end if;
 insert into public.scholar_account_deletion_runs(request_id,user_id,actor_id,state) values(p_request,req.owner_id,p_actor,'processing')
 on conflict(request_id) do update set actor_id=excluded.actor_id,state='processing',attempts=scholar_account_deletion_runs.attempts+1,started_at=now(),finished_at=null,error_code=null;
 update public.scholar_account_requests set status='processing' where id=p_request;
 return jsonb_build_object('state','processing','requestId',p_request,'userId',req.owner_id,'cleanupLibraryPdfs',true);
end $$;
commit;
