-- Temori MVP schema. Apply with the Supabase SQL editor or CLI as the project owner.
-- Client code uses the publishable key and the authenticated user's JWT. Never
-- expose a service-role key to the browser.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '同学' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  group_number text not null unique check (group_number ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members(user_id);

create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);
create unique index one_pending_group_request
  on public.group_join_requests(group_id, user_id) where status = 'pending';
create index group_join_requests_group_status_idx
  on public.group_join_requests(group_id, status, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 20000),
  due_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  coordinator_id uuid not null default auth.uid() references public.profiles(id),
  -- NULL means the group owner is the final acceptor.
  acceptor_id uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'accepted', 'archived')),
  external_delivery_url text,
  external_delivery_note text,
  external_delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_group_created_idx on public.tasks(group_id, created_at desc);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  kind text not null default 'work' check (kind in ('work', 'discussion')),
  -- Only the task coordinator can mark a proposed Issue as required.
  is_required boolean not null default false,
  assignee_id uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  conclusion text check (conclusion is null or char_length(conclusion) <= 20000),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index issues_task_created_idx on public.issues(task_id, created_at desc);

create table public.issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index issue_comments_issue_created_idx
  on public.issue_comments(issue_id, created_at);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  kind text not null check (kind in ('issue', 'final')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'changes_requested', 'approved')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index submissions_task_created_idx on public.submissions(task_id, created_at desc);
-- A task has one final submission; revisions are new submission_versions rows.
create unique index one_final_submission_per_task
  on public.submissions(task_id) where kind = 'final';

create table public.submission_issues (
  submission_id uuid not null references public.submissions(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  primary key (submission_id, issue_id)
);
-- A work Issue has one submission; revisions are versions of that submission.
create unique index one_submission_per_issue
  on public.submission_issues(issue_id);

-- Only submit_version() can add rows. Old versions cannot be edited or deleted.
create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  summary text not null check (char_length(btrim(summary)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 50000),
  link_url text check (link_url is null or char_length(link_url) <= 2000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);
create unique index one_draft_version_per_submission
  on public.submission_versions(submission_id) where status = 'draft';

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version_id uuid not null unique references public.submission_versions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'changes_requested')),
  comment text not null default '' check (char_length(comment) <= 20000),
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index chat_messages_group_created_idx
  on public.chat_messages(group_id, created_at desc);

-- Reference files have submission_version_id NULL. Result files belong to a version.
-- Storage paths use <group_id>/<task_id>/<random-file-id>.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  submission_version_id uuid references public.submission_versions(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 1000),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type text,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index attachments_task_idx on public.attachments(task_id, created_at desc);

-- Keep the public profile in sync with creation of the Auth identity.
create function private.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(split_part(new.email, '@', 1), ''), '同学'), 80)
  ) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row
  execute function private.create_profile_for_auth_user();
insert into public.profiles(id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'display_name'), ''),
                         nullif(split_part(email, '@', 1), ''), '同学'), 80)
from auth.users on conflict (id) do nothing;

-- SECURITY DEFINER helpers bypass policy recursion, but inspect only the
-- caller's own membership. All object reads still have explicit RLS policies.
create function private.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  );
$$;
create function private.is_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.owner_id = (select auth.uid())
  );
$$;
create function private.is_member_id(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = p_user_id
  );
$$;
create function private.shares_group(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;
create function private.can_read_requester_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_join_requests r
    join public.groups g on g.id = r.group_id
    where r.user_id = p_user_id and g.owner_id = (select auth.uid())
      and r.status = 'pending'
  );
