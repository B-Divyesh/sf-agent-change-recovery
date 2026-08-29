import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const sourceUrl = 'https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/b5eb8d05b4c0ed40107fe2158c5d8527f94568ef/linuxdeploy-plugin-gtk.sh';
const sourceSha256 = 'cb379f9b0733e9ad9f8bd78f8c2fa038aef2478523bb7d4c8e64ff6a1ea3501a';
const patchMarker = '# Change Recovery Ledger: idempotent GTK module links';

if (process.platform === 'linux') {
  const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  const toolsDir = join(cacheHome, 'tauri');
  const pluginPath = join(toolsDir, 'linuxdeploy-plugin-gtk.sh');

  let existing = '';
  try {
    existing = await readFile(pluginPath, 'utf8');
  } catch {
    // Tauri creates this tool cache on demand. The directory is created below.
  }

  if (!existing.startsWith('#!') || !existing.includes(patchMarker)) {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Could not fetch the pinned linuxdeploy GTK helper (${response.status}).`);
    }
    const source = await response.text();
    const receivedSha256 = createHash('sha256').update(source).digest('hex');
    if (receivedSha256 !== sourceSha256) {
      throw new Error('Pinned linuxdeploy GTK helper checksum did not match.');
    }

    const patched = source.replace(
      'ln $verbose -s "${file/\\/usr\\/lib\\//}" "$APPDIR/usr/lib"',
      'ln $verbose -s -f "${file/\\/usr\\/lib\\//}" "$APPDIR/usr/lib"',
    );
    if (patched === source) {
      throw new Error('Pinned linuxdeploy GTK helper did not contain the expected module-link command.');
    }

    await mkdir(toolsDir, { recursive: true });
    const temporaryPath = `${pluginPath}.tmp`;
    const executable = patched.replace('#! /usr/bin/env bash', `#! /usr/bin/env bash\n${patchMarker}`);
    await writeFile(temporaryPath, executable, { mode: 0o755 });
    await rename(temporaryPath, pluginPath);
    await chmod(pluginPath, 0o755);
  }
}
