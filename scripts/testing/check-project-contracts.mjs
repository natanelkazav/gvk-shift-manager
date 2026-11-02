/**
 * קובץ: scripts/testing/check-project-contracts.mjs
 * מטרה: בדיקת חוזי טיפוסים, קריאות RPC וקובצי תשתית הבדיקות מול מבנה הפרויקט.
 * מטרות עיקריות:
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import fs from 'node:fs';
import path from 'node:path';

// root — הנתון root בהקשר הפעולה.
const root = process.cwd();
// failures — הנתון failures בהקשר הפעולה.
const failures = [];
// warnings — הנתון warnings בהקשר הפעולה.
const warnings = [];

/**
 * פעולה walk: הנתון walk בהקשר הפעולה.
 * @param dir — הנתון dir בהקשר הפעולה.
 * @param predicate — הנתון predicate בהקשר הפעולה.
 */
const walk = (dir, predicate = () => true) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  // עיבוד כל פריט מתוך fs.readdirSync(dir, { withFileTypes: true }) בנפרד.
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
};

/**
 * פעולה read: הנתון read בהקשר הפעולה.
 * @param file — קובץ.
 */
const read = (file) => fs.readFileSync(file, 'utf8');
/**
 * פעולה rel: הנתון rel בהקשר הפעולה.
 * @param file — קובץ.
 */
const rel = (file) => path.relative(root, file).replaceAll('\\', '/');
/**
 * פעולה fail: הנתון fail בהקשר הפעולה.
 * @param message — הודעה.
 */
const fail = (message) => failures.push(message);
/**
 * פעולה warn: הנתון warn בהקשר הפעולה.
 * @param message — הודעה.
 */
const warn = (message) => warnings.push(message);

// srcFiles — קבצים.
const srcFiles = walk(path.join(root, 'src'), (f) => /\.(ts|tsx)$/.test(f));
// migrationFiles — קבצים.
const migrationFiles = walk(path.join(root, 'supabase', 'migrations'), (f) => f.endsWith('.sql')).sort();
// functionDirs — הנתון functionDirs בהקשר הפעולה.
const functionDirs = fs.existsSync(path.join(root, 'supabase', 'functions'))
  ? fs.readdirSync(path.join(root, 'supabase', 'functions'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

// 1) Every RPC referenced by frontend code must be represented by a migration.
// rpcNames — הנתון rpcNames בהקשר הפעולה; אוסף ערכים ייחודיים.
const rpcNames = new Set();
// עיבוד כל פריט מתוך srcFiles בנפרד.
for (const file of srcFiles) {
  const text = read(file);
  // עיבוד כל פריט מתוך text.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g) בנפרד.
  for (const match of text.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)) rpcNames.add(match[1]);
}

// sql — הנתון sql בהקשר הפעולה.
const sql = migrationFiles.map((f) => read(f)).join('\n');
// definedFunctions — הנתון definedFunctions בהקשר הפעולה; אוסף ערכים ייחודיים.
const definedFunctions = new Set();
// עיבוד כל פריט מתוך sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-zA-Z0-9_]+)/gi) בנפרד.
for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-zA-Z0-9_]+)/gi)) {
  definedFunctions.add(match[1]);
}
// missingMigrationRpcs — הנתון missingMigrationRpcs בהקשר הפעולה.
const missingMigrationRpcs = [...rpcNames].filter((name) => !definedFunctions.has(name)).sort();
// עיבוד כל פריט מתוך missingMigrationRpcs בנפרד.
for (const name of missingMigrationRpcs) {
  // message — הודעה.
  const message = `RPC used by frontend but not defined in migration history: ${name}`;
  if (process.env.GVK_STRICT_MIGRATION_CONTRACTS === '1') fail(message);
  else warn(message);
}

