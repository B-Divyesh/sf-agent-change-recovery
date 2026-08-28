$ErrorActionPreference = "Stop"
$repo = "B-Divyesh/sf-agent-change-recovery"
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$asset = $release.assets | Where-Object { $_.name -match '\.(msi|exe)$' } | Select-Object -First 1
if (-not $asset) { throw "A Windows build is not published yet." }
$path = Join-Path $env:TEMP $asset.name
Invoke-WebRequest $asset.browser_download_url -OutFile $path
$sumsAsset = $release.assets | Where-Object { $_.name -eq 'SHA256SUMS' } | Select-Object -First 1
$sums = (Invoke-WebRequest $sumsAsset.browser_download_url).Content
$expected = (($sums -split "`n") | Where-Object { $_ -match [regex]::Escape($asset.name) } | Select-Object -First 1) -split '\s+' | Select-Object -First 1
$actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
if ($expected.ToLower() -ne $actual) { Remove-Item $path; throw "Checksum mismatch. Nothing was installed." }
Write-Output "Downloaded and verified $($asset.name) at $path"
Start-Process $path
