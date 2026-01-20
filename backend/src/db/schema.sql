-- Create proposals table
create table public.proposals (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content jsonb default '{}'::jsonb,
  user_id uuid not null, -- In a real app, this would reference auth.users
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.proposals enable row level security;

-- Create policy to allow access to all for now (development only)
create policy "Allow all access" on public.proposals
for all using (true);
