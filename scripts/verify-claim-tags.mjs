import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const claims = JSON.parse(readFileSync('.factory/claims.json', 'utf8'));
const ids = claims.map(item => item.id);
if (new Set(ids).size !== ids.length) throw new Error('claims.json contains duplicate IDs.');
const files = execFileSync('rg', ['--files', 'src', 'src-tauri', 'tests', 'scripts'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const source = files.map(file => readFileSync(file, 'utf8')).join('\n');
const found = [...source.matchAll(/@claim:([a-z0-9-]+)/g)].map(match => match[1]);
for (const id of ids) {
  const count = found.filter(value => value === id).length;
  if (count !== 1) throw new Error(`@claim:${id} occurs ${count} times; expected exactly one.`);
}
const unlisted = [...new Set(found.filter(id => !ids.includes(id)))];
if (unlisted.length) throw new Error(`Unlisted claim tags: ${unlisted.join(', ')}`);
console.log(`claim tags verified: ${ids.length} claims, exactly one matching tag each`);
