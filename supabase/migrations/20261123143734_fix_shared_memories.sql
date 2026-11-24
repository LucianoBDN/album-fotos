grant usage on schema public to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select on public.couple_pairs to authenticated;
grant execute on function public.is_couple_partner(uuid, uuid) to authenticated;

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
      user_a = least(first_user, second_user)
      and user_b = greatest(first_user, second_user)
  );
$$;

revoke all on function public.is_couple_partner(uuid, uuid) from public;
grant execute on function public.is_couple_partner(uuid, uuid) to authenticated;

alter table public.memories enable row level security;

drop policy if exists "Users can view their memories"
on public.memories;
drop policy if exists "Partners can view shared memories"
on public.memories;
drop policy if exists "Users can update their memories"
on public.memories;
drop policy if exists "Partners can update shared favorites"
on public.memories;
drop policy if exists "Users can create their memories"
on public.memories;
drop policy if exists "Users can delete their memories"
on public.memories;

create policy "Partners can view shared memories"
on public.memories
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_couple_partner(auth.uid(), user_id)
);

create policy "Users can create their memories"
on public.memories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Partners can update shared memories"
on public.memories
for update
to authenticated
using (
  auth.uid() = user_id
  or public.is_couple_partner(auth.uid(), user_id)
)
with check (
  auth.uid() = user_id
  or public.is_couple_partner(auth.uid(), user_id)
);

create policy "Users can delete their memories"
on public.memories
for delete
to authenticated
using (auth.uid() = user_id);

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
