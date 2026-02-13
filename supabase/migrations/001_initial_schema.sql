-- Enable pgvector extension (placeholder for Phase 3 semantic search)
create extension if not exists vector;

-- Memory type enum
create type memory_type as enum ('rule', 'document', 'api_contract');

-- Projects table: org-level container
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Memories table: rules, docs, API contracts
create table memories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  memory_type memory_type not null,
  rule_id text,
  title text not null,
  category text,
  description text,
  confidence numeric(3,2) default 1.0,
  usage_count integer default 0,
  content jsonb default '{}',
  embedding vector(1536),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Insights table: captured learnings
create table insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  context text not null,
  insights jsonb not null default '[]',
  source text,
  tags text[] default '{}',
  metadata jsonb default '{}',
  embedding vector(1536),
  created_at timestamptz default now() not null
);

-- Indexes
create index idx_memories_project_id on memories(project_id);
create index idx_memories_category on memories(category);
create index idx_memories_memory_type on memories(memory_type);
create index idx_memories_rule_id on memories(rule_id);
create index idx_insights_project_id on insights(project_id);

-- RLS (enabled with service-role-bypass policies)
alter table projects enable row level security;
alter table memories enable row level security;
alter table insights enable row level security;

-- Service role bypass policies
create policy "Service role full access on projects" on projects for all using (true);
create policy "Service role full access on memories" on memories for all using (true);
create policy "Service role full access on insights" on insights for all using (true);

-- updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_projects_updated_at before update on projects
  for each row execute function update_updated_at_column();

create trigger update_memories_updated_at before update on memories
  for each row execute function update_updated_at_column();
