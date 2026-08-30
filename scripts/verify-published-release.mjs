// @claim:release-platforms
import { asset, candidateRelease, checksumMap, download, sha256, tag } from './release-proof-lib.mjs';

const release = await candidateRelease();
const sumsAsset = asset(release, /^SHA256SUMS$/);
const manifestAsset = asset(release, /^latest\.json$/);
const sums = checksumMap((await download(sumsAsset)).toString('utf8'));
const manifest = JSON.parse((await download(manifestAsset)).toString('utf8'));
if (manifest.tag !== tag || manifest.version !== tag.slice(1)) throw new Error('latest.json does not identify the candidate version.');
const manifestNames = new Set(manifest.assets.map(item => item.name));

const platformAssets = [
  asset(release, /(?:aarch64|arm64).*\.dmg$/i),
  asset(release, /x64-setup\.exe$|\.msi$/i),
  asset(release, /_amd64\.deb$/i)
];
for (const releaseAsset of platformAssets) {
  if (!manifestNames.has(releaseAsset.name)) throw new Error(`${releaseAsset.name} is absent from latest.json.`);
  const expected = sums.get(releaseAsset.name);
  if (!expected) throw new Error(`${releaseAsset.name} is absent from SHA256SUMS.`);
  const actual = sha256(await download(releaseAsset));
  if (actual !== expected) throw new Error(`${releaseAsset.name} failed SHA-256 verification.`);
}
console.log(`published release verified: ${tag}; macOS, Windows, and Linux artifacts match SHA256SUMS and latest.json`);
