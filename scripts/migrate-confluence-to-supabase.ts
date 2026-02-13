/**
 * Migration script: Confluence → Supabase
 *
 * Reads rules from Confluence via AtlassianDataStore.fetchRules(),
 * then batch-inserts them into Supabase's `memories` table.
 *
 * Usage:
 *   npx tsx scripts/migrate-confluence-to-supabase.ts
 *
 * Required env vars (both data store configs):
 *   CONFLUENCE_BASE_URL, CONFLUENCE_USERNAME, CONFLUENCE_API_TOKEN, CONFLUENCE_SPACE_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { AtlassianDataStore } from '../src/datastore/atlassian-datastore.js';
import { CodifierSupabaseClient } from '../src/datastore/supabase-client.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log('=== Confluence → Supabase Migration ===\n');

  // --- Source: Confluence ---
  const confluenceStore = new AtlassianDataStore({
    baseUrl: requireEnv('CONFLUENCE_BASE_URL'),
    username: requireEnv('CONFLUENCE_USERNAME'),
    apiToken: requireEnv('CONFLUENCE_API_TOKEN'),
    spaceKey: requireEnv('CONFLUENCE_SPACE_KEY'),
    rulesPageTitle: process.env.RULES_PAGE_TITLE ?? 'Rules',
    insightsParentPageTitle: process.env.INSIGHTS_PARENT_PAGE_TITLE ?? 'Memory Insights',
  });

  console.log('Initializing Confluence connection...');
  await confluenceStore.initialize();

  console.log('Fetching rules from Confluence...');
  const { rules, totalCount } = await confluenceStore.fetchRules({});
  console.log(`  Found ${totalCount} rules\n`);

  if (rules.length === 0) {
    console.log('No rules to migrate. Done.');
    return;
  }

  // --- Destination: Supabase ---
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabaseClient = new CodifierSupabaseClient({
    url: supabaseUrl,
    serviceRoleKey: supabaseKey,
  });

  console.log('Verifying Supabase connectivity...');
  const healthy = await supabaseClient.healthCheck();
  if (!healthy) {
    console.error('Supabase health check failed. Aborting.');
    process.exit(1);
  }

  const client = supabaseClient.getClient();

  // Ensure a project exists
  const projectName = process.env.PROJECT_NAME ?? 'default';
  let projectId: string;

  const { data: existingProject } = await client
    .from('projects')
    .select('id')
    .eq('name', projectName)
    .limit(1)
    .single();

  if (existingProject) {
    projectId = existingProject.id;
    console.log(`Using existing project: ${projectId} ("${projectName}")`);
  } else {
    const { data: newProject, error } = await client
      .from('projects')
      .insert({ name: projectName })
      .select('id')
      .single();

    if (error || !newProject) {
      console.error('Failed to create project:', error?.message);
      process.exit(1);
    }
    projectId = newProject.id;
    console.log(`Created project: ${projectId} ("${projectName}")`);
  }

  // --- Migrate rules ---
  console.log('\nMigrating rules...');
  let migrated = 0;
  let errors = 0;

  for (const rule of rules) {
    try {
      const { error } = await client.from('memories').insert({
        project_id: projectId,
        memory_type: 'rule',
        rule_id: rule.id,
        title: rule.title,
        category: rule.category,
        description: rule.description,
        confidence: rule.confidence ?? 1.0,
        usage_count: rule.metadata?.usageCount ?? 0,
        content: {
          patterns: rule.patterns ?? [],
          antipatterns: rule.antipatterns ?? [],
          examples: rule.examples ?? [],
          tags: rule.metadata?.tags ?? [],
          metadata: rule.metadata ?? {},
        },
      });

      if (error) {
        console.error(`  [ERROR] Rule ${rule.id}: ${error.message}`);
        errors++;
      } else {
        console.log(`  [OK] ${rule.id} — ${rule.title}`);
        migrated++;
      }
    } catch (err) {
      console.error(`  [ERROR] Rule ${rule.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Migration Complete ===');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Time:     ${elapsed}s`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
