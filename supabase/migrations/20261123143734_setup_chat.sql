grant usage on schema public to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;

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
  auth.uid() = sender_id
  or auth.uid() = recipient_id
);

create policy "Users can send chat messages"
on public.chat_messages
for insert
to authenticated
with check (auth.uid() = sender_id);

create policy "Recipients can mark chat messages as read"
on public.chat_messages
for update
to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

create policy "Senders can delete their chat messages"
on public.chat_messages
for delete
to authenticated
using (auth.uid() = sender_id);

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
