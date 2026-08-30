// @claim:windows-installer
import { asset, candidateRelease, checksumMap, download, sha256, tag } from './release-proof-lib.mjs';

const release = await candidateRelease();
const proofAsset = asset(release, /^windows-consumer-proof\.json$/);
const proofBytes = await download(proofAsset);
const sums = checksumMap((await download(asset(release, /^SHA256SUMS$/))).toString('utf8'));
if (sums.get(proofAsset.name) !== sha256(proofBytes)) throw new Error('Windows consumer proof is not covered by SHA256SUMS.');
const proof = JSON.parse(proofBytes.toString('utf8'));
if (proof.tag !== tag || proof.commit !== release.target_commitish) throw new Error('Windows proof is not tied to the candidate release commit.');
if (proof.runner !== 'windows-latest' || proof.verifiedInstallerStarts !== 1 || proof.checksumMismatchStarts !== 0 || proof.installedAppLaunchSmoke !== true) {
  throw new Error('Windows consumer proof does not show one verified start, mismatch rejection, and installed-app launch.');
}
const installerAsset = asset(release, new RegExp(proof.installer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
if (sums.get(installerAsset.name) !== proof.sha256) throw new Error('Windows proof digest does not match the published installer checksum.');
console.log(`Windows installer consumer proof verified: ${proof.installer}; verified start=1; mismatch start=0; app launch=true`);
