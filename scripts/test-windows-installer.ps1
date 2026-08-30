$ErrorActionPreference = "Stop"
$sandbox = Join-Path $env:RUNNER_TEMP "acr-install-script-test"
New-Item -ItemType Directory -Path $sandbox -Force | Out-Null
$asset = Join-Path $sandbox "Change.Recovery.Ledger_test_x64-setup.exe"
$marker = Join-Path $sandbox "started.txt"
Copy-Item "$env:SystemRoot\System32\cmd.exe" $asset -Force
$digest = (Get-FileHash $asset -Algorithm SHA256).Hash.ToLower()
$metadata = Join-Path $sandbox "release.json"
$sums = Join-Path $sandbox "SHA256SUMS"
@{ assets = @(@{ name = (Split-Path $asset -Leaf); browser_download_url = "https://example.invalid/test.exe" }) } |
  ConvertTo-Json -Depth 4 | Set-Content $metadata -Encoding utf8
"$digest  $(Split-Path $asset -Leaf)" | Set-Content $sums -Encoding ascii
$env:ACR_RELEASE_METADATA_PATH = $metadata
$env:ACR_CHECKSUMS_PATH = $sums
$env:ACR_ASSET_SOURCE_PATH = $asset
$env:ACR_DOWNLOAD_DIR = Join-Path $sandbox "download"
$env:ACR_INSTALLER_ARGUMENTS = "/c echo started > `"$marker`""
$env:ACR_WAIT_FOR_INSTALLER = "1"
$env:ACR_START_PROOF_PATH = Join-Path $sandbox "start.json"
$installerScript = Join-Path (Get-Location) "public/install.ps1"
& $installerScript
if ((Get-Content $marker -Raw).Trim() -ne "started") { throw "The verified executable was not started." }

Remove-Item $marker, $env:ACR_START_PROOF_PATH -Force
"$('0' * 64)  $(Split-Path $asset -Leaf)" | Set-Content $sums -Encoding ascii
try { & $installerScript } catch { $mismatch = $_.Exception.Message -match "Checksum mismatch" }
if (-not $mismatch -or (Test-Path $marker) -or (Test-Path $env:ACR_START_PROOF_PATH)) {
  throw "The checksum mismatch did not stop the installer."
}
Write-Output "Windows installer consumer test passed: verified start=1, mismatch start=0"
