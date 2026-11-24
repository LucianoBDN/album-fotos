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

drop policy if exists "Users can view their memories"
on public.memories;

drop policy if exists "Users can update their memories"
on public.memories;

create policy "Partners can view shared memories"
on public.memories
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_couple_partner(auth.uid(), user_id)
);

create policy "Partners can update shared favorites"
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

drop policy if exists "Users can view their memory images"
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

drop policy if exists "Partners can update shared favorites"
on public.memories;

create policy "Partners can update shared favorites"
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

grant select, insert, update, delete on public.memories to authenticated;

create or replace function public.protect_shared_memory_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() <> old.user_id
    and (
      new.user_id is distinct from old.user_id
      or new.category_id is distinct from old.category_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.dedication is distinct from old.dedication
      or new.image_key is distinct from old.image_key
      or new.image_type is distinct from old.image_type
      or new.image_size is distinct from old.image_size
      or new.photo_date is distinct from old.photo_date
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'Partners can only change the favorite state';
  end if;

  return new;
end;
$$;

drop trigger if exists memories_protect_partner_update on public.memories;

create trigger memories_protect_partner_update
before update on public.memories
for each row
execute function public.protect_shared_memory_update();
