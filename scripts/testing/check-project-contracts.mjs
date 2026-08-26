import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

const walk = (dir, predicate = () => true) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
};

const read = (file) => fs.readFileSync(file, 'utf8');
const rel = (file) => path.relative(root, file).replaceAll('\\', '/');
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

const srcFiles = walk(path.join(root, 'src'), (f) => /\.(ts|tsx)$/.test(f));
const migrationFiles = walk(path.join(root, 'supabase', 'migrations'), (f) => f.endsWith('.sql')).sort();
const functionDirs = fs.existsSync(path.join(root, 'supabase', 'functions'))
  ? fs.readdirSync(path.join(root, 'supabase', 'functions'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

// 1) Every RPC referenced by frontend code must be represented by a migration.
const rpcNames = new Set();
for (const file of srcFiles) {
  const text = read(file);
  for (const match of text.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)) rpcNames.add(match[1]);
}

const sql = migrationFiles.map((f) => read(f)).join('\n');
const definedFunctions = new Set();
for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-zA-Z0-9_]+)/gi)) {
  definedFunctions.add(match[1]);
}
const missingMigrationRpcs = [...rpcNames].filter((name) => !definedFunctions.has(name)).sort();
for (const name of missingMigrationRpcs) {
  const message = `RPC used by frontend but not defined in migration history: ${name}`;
  if (process.env.GVK_STRICT_MIGRATION_CONTRACTS === '1') fail(message);
  else warn(message);
}

// 2) Every Edge Function invoked by frontend must have a local source directory.
const invokedFunctions = new Set();
for (const file of srcFiles) {
  const text = read(file);
  for (const match of text.matchAll(/\.functions\.invoke\(\s*['"]([^'"]+)['"]/g)) invokedFunctions.add(match[1]);
}
for (const name of [...invokedFunctions].sort()) {
  if (!functionDirs.includes(name)) fail(`Edge Function invoked by frontend but source directory is missing: ${name}`);
}

// 3) Critical role contract must stay aligned with the product.
const authTypeFile = path.join(root, 'src', 'types', 'auth.ts');
if (fs.existsSync(authTypeFile)) {
  const authTypes = read(authTypeFile);
  for (const role of ['admin', 'manager', 'dispatcher', 'on_call', 'morning_driver', 'viewer']) {
    if (!authTypes.includes(`'${role}'`)) fail(`UserRole is missing required role: ${role}`);
  }
} else fail('src/types/auth.ts is missing');

// 4) Critical schema fields required by current features.
const requiredSchemaTokens = [
  'is_intentionally_unassigned',
  'deactivated_at',
  'hourly_rate',
  'daily_duty_rate',
  'morning_shift_rate',
  'calendar_special_days',
];
for (const token of requiredSchemaTokens) {
  if (!sql.includes(token)) fail(`Migration history does not contain required schema token: ${token}`);
}

// 5) Known regressions that must never return in the effective code path.
const forbiddenSourceTokens = [
  ['public.morning_driver_schedule_period_status', 'Removed/nonexistent morning-driver status enum was referenced again.'],
];
for (const [token, message] of forbiddenSourceTokens) {
  for (const file of srcFiles) {
    if (read(file).includes(token)) fail(`${message} (${rel(file)})`);
  }
}

// 6) Holiday importer/source contract.
const importFile = path.join(root, 'supabase', 'functions', 'import-calendar-special-days', 'index.ts');
if (fs.existsSync(importFile)) {
  const importer = read(importFile);
  if (!importer.includes('calendar_special_days')) fail('Holiday importer no longer writes to calendar_special_days.');
} else fail('import-calendar-special-days Edge Function is missing');

// 7) Duplicate migration timestamps create ordering ambiguity.
const migrationPrefixMap = new Map();
for (const file of migrationFiles) {
  const base = path.basename(file);
  const prefix = base.match(/^(\d{14})_/)?.[1];
  if (!prefix) {
    warn(`Migration does not use a 14-digit timestamp prefix: ${base}`);
    continue;
  }
  if (migrationPrefixMap.has(prefix)) {
    fail(`Duplicate migration timestamp ${prefix}: ${migrationPrefixMap.get(prefix)} and ${base}`);
  } else migrationPrefixMap.set(prefix, base);
}

// 8) Required operational docs/tests should not silently disappear.
for (const required of [
  'docs/testing/TESTING_GUIDE.md',
  'docs/testing/REGRESSION_MATRIX.md',
  'supabase/tests/001_schema_contract.sql',
]) {
  if (!fs.existsSync(path.join(root, required))) fail(`Testing infrastructure file is missing: ${required}`);
}

if (warnings.length) {
  console.log('\nWarnings:');
  for (const item of warnings) console.log(`  - ${item}`);
}

if (failures.length) {
  console.error('\nPROJECT CONTRACT CHECK FAILED');
  for (const item of failures) console.error(`  ✗ ${item}`);
  process.exit(1);
}

console.log(`Project contracts OK: ${rpcNames.size} RPC usages, ${invokedFunctions.size} Edge Function usages, ${migrationFiles.length} migrations checked.`);