// 2) Every Edge Function invoked by frontend must have a local source directory.
// invokedFunctions — הנתון invokedFunctions בהקשר הפעולה; אוסף ערכים ייחודיים.
const invokedFunctions = new Set();
// עיבוד כל פריט מתוך srcFiles בנפרד.
for (const file of srcFiles) {
  const text = read(file);
  // עיבוד כל פריט מתוך text.matchAll(/\.functions\.invoke\(\s*['"]([^'"]+)['"]/g) בנפרד.
  for (const match of text.matchAll(/\.functions\.invoke\(\s*['"]([^'"]+)['"]/g)) invokedFunctions.add(match[1]);
}
// עיבוד כל פריט מתוך [...invokedFunctions].sort() בנפרד.
for (const name of [...invokedFunctions].sort()) {
  if (!functionDirs.includes(name)) fail(`Edge Function invoked by frontend but source directory is missing: ${name}`);
}

// 3) Critical role contract must stay aligned with the product.
// authTypeFile — אימות משתמשים / קובץ.
const authTypeFile = path.join(root, 'src', 'types', 'auth.ts');
if (fs.existsSync(authTypeFile)) {
  // authTypes — אימות משתמשים.
  const authTypes = read(authTypeFile);
  // עיבוד כל פריט מתוך ['admin', 'manager', 'dispatcher', 'on_call', 'morning_driver', 'viewer'] בנפרד.
  for (const role of ['admin', 'manager', 'dispatcher', 'on_call', 'morning_driver', 'viewer']) {
    if (!authTypes.includes(`'${role}'`)) fail(`UserRole is missing required role: ${role}`);
  }
} else fail('src/types/auth.ts is missing');

// 4) Critical schema fields required by current features.
// requiredSchemaTokens — הנתון requiredSchemaTokens בהקשר הפעולה.
const requiredSchemaTokens = [
  'is_intentionally_unassigned',
  'deactivated_at',
  'hourly_rate',
  'daily_duty_rate',
  'morning_shift_rate',
  'calendar_special_days',
];
// עיבוד כל פריט מתוך requiredSchemaTokens בנפרד.
for (const token of requiredSchemaTokens) {
  if (!sql.includes(token)) fail(`Migration history does not contain required schema token: ${token}`);
}

// 5) Known regressions that must never return in the effective code path.
// forbiddenSourceTokens — מקור.
const forbiddenSourceTokens = [
  ['public.morning_driver_schedule_period_status', 'Removed/nonexistent morning-driver status enum was referenced again.'],
];
// עיבוד כל פריט מתוך forbiddenSourceTokens בנפרד.
for (const [token, message] of forbiddenSourceTokens) {
  // עיבוד כל פריט מתוך srcFiles בנפרד.
  for (const file of srcFiles) {
    if (read(file).includes(token)) fail(`${message} (${rel(file)})`);
  }
}

// 6) Holiday importer/source contract.
// importFile — ייבוא / קובץ.
const importFile = path.join(root, 'supabase', 'functions', 'import-calendar-special-days', 'index.ts');
if (fs.existsSync(importFile)) {
  const importer = read(importFile);
  if (!importer.includes('calendar_special_days')) fail('Holiday importer no longer writes to calendar_special_days.');
} else fail('import-calendar-special-days Edge Function is missing');

// 7) Duplicate migration timestamps create ordering ambiguity.
// migrationPrefixMap — מפת התאמה; מיפוי לחיפוש לפי מפתח.
const migrationPrefixMap = new Map();
// עיבוד כל פריט מתוך migrationFiles בנפרד.
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
// עיבוד כל פריט מתוך [ 'docs/testing/TESTING_GUIDE.md', 'docs/testing/REGRESSION_MATRIX.md', 'supabase/tests/001_schema_contract.sq בנפרד.
for (const required of [
  'docs/testing/TESTING_GUIDE.md',
  'docs/testing/REGRESSION_MATRIX.md',
  'supabase/tests/001_schema_contract.sql',
]) {
  if (!fs.existsSync(path.join(root, required))) fail(`Testing infrastructure file is missing: ${required}`);
}

if (warnings.length) {
  console.log('\nWarnings:');
  // עיבוד כל פריט מתוך warnings בנפרד.
  for (const item of warnings) console.log(`  - ${item}`);
}

if (failures.length) {
  console.error('\nPROJECT CONTRACT CHECK FAILED');
  // עיבוד כל פריט מתוך failures בנפרד.
  for (const item of failures) console.error(`  ✗ ${item}`);
  process.exit(1);
}

console.log(`Project contracts OK: ${rpcNames.size} RPC usages, ${invokedFunctions.size} Edge Function usages, ${migrationFiles.length} migrations checked.`);
