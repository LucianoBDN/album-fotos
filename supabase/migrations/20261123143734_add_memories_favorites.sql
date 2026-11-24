alter table public.memories
  add column if not exists is_favorite boolean;

update public.memories
set is_favorite = false
where is_favorite is null;

alter table public.memories
  alter column is_favorite set default false,
  alter column is_favorite set not null;

create index if not exists memories_user_favorite_idx
  on public.memories (user_id, photo_date desc)
  where is_favorite = true;

drop policy if exists "Users can update their memories"
on public.memories;

create policy "Users can update their memories"
on public.memories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
