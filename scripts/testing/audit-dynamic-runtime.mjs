/**
 * קובץ: scripts/testing/audit-dynamic-runtime.mjs
 * מטרה: בדיקה ובקרת תקינות עבור יומן שינויים / דינמי.
 * מטרות עיקריות:
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// This list is intentionally explicit: these files form the reusable product
// runtime and may not branch on GVK's historical role identifiers.
// files — קבצים.
const files = [
  'src/components/dashboard/DynamicDashboard.tsx',
  'src/pages/MyDynamicAvailabilityPage.tsx',
  'src/pages/MyDynamicShiftsPage.tsx',
  'src/pages/MyDynamicShiftExchangesPage.tsx',
  'src/services/dynamicRuntimeService.ts',
  'src/services/dynamicSchedulingService.ts',
  'src/types/dynamicRuntime.ts',
];

// forbidden — הנתון forbidden בהקשר הפעולה.
const forbidden = [
  { name: 'legacy dispatcher role', pattern: /['"]dispatcher['"]/ },
  { name: 'legacy on-call role', pattern: /['"]on_call['"]/ },
  { name: 'legacy morning-driver role', pattern: /['"]morning_driver['"]/ },
  { name: 'profile.role legacy branch', pattern: /profile\.role\s*===?\s*['"](?:dispatcher|on_call|morning_driver)['"]/ },
  { name: 'legacy schedule_group branch', pattern: /schedule_group\s*===?\s*['"](?:dispatcher|on_call|morning_driver)['"]/ },
];

// violations — הנתון violations בהקשר הפעולה.
const violations = [];
// missing — הנתון missing בהקשר הפעולה.
const missing = [];
// עיבוד כל פריט מתוך files בנפרד.
for (const file of files) {
  const absolute = resolve(process.cwd(), file);
  if (!existsSync(absolute)) {
    missing.push(file);
    continue;
  }
  const lines = readFileSync(absolute, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    // עיבוד כל פריט מתוך forbidden בנפרד.
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) {
        violations.push(`${file}:${index + 1} [${rule.name}] ${line.trim()}`);
      }
    }
  });
}

if (missing.length) {
  console.error('Dynamic runtime audit configuration references missing files:\n' + missing.join('\n'));
  process.exit(1);
}
if (violations.length) {
  console.error('Dynamic runtime contains GVK legacy-role hard-coding:\n' + violations.join('\n'));
  process.exit(1);
}
console.log(`Dynamic cutover boundary audit passed (${files.length} generic runtime files checked).`);
