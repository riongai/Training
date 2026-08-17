-- Run this once in Supabase: left sidebar -> SQL Editor -> New query -> paste -> Run.

create table if not exists training (
  id         text primary key,
  doc        jsonb not null,
  updated_at timestamptz not null default now()
);

alter table training enable row level security;

-- Anyone holding the anon key (i.e. anyone with the app link) may read and write
-- the shared log. That matches how the app already worked: the link is the secret.
drop policy if exists training_read  on training;
drop policy if exists training_write on training;
drop policy if exists training_edit  on training;

create policy training_read  on training for select using (true);
create policy training_write on training for insert with check (true);
create policy training_edit  on training for update using (true) with check (true);
