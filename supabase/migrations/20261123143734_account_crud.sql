alter table public.memory_categories enable row level security;

drop policy if exists "Authenticated users can view memory categories"
on public.memory_categories;

create policy "Authenticated users can view memory categories"
on public.memory_categories
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create memory categories"
on public.memory_categories;

create policy "Authenticated users can create memory categories"
on public.memory_categories
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update memory categories"
on public.memory_categories;

create policy "Authenticated users can update memory categories"
on public.memory_categories
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can delete memory categories"
on public.memory_categories;

create policy "Authenticated users can delete memory categories"
on public.memory_categories
for delete
to authenticated
using (auth.uid() is not null);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.memory_categories to authenticated;
grant usage, select on sequence public.memory_categories_id_seq to authenticated;
