#!/bin/sh
set -eu

repo="B-Divyesh/sf-agent-change-recovery"
case "$(uname -s)" in
  Darwin) pattern='\.dmg$' ;;
  Linux) pattern='\.AppImage$' ;;
  *) echo "Use install.ps1 for Windows." >&2; exit 1 ;;
esac

release="$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest")"
url="$(printf '%s' "$release" | tr ',' '\n' | sed -n 's/.*"browser_download_url": *"\([^"]*\)".*/\1/p' | grep -E "$pattern" | head -n 1)"
[ -n "$url" ] || { echo "A build for this system is not published yet." >&2; exit 1; }
file="${url##*/}"
tmp="${TMPDIR:-/tmp}/recovery-ledger-$file"
curl -fL "$url" -o "$tmp"
sums_url="$(printf '%s' "$release" | tr ',' '\n' | sed -n 's/.*"browser_download_url": *"\([^"]*SHA256SUMS\)".*/\1/p' | head -n 1)"
expected="$(curl -fsSL "$sums_url" | awk -v file="$file" '$2 == file { print $1 }')"
actual="$(sha256sum "$tmp" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$tmp" | awk '{print $1}')"
[ "$expected" = "$actual" ] || { echo "Checksum mismatch. Nothing was installed." >&2; exit 1; }

case "$(uname -s)" in
  Linux)
    install_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
    target="$install_dir/change-recovery-ledger"
    mkdir -p "$install_dir"
    chmod 755 "$tmp"
    mv -f "$tmp" "$target"
    echo "Installed and verified Change Recovery Ledger at $target"
    case ":$PATH:" in
      *":$install_dir:"*) ;;
      *) echo "Add $install_dir to PATH, then run: change-recovery-ledger" ;;
    esac
    ;;
  Darwin)
    echo "Downloaded and verified $file at $tmp"
    echo "Open the disk image to move Change Recovery Ledger to Applications."
    ;;
esac
