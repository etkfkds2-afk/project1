$ErrorActionPreference = "Stop"

$taskName = "AllthatmindReservationNotifier"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$notifierPath = Join-Path $scriptDir "reservation-notifier.ps1"
$appDir = Join-Path $env:APPDATA "AllthatmindReservationNotifier"
$configPath = Join-Path $appDir "config.json"
$installedNotifierPath = Join-Path $appDir "reservation-notifier.ps1"
$versionPath = Join-Path $appDir "version.txt"
$statusPath = Join-Path $appDir "status.json"
$version = "2.0.0"

if (!(Test-Path $notifierPath)) {
  throw "reservation-notifier.ps1 not found: $notifierPath"
}

New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$token = Read-Host "Enter reservation API token"
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Reservation API token is empty."
}

$config = @{
  token = $token.Trim()
  branches = @(
    @{
      name = "munrae"
      baseUrl = "https://www.allthatmind.com/_functions"
    },
    @{
      name = "sinnonhyeon"
      baseUrl = "https://allthatmind2.wixsite.com/website/_functions"
    }
  )
}

$headers = @{ Authorization = "Bearer $($token.Trim())" }
$validatedBranches = 0
foreach ($branch in $config.branches) {
  $url = "$($branch.baseUrl.TrimEnd('/'))/reservations"
  try {
    $null = Invoke-RestMethod -Method Get -Uri $url -Headers $headers -TimeoutSec 30
    $validatedBranches += 1
    Write-Host "API check OK: $($branch.name)"
  } catch {
    Write-Warning "API check failed: $($branch.name) / $($_.Exception.Message)"
  }
}
if ($validatedBranches -eq 0) {
  throw "Reservation API authentication failed for every branch. Check the token and internet connection."
}

$config | ConvertTo-Json -Depth 8 | Set-Content -Path $configPath -Encoding UTF8
Copy-Item -Force -Path $notifierPath -Destination $installedNotifierPath
Set-Content -Path $versionPath -Value $version -Encoding ASCII

$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedNotifierPath`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 10 `
  -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Allthatmind reservation notifier v$version" -Force | Out-Null
Remove-Item -Path $statusPath -Force -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $taskName
$statusReady = $false
for ($attempt = 0; $attempt -lt 10; $attempt++) {
  Start-Sleep -Seconds 1
  if (Test-Path $statusPath) {
    $statusReady = $true
    break
  }
}
$task = Get-ScheduledTask -TaskName $taskName
if ($task.State -ne "Running") {
  throw "Scheduled task did not start. Current state: $($task.State)"
}
if (!$statusReady) {
  throw "Scheduled task started but did not create its runtime status file. Run check-notifier.bat for details."
}

Write-Host "Install complete: $taskName (v$version)"
Write-Host "Config file: $configPath"
Write-Host "Installed notifier: $installedNotifierPath"
Write-Host "Task state: $($task.State)"
Write-Host "Reservation notifier has started."
Write-Host "A test notification will be shown now."

$testNotifierPath = Join-Path $scriptDir "test-notifier.ps1"
if (Test-Path $testNotifierPath) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $testNotifierPath
}
