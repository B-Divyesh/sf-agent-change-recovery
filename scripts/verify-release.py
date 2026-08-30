#!/usr/bin/env python3
"""Verify that a published desktop release is complete and belongs to its tag."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def fail(message: str) -> None:
    raise SystemExit(f"release verification failed: {message}")


def matching_asset(names: set[str], pattern: str) -> str:
    expression = re.compile(pattern, re.IGNORECASE)
    match = next((name for name in names if expression.search(name)), None)
    if not match:
        fail(f"missing required asset matching {pattern}")
    return match


def checksum_map(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split(maxsplit=1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-f]{64}", parts[0]):
            fail(f"invalid SHA256SUMS line: {line!r}")
        values[parts[1].lstrip(" *")] = parts[0]
    return values


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    if len(sys.argv) != 5:
        fail("usage: verify-release.py <tag> <commit> <release-json> <asset-directory>")
    tag, commit, release_path, assets_path = sys.argv[1:]
    release = json.loads(Path(release_path).read_text(encoding="utf-8"))
    if release.get("tagName") != tag:
        fail(f"release tag {release.get('tagName')!r} does not match {tag!r}")
    if release.get("targetCommitish") != commit:
        fail("published release target does not match the tagged commit")

    assets_dir = Path(assets_path)
    local_names = {item.name for item in assets_dir.iterdir() if item.is_file()}
    github_names = {item["name"] for item in release.get("assets", []) if isinstance(item, dict) and "name" in item}
    if local_names != github_names:
        fail("downloaded release asset names do not match the published release")

    required = {
        "macOS Apple silicon": matching_asset(local_names, r"(?:aarch64|arm64).*\.dmg$"),
        "macOS Intel": matching_asset(local_names, r"(?:x64|x86_64|amd64).*\.dmg$"),
        "Linux AppImage": matching_asset(local_names, r"\.AppImage$"),
        "Linux Debian": matching_asset(local_names, r"\.deb$"),
        "Linux RPM": matching_asset(local_names, r"\.rpm$"),
        "Windows": matching_asset(local_names, r"\.(?:msi|exe)$"),
    }
    for metadata in ("SHA256SUMS", "latest.json"):
        if metadata not in local_names:
            fail(f"missing {metadata}")

    sums = checksum_map(assets_dir / "SHA256SUMS")
    desktop_assets = local_names - {"SHA256SUMS", "latest.json"}
    if not set(required.values()).issubset(desktop_assets):
        fail("the canonical platform artifacts are not all present")
    if set(sums) != desktop_assets:
        fail("SHA256SUMS must cover exactly every desktop artifact")
    for asset_name in desktop_assets:
        if sums[asset_name] != sha256(assets_dir / asset_name):
            fail(f"checksum does not match {asset_name}")

    manifest = json.loads((assets_dir / "latest.json").read_text(encoding="utf-8"))
    if manifest.get("tag") != tag or manifest.get("version") != tag.removeprefix("v"):
        fail("latest.json version does not match the release tag")
    manifest_assets = manifest.get("assets")
    if not isinstance(manifest_assets, list):
        fail("latest.json has no assets list")
    manifest_names = {item.get("name") for item in manifest_assets if isinstance(item, dict)}
    if manifest_names != desktop_assets:
        fail("latest.json must list exactly every desktop artifact")
    for item in manifest_assets:
        if not isinstance(item, dict) or item.get("name") not in desktop_assets or not str(item.get("url", "")).endswith(f"/{item.get('name')}"):
            fail("latest.json contains an invalid asset URL")

    print(f"release verified: {tag} at {commit[:12]} with {len(desktop_assets)} desktop artifacts")


if __name__ == "__main__":
    main()
