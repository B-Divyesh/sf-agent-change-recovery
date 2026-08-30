$ErrorActionPreference = "Stop"
$repo = "B-Divyesh/sf-agent-change-recovery"

if ($env:ACR_RELEASE_METADATA_PATH) {
  $release = Get-Content $env:ACR_RELEASE_METADATA_PATH -Raw | ConvertFrom-Json
} else {
  $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
}

$asset = $release.assets | Where-Object { $_.name -match 'x64-setup\.exe$' } | Select-Object -First 1
if (-not $asset) { $asset = $release.assets | Where-Object { $_.name -match '\.(msi|exe)$' } | Select-Object -First 1 }
if (-not $asset) { throw "A Windows build is not published yet." }

$downloadDirectory = if ($env:ACR_DOWNLOAD_DIR) { $env:ACR_DOWNLOAD_DIR } else { $env:TEMP }
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
$path = Join-Path $downloadDirectory $asset.name
if ($env:ACR_ASSET_SOURCE_PATH) {
  Copy-Item $env:ACR_ASSET_SOURCE_PATH $path -Force
} else {
  Invoke-WebRequest $asset.browser_download_url -OutFile $path
}

if ($env:ACR_CHECKSUMS_PATH) {
  $sums = Get-Content $env:ACR_CHECKSUMS_PATH -Raw
} else {
  $sumsAsset = $release.assets | Where-Object { $_.name -eq 'SHA256SUMS' } | Select-Object -First 1
  if (-not $sumsAsset) { Remove-Item $path -Force; throw "The release checksum list is missing. Nothing was installed." }
  $sums = (Invoke-WebRequest $sumsAsset.browser_download_url).Content
}

$sumLine = ($sums -split "`n") | Where-Object { $_ -match ("\s+\*?" + [regex]::Escape($asset.name) + "\s*$") } | Select-Object -First 1
if (-not $sumLine) { Remove-Item $path -Force; throw "This installer is missing from the release checksum list. Nothing was installed." }
$expected = ($sumLine -split '\s+')[0].ToLower()
$actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { Remove-Item $path -Force; throw "Checksum mismatch. Nothing was installed." }

Write-Output "Downloaded and verified $($asset.name) at $path"
$startArguments = @{ FilePath = $path; PassThru = $true }
if ($env:ACR_INSTALLER_ARGUMENTS) { $startArguments.ArgumentList = $env:ACR_INSTALLER_ARGUMENTS }
if ($env:ACR_WAIT_FOR_INSTALLER) { $startArguments.Wait = $true }
$process = Start-Process @startArguments
if ($env:ACR_WAIT_FOR_INSTALLER -and $process.ExitCode -ne 0) { throw "The verified installer exited with code $($process.ExitCode)." }
if ($env:ACR_START_PROOF_PATH) {
  @{ asset = $asset.name; sha256 = $actual; started = $true; exitCode = $process.ExitCode } |
    ConvertTo-Json | Set-Content $env:ACR_START_PROOF_PATH -Encoding utf8
}
