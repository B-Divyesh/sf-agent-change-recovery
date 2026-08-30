$ErrorActionPreference = "Stop"
$tag = "v$((Get-Content package.json -Raw | ConvertFrom-Json).version)"
$proofDirectory = Join-Path $env:RUNNER_TEMP "acr-windows-consumer"
New-Item -ItemType Directory -Path $proofDirectory -Force | Out-Null

gh release download $tag --pattern "*x64-setup.exe" --dir $proofDirectory
$installer = Get-ChildItem $proofDirectory -Filter "*x64-setup.exe" | Select-Object -First 1
if (-not $installer) { throw "The candidate release has no Windows setup executable." }
$digest = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLower()
$metadataPath = Join-Path $proofDirectory "release.json"
$checksumsPath = Join-Path $proofDirectory "SHA256SUMS"
$startProofPath = Join-Path $proofDirectory "valid-start.json"
@{ assets = @(@{ name = $installer.Name; browser_download_url = "https://example.invalid/$($installer.Name)" }) } |
  ConvertTo-Json -Depth 4 | Set-Content $metadataPath -Encoding utf8
"$digest  $($installer.Name)" | Set-Content $checksumsPath -Encoding ascii

$env:ACR_RELEASE_METADATA_PATH = $metadataPath
$env:ACR_CHECKSUMS_PATH = $checksumsPath
$env:ACR_ASSET_SOURCE_PATH = $installer.FullName
$env:ACR_DOWNLOAD_DIR = Join-Path $proofDirectory "valid-download"
$env:ACR_INSTALLER_ARGUMENTS = "/S"
$env:ACR_WAIT_FOR_INSTALLER = "1"
$env:ACR_START_PROOF_PATH = $startProofPath
$installerScript = Join-Path (Get-Location) "public/install.ps1"
& $installerScript
$valid = Get-Content $startProofPath -Raw | ConvertFrom-Json
if (-not $valid.started -or $valid.asset -ne $installer.Name -or $valid.sha256 -ne $digest) {
  throw "The verified installer did not produce the expected start proof."
}

$installedApp = Get-ChildItem $env:LOCALAPPDATA -Filter "Change Recovery Ledger.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installedApp) {
  $installedApp = Get-ChildItem $env:LOCALAPPDATA -Filter "change-recovery-ledger.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $installedApp) { throw "The verified setup did not install the desktop executable." }
$appProcess = Start-Process $installedApp.FullName -PassThru
Start-Sleep -Seconds 5
$launched = -not $appProcess.HasExited
if (-not $appProcess.HasExited) { Stop-Process -Id $appProcess.Id -Force }
if (-not $launched) { throw "The installed desktop app did not remain running for the launch smoke." }

Remove-Item $startProofPath -Force
"$('0' * 64)  $($installer.Name)" | Set-Content $checksumsPath -Encoding ascii
$mismatchStopped = $false
try {
  & $installerScript
} catch {
  $mismatchStopped = $_.Exception.Message -match "Checksum mismatch"
}
if (-not $mismatchStopped -or (Test-Path $startProofPath)) { throw "A checksum mismatch reached Start-Process." }

@{
  schema = 1
  tag = $tag
  commit = $env:GITHUB_SHA
  runner = "windows-latest"
  installer = $installer.Name
  sha256 = $digest
  verifiedInstallerStarts = 1
  checksumMismatchStarts = 0
  installedExecutable = $installedApp.FullName
  installedAppLaunchSmoke = $true
} | ConvertTo-Json | Set-Content "windows-consumer-proof.json" -Encoding utf8

gh release upload $tag windows-consumer-proof.json --clobber
