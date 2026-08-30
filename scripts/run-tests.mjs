// Einfacher Test-Runner: führt alle tests/*.test.mjs aus und schlägt fehl,
// sobald eine Datei mit Exit-Code != 0 endet. Wird in CI vor dem Deploy genutzt.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests');
const files = readdirSync(testsDir).filter((f) => f.endsWith('.test.mjs')).sort();

let failed = 0;
for (const f of files) {
  const res = spawnSync(process.execPath, [join(testsDir, f)], { stdio: 'inherit' });
  if (res.status !== 0) {
    failed++;
    console.error(`✗ FAIL ${f}`);
  } else {
    console.log(`✓ PASS ${f}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} Test-Dateien bestanden`);
process.exit(failed ? 1 : 0);