$$;
create function private.task_group_id(p_task_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.group_id from public.tasks t where t.id = p_task_id;
$$;
create function private.is_task_member(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    join public.group_members m on m.group_id = t.group_id
    where t.id = p_task_id and m.user_id = (select auth.uid())
  );
$$;
create function private.is_task_coordinator(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.coordinator_id = (select auth.uid())
  );
$$;
create function private.issue_task_id(p_issue_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select i.task_id from public.issues i where i.id = p_issue_id;
$$;
create function private.submission_task_id(p_submission_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.task_id from public.submissions s where s.id = p_submission_id;
$$;
create function private.version_task_id(p_version_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.task_id from public.submission_versions v
  join public.submissions s on s.id = v.submission_id
  where v.id = p_version_id;
$$;
create function private.can_access_storage_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    join public.tasks t on t.group_id = m.group_id
    where m.user_id = (select auth.uid())
      and m.group_id::text = split_part(p_path, '/', 1)
      and t.id::text = split_part(p_path, '/', 2)
      and split_part(p_path, '/', 3) <> ''
  );
$$;
create function private.can_upload_storage_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    join public.tasks t on t.group_id = m.group_id
    where m.user_id = (select auth.uid())
      and m.group_id::text = split_part(p_path, '/', 1)
      and t.id::text = split_part(p_path, '/', 2)
      and t.status = 'open'
      and split_part(p_path, '/', 3) <> ''
  );
$$;
create function private.can_attach_to_version(p_version_id uuid, p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submission_versions v
    join public.submissions s on s.id = v.submission_id
    join public.tasks t on t.id = s.task_id
    where v.id = p_version_id and s.task_id = p_task_id
      and s.status in ('draft', 'changes_requested')
      and v.status = 'draft' and t.status = 'open'
      and (s.created_by = (select auth.uid()) or t.coordinator_id = (select auth.uid()))
      and v.version_number = (
        select max(v2.version_number) from public.submission_versions v2
        where v2.submission_id = s.id
      )
  );
$$;

-- Lock the submission before registering a version file. publish_version()
-- takes the same lock, so a file cannot be attached after publication even if
-- an upload and publication happen concurrently.
create function private.validate_attachment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_submission_id uuid;
  v_submission public.submissions%rowtype;
  v_task public.tasks%rowtype;
  v_version public.submission_versions%rowtype;
begin
  if new.submission_version_id is not null then
    select v.submission_id into v_submission_id
      from public.submission_versions v where v.id = new.submission_version_id;
    if v_submission_id is null then raise exception '成果版本不存在'; end if;
    select * into v_submission from public.submissions
      where id = v_submission_id for update;
  end if;
  select * into v_task from public.tasks where id = new.task_id for update;
  if not found or v_task.status <> 'open' or v_task.group_id <> new.group_id
    then raise exception '大任务不可添加附件'; end if;
  if new.submission_version_id is not null then
    select * into v_version from public.submission_versions
      where id = new.submission_version_id for update;
    if v_submission.task_id <> new.task_id
      or v_submission.status not in ('draft', 'changes_requested')
      or v_version.status <> 'draft'
      or v_version.version_number <> (
        select max(v2.version_number) from public.submission_versions v2
        where v2.submission_id = v_submission.id
      )
      or auth.uid() not in (v_submission.created_by, v_task.coordinator_id)
      then raise exception '只能给当前草稿版本添加附件'; end if;
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'temori-files' and o.name = new.storage_path
      and o.owner_id = auth.uid()::text
  ) then raise exception '文件尚未上传到 Storage'; end if;
  return new;
end;
$$;
create trigger validate_attachment_before_insert
  before insert on public.attachments for each row
  execute function private.validate_attachment_insert();

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_group_member(uuid), private.is_group_owner(uuid),
  private.is_member_id(uuid, uuid), private.shares_group(uuid),
  private.can_read_requester_profile(uuid),
  private.task_group_id(uuid), private.is_task_member(uuid),
  private.is_task_coordinator(uuid), private.issue_task_id(uuid),
  private.submission_task_id(uuid), private.version_task_id(uuid),
  private.can_access_storage_path(text), private.can_upload_storage_path(text),
  private.can_attach_to_version(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.tasks enable row level security;
alter table public.issues enable row level security;
alter table public.issue_comments enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_issues enable row level security;
alter table public.submission_versions enable row level security;
alter table public.review_decisions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.attachments enable row level security;

revoke all on public.profiles, public.groups, public.group_members,
  public.group_join_requests, public.tasks, public.issues, public.issue_comments, public.submissions,
  public.submission_issues, public.submission_versions, public.review_decisions,
  public.chat_messages, public.attachments from public, anon, authenticated;
grant select on public.profiles, public.groups, public.group_members,
  public.group_join_requests, public.tasks, public.issues, public.issue_comments, public.submissions,
  public.submission_issues, public.submission_versions, public.review_decisions,
  public.chat_messages, public.attachments to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(group_id, title, description, due_at, created_by, coordinator_id)
  on public.tasks to authenticated;
grant update(title, description, due_at) on public.tasks to authenticated;
grant insert(task_id, title, body, kind, due_at, created_by)
  on public.issues to authenticated;
grant update(title, body, due_at) on public.issues to authenticated;
grant insert(issue_id, body) on public.issue_comments to authenticated;
grant insert(group_id, body) on public.chat_messages to authenticated;
grant insert(group_id, task_id, submission_version_id, storage_path,
  file_name, mime_type, size_bytes) on public.attachments to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group(id)
         or private.can_read_requester_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy groups_read_members on public.groups for select to authenticated
  using (private.is_group_member(id));
create policy group_members_read_members on public.group_members for select to authenticated
  using (private.is_group_member(group_id));
create policy join_requests_read_related on public.group_join_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_group_owner(group_id));
create policy tasks_read_members on public.tasks for select to authenticated
  using (private.is_group_member(group_id));
create policy tasks_create_members on public.tasks for insert to authenticated
  with check (
    private.is_group_member(group_id) and created_by = (select auth.uid())
    and coordinator_id = (select auth.uid()) and acceptor_id is null and status = 'open'
  );
create policy tasks_edit_coordinator on public.tasks for update to authenticated
  using (private.is_task_coordinator(id) and status = 'open')
  with check (private.is_task_coordinator(id) and status = 'open');
create policy issues_read_members on public.issues for select to authenticated
  using (private.is_task_member(task_id));
create policy issues_create_members on public.issues for insert to authenticated
  with check (
    private.is_task_member(task_id) and created_by = (select auth.uid())
    and assignee_id is null and reviewer_id is null and status = 'open'
    and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open')
  );
create policy issues_edit_author_or_coordinator on public.issues for update to authenticated
  using ((created_by = (select auth.uid()) or private.is_task_coordinator(task_id))
         and status in ('open', 'in_progress')
         and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open'))
  with check ((created_by = (select auth.uid()) or private.is_task_coordinator(task_id))
              and status in ('open', 'in_progress')
              and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open'));
create policy issue_comments_read_members on public.issue_comments for select to authenticated
  using (private.is_task_member(private.issue_task_id(issue_id)));
create policy issue_comments_create_members on public.issue_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_task_member(private.issue_task_id(issue_id))
    and exists (
      select 1 from public.issues i join public.tasks t on t.id = i.task_id
      where i.id = issue_id and i.status in ('open', 'in_progress') and t.status = 'open'
    )
  );
create policy submissions_read_members on public.submissions for select to authenticated
  using (private.is_task_member(task_id));
create policy submission_issues_read_members on public.submission_issues for select to authenticated
  using (private.is_task_member(private.submission_task_id(submission_id)));
create policy versions_read_members on public.submission_versions for select to authenticated
  using (private.is_task_member(private.submission_task_id(submission_id)));
create policy reviews_read_members on public.review_decisions for select to authenticated
  using (private.is_task_member(private.submission_task_id(submission_id)));
create policy chat_read_members on public.chat_messages for select to authenticated
  using (private.is_group_member(group_id));
create policy chat_create_members on public.chat_messages for insert to authenticated
  with check (private.is_group_member(group_id) and author_id = (select auth.uid()));
create policy attachments_read_members on public.attachments for select to authenticated
  using (private.is_group_member(group_id));
create policy attachments_create_members on public.attachments for insert to authenticated
  with check (
    private.is_group_member(group_id) and uploaded_by = (select auth.uid())
    and private.task_group_id(task_id) = group_id
    and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open')
    and (submission_version_id is null
         or private.can_attach_to_version(submission_version_id, task_id))
    and split_part(storage_path, '/', 1) = group_id::text
    and split_part(storage_path, '/', 2) = task_id::text
    and split_part(storage_path, '/', 3) <> ''
  );

-- All state-changing RPCs reject anonymous callers and check membership/role
-- themselves. This avoids trusting browser-supplied owner, reviewer, or status.
create function private.new_group_number()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  n integer;
begin
  for n in 1..6 loop
    result := result || substr(alphabet, floor(random() * char_length(alphabet))::integer + 1, 1);
  end loop;
  return result;
end;
$$;

create function public.create_group(p_name text, p_description text default '')
returns public.groups language plpgsql security definer set search_path = '' as $$
declare
  v_group public.groups%rowtype;
  n integer;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception '群组名称不能为空'; end if;
  for n in 1..10 loop
    begin
      insert into public.groups(group_number, name, description, owner_id)
      values (private.new_group_number(), btrim(p_name), coalesce(p_description, ''), auth.uid())
      returning * into v_group;
      exit;
    exception when unique_violation then
      if n = 10 then raise exception '群号生成失败，请重试'; end if;
    end;
  end loop;
  insert into public.group_members(group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');
  return v_group;
end;
$$;

create function public.search_group_by_number(p_group_number text)
returns table(id uuid, group_number text, name text, description text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  return query
    select g.id, g.group_number, g.name, g.description
    from public.groups g where g.group_number = upper(btrim(p_group_number));
end;
$$;

create function public.request_join_group(p_group_number text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_group_id uuid;
  v_request_id uuid;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select g.id into v_group_id from public.groups g
    where g.group_number = upper(btrim(p_group_number));
  if v_group_id is null then raise exception '群号不存在'; end if;
  if private.is_group_member(v_group_id) then raise exception '你已加入此群组'; end if;
  insert into public.group_join_requests(group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict (group_id, user_id) where status = 'pending'
  do update set status = 'pending'
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create function public.decide_join_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_request public.group_join_requests%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_request from public.group_join_requests
  where id = p_request_id for update;
  if not found then raise exception '申请不存在'; end if;
  if not private.is_group_owner(v_request.group_id) then raise exception '仅群主可审批加入申请'; end if;
  if v_request.status <> 'pending' then raise exception '申请已处理'; end if;
  if p_approve is null then raise exception '审批决定不能为空'; end if;
  update public.group_join_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        decided_at = now(), decided_by = auth.uid()
    where id = p_request_id;
  if p_approve then
    insert into public.group_members(group_id, user_id, role)
    values (v_request.group_id, v_request.user_id, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;
end;
$$;

create function public.set_task_acceptor(p_task_id uuid, p_acceptor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception '大任务不存在'; end if;
  if not private.is_group_owner(v_task.group_id) then raise exception '仅群主可指定验收负责人'; end if;
  if v_task.status <> 'open' then raise exception '当前任务不可修改验收负责人'; end if;
  if p_acceptor_id is not null and not private.is_member_id(v_task.group_id, p_acceptor_id)
    then raise exception '验收负责人必须是群组成员'; end if;
  update public.tasks set acceptor_id = p_acceptor_id where id = p_task_id;
end;
$$;

create function public.set_task_coordinator(p_task_id uuid, p_coordinator_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception '大任务不存在'; end if;
  if v_task.coordinator_id <> auth.uid() and not private.is_group_owner(v_task.group_id)
    then raise exception '仅任务负责人或群主可转交任务'; end if;
  if v_task.status <> 'open' then raise exception '当前任务不可转交'; end if;
  if not private.is_member_id(v_task.group_id, p_coordinator_id)
    then raise exception '任务负责人必须是群组成员'; end if;
  update public.tasks set coordinator_id = p_coordinator_id where id = p_task_id;
end;
$$;

create function public.set_issue_assignment(p_issue_id uuid, p_assignee_id uuid, p_reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_issue public.issues%rowtype;
  v_group_id uuid;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue 不存在'; end if;
  if not private.is_task_coordinator(v_issue.task_id)
    then raise exception '仅任务负责人可分配 Issue'; end if;
  if v_issue.status not in ('open', 'in_progress') then raise exception 'Issue 已结束'; end if;
  if (select t.status from public.tasks t where t.id = v_issue.task_id) <> 'open'
    then raise exception '大任务已结束'; end if;
  v_group_id := private.task_group_id(v_issue.task_id);
  if p_assignee_id is not null and not private.is_member_id(v_group_id, p_assignee_id)
    then raise exception '负责人必须是群组成员'; end if;
  if p_reviewer_id is not null and not private.is_member_id(v_group_id, p_reviewer_id)
    then raise exception '审阅人必须是群组成员'; end if;
  update public.issues set assignee_id = p_assignee_id,
    reviewer_id = p_reviewer_id,
    status = case when p_assignee_id is null then 'open' else 'in_progress' end
  where id = p_issue_id;
end;
$$;

create function public.set_issue_required(p_issue_id uuid, p_required boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_issue public.issues%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if p_required is null then raise exception '请指定 Issue 是否必需'; end if;
  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue 不存在'; end if;
  if not private.is_task_coordinator(v_issue.task_id)
    then raise exception '仅任务负责人可决定 Issue 是否必需'; end if;
  if v_issue.status not in ('open', 'in_progress')
    or (select t.status from public.tasks t where t.id = v_issue.task_id) <> 'open'
    then raise exception '已结束的 Issue 不可更改'; end if;
  update public.issues set is_required = p_required where id = p_issue_id;
end;
$$;

create function public.create_submission(
  p_task_id uuid, p_kind text, p_issue_ids uuid[] default '{}'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
  v_submission_id uuid;
  v_issue_count integer;
  v_reviewer_count integer;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_task from public.tasks where id = p_task_id;
  if not found then raise exception '大任务不存在'; end if;
  if not private.is_group_member(v_task.group_id) then raise exception '无权访问此群组'; end if;
  if v_task.status <> 'open' then raise exception '大任务已结束'; end if;
  if p_kind is null or p_kind not in ('issue', 'final')
    then raise exception '成果类型无效'; end if;
  if p_kind = 'final' and coalesce(cardinality(p_issue_ids), 0) <> 0
    then raise exception '最终成果无需关联 Issue'; end if;
  if p_kind = 'final' and exists (
    select 1 from public.submissions s where s.task_id = p_task_id and s.kind = 'final'
  ) then raise exception '此任务已有最终成果，请在原成果中继续审阅或添加新版本'; end if;
  if p_kind = 'issue' then
    if coalesce(cardinality(p_issue_ids), 0) = 0 then raise exception '请选择 Issue'; end if;
    select count(*), count(distinct i.reviewer_id)
      into v_issue_count, v_reviewer_count
    from public.issues i where i.id = any(p_issue_ids)
      and i.task_id = p_task_id and i.kind = 'work'
      and i.status in ('open', 'in_progress') and i.reviewer_id is not null;
    if v_issue_count <> cardinality(p_issue_ids) or v_reviewer_count <> 1
      then raise exception '关联的 Issue 必须属于此任务、未结束，且指定同一名审阅人'; end if;
    if exists (
      select 1 from public.submission_issues si where si.issue_id = any(p_issue_ids)
    ) then raise exception '某个 Issue 已有成果提交，请在原成果中添加新版本'; end if;
  end if;
  begin
    insert into public.submissions(task_id, kind, created_by)
      values (p_task_id, p_kind, auth.uid()) returning id into v_submission_id;
  exception when unique_violation then
    if p_kind = 'final' then
      raise exception '此任务已有最终成果，请在原成果中继续审阅或添加新版本';
    end if;
    raise;
  end;
  if p_kind = 'issue' then
    begin
      insert into public.submission_issues(submission_id, issue_id)
      select v_submission_id, unnest(p_issue_ids);
    exception when unique_violation then
      raise exception '某个 Issue 已有成果提交，请在原成果中添加新版本';
    end;
  end if;
  return v_submission_id;
end;
$$;

create function public.submit_version(
  p_submission_id uuid, p_summary text, p_body text default '', p_link_url text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.submissions%rowtype;
  v_task public.tasks%rowtype;
  v_version_id uuid;
  v_next_number integer;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then raise exception '成果提交不存在'; end if;
  select * into v_task from public.tasks where id = v_submission.task_id;
  if not private.is_group_member(v_task.group_id) then raise exception '无权访问此群组'; end if;
  if auth.uid() <> v_submission.created_by and auth.uid() <> v_task.coordinator_id
    then raise exception '仅提交者或任务负责人可上传新版本'; end if;
  if v_task.status <> 'open' or v_submission.status not in ('draft', 'changes_requested')
    then raise exception '当前成果不可提交新版本'; end if;
  if p_summary is null or btrim(p_summary) = '' then raise exception '请填写成果摘要'; end if;
  if exists (
    select 1 from public.submission_versions v
    where v.submission_id = p_submission_id and v.status = 'draft'
  ) then raise exception '已有未发布的草稿版本，请先完成上传并发布'; end if;
  if v_submission.kind = 'final' and exists (
    select 1 from public.issues i where i.task_id = v_task.id and i.is_required
      and i.status not in ('resolved', 'closed')
  ) then raise exception '必需的 Issue 尚未完成'; end if;
  select coalesce(max(version_number), 0) + 1 into v_next_number
    from public.submission_versions where submission_id = p_submission_id;
  insert into public.submission_versions(
    submission_id, version_number, summary, body, link_url, created_by
  ) values (
    p_submission_id, v_next_number, btrim(p_summary), coalesce(p_body, ''),
    nullif(btrim(p_link_url), ''), auth.uid()
  ) returning id into v_version_id;
  -- Leave the submission in draft/changes_requested until all files are
  -- uploaded, registered as attachments, and publish_version() is called.
  return v_version_id;
end;
$$;

create function public.publish_version(
  p_version_id uuid, p_expected_attachment_count integer default 0
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_submission_id uuid;
  v_submission public.submissions%rowtype;
  v_task public.tasks%rowtype;
  v_version public.submission_versions%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select v.submission_id into v_submission_id
    from public.submission_versions v where v.id = p_version_id;
  if v_submission_id is null then raise exception '草稿版本不存在'; end if;
  select * into v_submission from public.submissions
    where id = v_submission_id for update;
  select * into v_task from public.tasks where id = v_submission.task_id for update;
  select * into v_version from public.submission_versions
    where id = p_version_id for update;
  if not private.is_group_member(v_task.group_id) then raise exception '无权访问此群组'; end if;
  if auth.uid() <> v_submission.created_by and auth.uid() <> v_task.coordinator_id
    then raise exception '仅提交者或任务负责人可发布版本'; end if;
  if v_task.status <> 'open' or v_submission.status not in ('draft', 'changes_requested')
    or v_version.status <> 'draft'
    then raise exception '当前版本不可发布'; end if;
  if v_version.version_number <> (
    select max(v.version_number) from public.submission_versions v
    where v.submission_id = v_submission.id
  ) then raise exception '只能发布最新草稿版本'; end if;
  if p_expected_attachment_count is null or p_expected_attachment_count < 0
    then raise exception '预期附件数量无效'; end if;
  if (select count(*) from public.attachments a
      where a.submission_version_id = p_version_id) <> p_expected_attachment_count
    then raise exception '附件尚未全部上传并登记'; end if;
  if v_submission.kind = 'final' and exists (
    select 1 from public.issues i where i.task_id = v_task.id and i.is_required
      and i.status not in ('resolved', 'closed')
  ) then raise exception '必需的 Issue 尚未完成'; end if;
  update public.submission_versions set status = 'published' where id = p_version_id;
  update public.submissions set status = 'pending' where id = v_submission.id;
end;
$$;

create function public.review_submission(
  p_submission_id uuid, p_decision text, p_comment text default ''
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.submissions%rowtype;
  v_task public.tasks%rowtype;
  v_version_id uuid;
  v_review_id uuid;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if p_decision not in ('approved', 'changes_requested')
    then raise exception '审阅决定无效'; end if;
  if p_decision = 'changes_requested' and coalesce(btrim(p_comment), '') = ''
    then raise exception '要求修改时请填写原因'; end if;
  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then raise exception '成果提交不存在'; end if;
  select * into v_task from public.tasks where id = v_submission.task_id for update;
  if not private.is_group_member(v_task.group_id) then raise exception '无权访问此群组'; end if;
  if v_task.status <> 'open' or v_submission.status <> 'pending'
    then raise exception '当前成果不在待审阅状态'; end if;
  if v_submission.kind = 'final' then
    if auth.uid() <> coalesce(v_task.acceptor_id,
      (select g.owner_id from public.groups g where g.id = v_task.group_id))
      then raise exception '仅最终验收负责人可审阅'; end if;
    if p_decision = 'approved' and exists (
      select 1 from public.issues i where i.task_id = v_task.id and i.is_required
        and i.status not in ('resolved', 'closed')
    ) then raise exception '必需的 Issue 尚未完成'; end if;
  else
    if not exists (select 1 from public.submission_issues si
                   where si.submission_id = p_submission_id)
      or exists (
        select 1 from public.submission_issues si
        join public.issues i on i.id = si.issue_id
        where si.submission_id = p_submission_id
          and (i.reviewer_id is distinct from auth.uid()
               or i.status not in ('open', 'in_progress'))
      ) then raise exception '仅所有关联 Issue 的指定审阅人可审阅'; end if;
  end if;
  select v.id into v_version_id from public.submission_versions v
    where v.submission_id = p_submission_id and v.status = 'published'
    order by v.version_number desc limit 1;
  if v_version_id is null then raise exception '尚无待审阅版本'; end if;
  insert into public.review_decisions(
    submission_id, version_id, reviewer_id, decision, comment
  ) values (
    p_submission_id, v_version_id, auth.uid(), p_decision, coalesce(p_comment, '')
  ) returning id into v_review_id;
  update public.submissions set status = p_decision where id = p_submission_id;
  if v_submission.kind = 'issue' and p_decision = 'approved' then
    update public.issues set status = 'resolved' where id in (
      select si.issue_id from public.submission_issues si
      where si.submission_id = p_submission_id
    );
  elsif v_submission.kind = 'final' and p_decision = 'approved' then
    update public.tasks set status = 'accepted' where id = v_task.id;
  end if;
  return v_review_id;
end;
$$;

create function public.close_issue(p_issue_id uuid, p_conclusion text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_issue public.issues%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue 不存在'; end if;
  if not private.is_task_member(v_issue.task_id) then raise exception '无权访问此 Issue'; end if;
  if auth.uid() <> v_issue.created_by and not private.is_task_coordinator(v_issue.task_id)
    then raise exception '仅创建者或任务负责人可关闭 Issue'; end if;
  if v_issue.status in ('resolved', 'closed') then raise exception 'Issue 已结束'; end if;
  if v_issue.kind <> 'discussion' then raise exception '工作型 Issue 需由成果审阅通过'; end if;
  if (select t.status from public.tasks t where t.id = v_issue.task_id) <> 'open'
    then raise exception '大任务已结束'; end if;
  if coalesce(btrim(p_conclusion), '') = '' then raise exception '请填写结论'; end if;
  update public.issues set status = 'closed', conclusion = btrim(p_conclusion)
    where id = p_issue_id;
end;
$$;

create function public.record_external_delivery(
  p_task_id uuid, p_url text, p_note text default ''
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception '大任务不存在'; end if;
  if not private.is_group_member(v_task.group_id) then raise exception '无权访问此任务'; end if;
  if v_task.status <> 'accepted' then raise exception '最终验收通过后才能记录对外交付'; end if;
  if auth.uid() <> v_task.coordinator_id and auth.uid() <> coalesce(v_task.acceptor_id,
    (select g.owner_id from public.groups g where g.id = v_task.group_id))
    then raise exception '仅任务负责人或验收负责人可记录对外交付'; end if;
  update public.tasks set external_delivery_url = nullif(btrim(p_url), ''),
    external_delivery_note = coalesce(p_note, ''), external_delivered_at = now()
    where id = p_task_id;
end;
$$;

create function public.archive_task(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception '大任务不存在'; end if;
  if auth.uid() <> coalesce(v_task.acceptor_id,
    (select g.owner_id from public.groups g where g.id = v_task.group_id))
    then raise exception '仅最终验收负责人可归档'; end if;
  if v_task.status <> 'accepted' then raise exception '任务尚未验收通过'; end if;
  update public.tasks set status = 'archived' where id = p_task_id;
end;
$$;

revoke all on function private.new_group_number() from public, anon, authenticated;
revoke all on function public.create_group(text, text),
  public.search_group_by_number(text), public.request_join_group(text),
  public.decide_join_request(uuid, boolean), public.set_task_acceptor(uuid, uuid),
  public.set_task_coordinator(uuid, uuid), public.set_issue_assignment(uuid, uuid, uuid),
  public.set_issue_required(uuid, boolean),
  public.create_submission(uuid, text, uuid[]), public.submit_version(uuid, text, text, text),
  public.publish_version(uuid, integer),
  public.review_submission(uuid, text, text), public.close_issue(uuid, text),
  public.record_external_delivery(uuid, text, text), public.archive_task(uuid)
  from public, anon;
grant execute on function public.create_group(text, text),
  public.search_group_by_number(text), public.request_join_group(text),
  public.decide_join_request(uuid, boolean), public.set_task_acceptor(uuid, uuid),
  public.set_task_coordinator(uuid, uuid), public.set_issue_assignment(uuid, uuid, uuid),
  public.set_issue_required(uuid, boolean),
  public.create_submission(uuid, text, uuid[]), public.submit_version(uuid, text, text, text),
  public.publish_version(uuid, integer),
  public.review_submission(uuid, text, text), public.close_issue(uuid, text),
  public.record_external_delivery(uuid, text, text), public.archive_task(uuid)
  to authenticated;

-- Supabase Storage bucket: private files, maximum 25 MiB each. The path's first
-- two segments bind every object to an existing group/task; only members can read
-- or upload. Storage policies are separate from public.attachments policies.
insert into storage.buckets(id, name, public, file_size_limit)
values ('temori-files', 'temori-files', false, 26214400)
on conflict (id) do nothing;
create policy temori_files_read_members on storage.objects for select to authenticated
  using (bucket_id = 'temori-files' and private.can_access_storage_path(name));
create policy temori_files_upload_members on storage.objects for insert to authenticated
  with check (bucket_id = 'temori-files' and private.can_upload_storage_path(name));

-- Realtime listens to new group chat messages; table RLS still filters rows.
alter publication supabase_realtime add table public.chat_messages;
