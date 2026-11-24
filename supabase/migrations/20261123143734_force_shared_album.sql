grant usage on schema public to authenticated;
grant select, insert, update, delete on public.memories to authenticated;

alter table public.memories enable row level security;

drop policy if exists "Users can view their memories"
on public.memories;
drop policy if exists "Partners can view shared memories"
on public.memories;
drop policy if exists "Users can update their memories"
on public.memories;
drop policy if exists "Partners can update shared memories"
on public.memories;
drop policy if exists "Partners can update shared favorites"
on public.memories;
drop policy if exists "Users can create their memories"
on public.memories;
drop policy if exists "Users can delete their memories"
on public.memories;

create policy "Authenticated users can view album memories"
on public.memories
for select
to authenticated
using (auth.uid() is not null);

create policy "Users can create album memories"
on public.memories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Authenticated users can update album favorites"
on public.memories
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "Users can delete their album memories"
on public.memories
for delete
to authenticated
using (auth.uid() = user_id);

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

drop policy if exists "Users can view their memory images"
on storage.objects;
drop policy if exists "Partners can view shared memory images"
on storage.objects;

create policy "Authenticated users can view album memory images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memories'
);

drop policy if exists "Users can upload memory images"
on storage.objects;

create policy "Users can upload memory images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their memory images"
on storage.objects;

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

drop policy if exists "Users can delete their memory images"
on storage.objects;

create policy "Users can delete their memory images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'memories'
  and (storage.foldername(name))[1] = auth.uid()::text
);
