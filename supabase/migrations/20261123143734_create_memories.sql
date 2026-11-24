create table if not exists public.memory_categories (
  id smallint primary key generated always as identity,
  name text not null unique,
  slug text not null unique
);

insert into public.memory_categories (name, slug)
values
  ('Vacaciones', 'vacaciones'),
  ('Familia', 'familia'),
  ('Pareja', 'pareja'),
  ('Amigos', 'amigos'),
  ('Mascotas', 'mascotas'),
  ('Cumpleaños', 'cumpleanos'),
  ('Aniversarios', 'aniversarios'),
  ('Otro', 'otro')
on conflict (slug) do nothing;

alter table public.memory_categories enable row level security;

drop policy if exists "Authenticated users can view memory categories"
on public.memory_categories;

create policy "Authenticated users can view memory categories"
on public.memory_categories
for select
to authenticated
using (true);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  category_id smallint not null
    references public.memory_categories(id),

  title text,
  description text,
  dedication text,
  is_favorite boolean not null default false,

  image_key text not null,
  image_type text not null,
  image_size bigint not null
    check (image_size > 0),

  photo_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memories
  add column if not exists is_favorite boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memories'
      and column_name = 'memory_date'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memories'
      and column_name = 'photo_date'
  ) then
    alter table public.memories rename column memory_date to photo_date;
  end if;
end;
$$;

create index if not exists memories_user_photo_date_idx
  on public.memories (user_id, photo_date desc);

create index if not exists memories_user_category_idx
  on public.memories (user_id, category_id);

alter table public.memories enable row level security;

drop policy if exists "Users can view their memories"
on public.memories;

drop policy if exists "Users can create their memories"
on public.memories;

drop policy if exists "Users can update their memories"
on public.memories;

drop policy if exists "Users can delete their memories"
on public.memories;

create policy "Users can view their memories"
on public.memories
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their memories"
on public.memories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their memories"
on public.memories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their memories"
on public.memories
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memories_set_updated_at on public.memories;

create trigger memories_set_updated_at
before update on public.memories
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view their memory images"
on storage.objects;

drop policy if exists "Users can upload memory images"
on storage.objects;

drop policy if exists "Users can update their memory images"
on storage.objects;

drop policy if exists "Users can delete their memory images"
on storage.objects;

create policy "Users can view their memory images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload memory images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their memory images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their memory images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create table if not exists public.couple_pairs (
  id uuid primary key default gen_random_uuid(),

  user_a uuid not null
    references auth.users(id) on delete cascade,

  user_b uuid not null
    references auth.users(id) on delete cascade,

  created_at timestamptz not null default now(),
  relationship_started_at timestamptz,
  relationship_accepted_by uuid
    references auth.users(id) on delete set null,

  constraint couple_pairs_different_users
    check (user_a <> user_b),

  constraint couple_pairs_ordered
    check (user_a < user_b),

  constraint couple_pairs_unique
    unique (user_a, user_b)
);

alter table public.couple_pairs enable row level security;

drop policy if exists "Users can view their couple"
on public.couple_pairs;

create policy "Users can view their couple"
on public.couple_pairs
for select
to authenticated
using (
  auth.uid() = user_a
  or auth.uid() = user_b
);

create or replace function public.is_couple_partner(first_user uuid, second_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.couple_pairs
    where
      (user_a = least(first_user, second_user)
       and user_b = greatest(first_user, second_user))
  );
$$;

revoke all on function public.is_couple_partner(uuid, uuid) from public;
grant execute on function public.is_couple_partner(uuid, uuid) to authenticated;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),

  sender_id uuid not null
    references auth.users(id) on delete cascade,

  recipient_id uuid not null
    references auth.users(id) on delete cascade,

  content text not null
    check (char_length(btrim(content)) between 1 and 4000),

  sent_at timestamptz not null default now(),
  read_at timestamptz,

  constraint chat_messages_different_users
    check (sender_id <> recipient_id)
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (
    sender_id,
    recipient_id,
    sent_at desc
  );

create index if not exists chat_messages_recipient_unread_idx
  on public.chat_messages (recipient_id, sent_at desc)
  where read_at is null;

alter table public.chat_messages enable row level security;

drop policy if exists "Users can view their chat messages"
on public.chat_messages;

drop policy if exists "Users can send chat messages"
on public.chat_messages;

drop policy if exists "Recipients can mark chat messages as read"
on public.chat_messages;

drop policy if exists "Senders can delete their chat messages"
on public.chat_messages;

create policy "Users can view their chat messages"
on public.chat_messages
for select
to authenticated
using (
  (
    auth.uid() = sender_id
    or auth.uid() = recipient_id
  )
  and public.is_couple_partner(sender_id, recipient_id)
);

create policy "Users can send chat messages"
on public.chat_messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.is_couple_partner(sender_id, recipient_id)
);

create policy "Recipients can mark chat messages as read"
on public.chat_messages
for update
to authenticated
using (auth.uid() = recipient_id)
with check (
  auth.uid() = recipient_id
  and public.is_couple_partner(sender_id, recipient_id)
);

create policy "Senders can delete their chat messages"
on public.chat_messages
for delete
to authenticated
using (auth.uid() = sender_id);

create or replace function public.protect_chat_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.sender_id is distinct from old.sender_id
      or new.recipient_id is distinct from old.recipient_id
      or new.content is distinct from old.content
      or new.sent_at is distinct from old.sent_at
    then
      raise exception 'Chat message content and participants cannot be changed';
    end if;

    if new.read_at is not null
      and old.read_at is null
      and new.read_at < old.sent_at
    then
      raise exception 'Invalid read timestamp';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.sender_id <> auth.uid() then
      raise exception 'Only the sender can delete a chat message';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists chat_messages_protect on public.chat_messages;

create trigger chat_messages_protect
before update or delete on public.chat_messages
for each row
execute function public.protect_chat_message();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;

grant usage on schema public to authenticated;

grant select on public.memory_categories to authenticated;
grant select on public.memories to authenticated;
grant insert, update, delete on public.memories to authenticated;

grant select on public.couple_pairs to authenticated;

grant select, insert, update, delete on public.chat_messages to authenticated;

grant usage, select on sequence public.memory_categories_id_seq to authenticated;

drop policy if exists "Users can view their memories"
on public.memories;
drop policy if exists "Partners can view shared memories"
on public.memories;

create policy "Partners can view shared memories"
on public.memories
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_couple_partner(auth.uid(), user_id)
);

drop policy if exists "Users can view their memory images"
on storage.objects;
drop policy if exists "Partners can view shared memory images"
on storage.objects;

create policy "Partners can view shared memory images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memories'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_couple_partner(
      auth.uid(),
      (storage.foldername(name))[1]::uuid
    )
  )
);
