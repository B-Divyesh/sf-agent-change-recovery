import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const sourceUrl = 'https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/b5eb8d05b4c0ed40107fe2158c5d8527f94568ef/linuxdeploy-plugin-gtk.sh';
const sourceSha256 = 'cb379f9b0733e9ad9f8bd78f8c2fa038aef2478523bb7d4c8e64ff6a1ea3501a';
const patchMarker = '# Change Recovery Ledger: isolated GTK/GIO runtime v2';
const hookStart = '#! /usr/bin/env bash\n\ngsettings get';
const safeHookStart = [
  '#! /usr/bin/env bash',
  '',
  '# The app has an explicit single-mode theme and does not need a host dconf backend.',
  'export GSETTINGS_BACKEND=memory',
  '',
  'gsettings get'
].join('\n');
const gioIsolationPatch = [
  '',
  '# Keep the bundled GLib from loading newer, ABI-incompatible host GIO modules.',
  'gio_modulesdir="$("$PKG_CONFIG" --variable="giomoduledir" "gio-2.0")"',
  'relative_gio_modulesdir="${gio_modulesdir#/}"',
  'bundled_gio_modulesdir="${relative_gio_modulesdir/\\//\\/\\/}"',
  'if [ "${#gio_modulesdir}" -ne "${#bundled_gio_modulesdir}" ]; then',
  '    echo "$0: refusing an unsafe variable-length GIO module path patch" >&2',
  '    exit 1',
  'fi',
  'patched_gio_libraries=0',
  'while IFS= read -r -d \'\' library; do',
  '    sed -i "s|$gio_modulesdir|$bundled_gio_modulesdir|g" "$library"',
  '    if grep -aF "$gio_modulesdir" "$library" >/dev/null; then',
  '        echo "$0: bundled GIO library still references host modules: $library" >&2',
  '        exit 1',
  '    fi',
  '    patched_gio_libraries=$((patched_gio_libraries + 1))',
  'done < <(find "$APPDIR/usr/lib" -type f -name \'libgio-2.0.so*\' -print0)',
  'if [ "$patched_gio_libraries" -eq 0 ]; then',
  '    echo "$0: no bundled GIO library was available to patch" >&2',
  '    exit 1',
  'fi',
  ''
].join('\n');

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

    const patchedLinks = source.replace(
      'ln $verbose -s "${file/\\/usr\\/lib\\//}" "$APPDIR/usr/lib"',
      'ln $verbose -s -f "${file/\\/usr\\/lib\\//}" "$APPDIR/usr/lib"',
    );
    if (patchedLinks === source) {
      throw new Error('Pinned linuxdeploy GTK helper did not contain the expected module-link command.');
    }
    const patchedHook = patchedLinks.replace(hookStart, safeHookStart);
    if (patchedHook === patchedLinks) {
      throw new Error('Pinned linuxdeploy GTK helper did not contain the expected AppRun hook.');
    }

    await mkdir(toolsDir, { recursive: true });
    const temporaryPath = `${pluginPath}.tmp`;
    const executable = `${patchedHook.replace('#! /usr/bin/env bash', `#! /usr/bin/env bash\n${patchMarker}`)}${gioIsolationPatch}`;
    await writeFile(temporaryPath, executable, { mode: 0o755 });
    await rename(temporaryPath, pluginPath);
    await chmod(pluginPath, 0o755);
  }
}
