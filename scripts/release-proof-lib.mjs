import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const repo = 'B-Divyesh/sf-agent-change-recovery';
export const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
export const tag = `v${version}`;

export async function github(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'change-recovery-ledger-claim-test' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${path} returned ${response.status}`);
  return response;
}

export async function candidateRelease() {
  const release = await (await github(`/releases/tags/${tag}`)).json();
  if (release.tag_name !== tag || release.draft || release.prerelease) throw new Error(`Published candidate ${tag} is unavailable.`);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== release.target_commitish) {
    const comparison = await (await github(`/compare/${release.target_commitish}...${head}`)).json();
    if (comparison.status !== 'ahead' && comparison.status !== 'identical') throw new Error('Published release commit is not an ancestor of this source tree.');
  }
  return release;
}

export function asset(release, pattern) {
  const found = release.assets.find(item => pattern.test(item.name));
  if (!found) throw new Error(`Missing release asset matching ${pattern}.`);
  return found;
}

export async function download(releaseAsset) {
  const response = await fetch(releaseAsset.browser_download_url, { headers: { 'User-Agent': 'change-recovery-ledger-claim-test' } });
  if (!response.ok) throw new Error(`Download ${releaseAsset.name} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export function checksumMap(text) {
  return new Map(text.trim().split(/\r?\n/).map(line => {
    const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (!match) throw new Error(`Invalid SHA256SUMS line: ${line}`);
    return [match[2], match[1].toLowerCase()];
  }));
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
