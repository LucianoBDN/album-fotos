grant usage on schema public to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;

alter table public.chat_messages enable row level security;

drop policy if exists "Senders can delete their chat messages"
on public.chat_messages;

create policy "Senders can delete their chat messages"
on public.chat_messages
for delete
to authenticated
using (auth.uid() = sender_id);
