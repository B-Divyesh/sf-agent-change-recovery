import json
import os
import sys

tag = sys.argv[1]
repo = os.environ.get("GITHUB_REPOSITORY", "B-Divyesh/sf-agent-change-recovery")
base = f"https://github.com/{repo}/releases/download/{tag}"
files = sorted(name for name in os.listdir(".") if name not in {"SHA256SUMS", "latest.json"})

print(json.dumps({
    "version": tag.removeprefix("v"),
    "tag": tag,
    "assets": [{"name": name, "url": f"{base}/{name}"} for name in files]
}, indent=2))
