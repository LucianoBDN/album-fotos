alter table public.couple_pairs
  add column if not exists relationship_started_at timestamptz,
  add column if not exists relationship_accepted_by uuid
  references auth.users(id) on delete set null;

drop policy if exists "Users can update their couple"
on public.couple_pairs;

create policy "Users can update their couple"
on public.couple_pairs
for update
to authenticated
using (
  auth.uid() = user_a
  or auth.uid() = user_b
)
with check (
  auth.uid() = user_a
  or auth.uid() = user_b
);

grant select, update on public.couple_pairs to authenticated;
