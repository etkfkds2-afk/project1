$ErrorActionPreference = "Stop"

$taskName = "AllthatmindReservationNotifier"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$notifierPath = Join-Path $scriptDir "reservation-notifier.ps1"
$appDir = Join-Path $env:APPDATA "AllthatmindReservationNotifier"
$configPath = Join-Path $appDir "config.json"

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

$config | ConvertTo-Json -Depth 8 | Set-Content -Path $configPath -Encoding UTF8

$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$notifierPath`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Allthatmind reservation notifier" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "Install complete: $taskName"
Write-Host "Config file: $configPath"
Write-Host "Reservation notifier has started."
Write-Host "A test notification will be shown now."

$testNotifierPath = Join-Path $scriptDir "test-notifier.ps1"
if (Test-Path $testNotifierPath) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $testNotifierPath
}
