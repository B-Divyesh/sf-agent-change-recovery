import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const claims = JSON.parse(readFileSync('.factory/claims.json', 'utf8'));
for (const [index, claim] of claims.entries()) {
  console.log(`\n[${index + 1}/${claims.length}] ${claim.id}: ${claim.test}`);
  const result = spawnSync('/bin/sh', ['-lc', claim.test], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`\nAll ${claims.length} claim commands passed.`);
